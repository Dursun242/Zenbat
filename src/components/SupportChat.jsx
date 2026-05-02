// SupportChat — widget de support en libre-service.
//
// Flux :
//   1. L'utilisateur ouvre le chat (FAB en bas-droite)
//   2. À l'ouverture, on charge le ticket non résolu le plus récent (s'il existe)
//   3. Au premier message envoyé, on crée le ticket si nécessaire
//   4. Claude répond en première ligne (system prompt FAQ Zenbat)
//   5. Si la réponse ne suffit pas → bouton "Contacter le support humain"
//      → status='awaiting_admin' → notif Telegram à l'admin
//
// RLS : l'utilisateur insère ses propres messages (role='user') via le client
// Supabase. Les messages role='claude' sont insérés par /api/claude après
// validation côté serveur (cf api/claude.js).

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../lib/auth.jsx";
import { supabase } from "../lib/supabase.js";
import { getToken } from "../lib/getToken.js";
import { CLAUDE_MODEL } from "../lib/constants.js";
import { SUPPORT_SYSTEM_PROMPT } from "../lib/supportPrompts.js";

const MAX_INPUT_CHARS = 2000;

export default function SupportChat({ accent = "#22c55e", open, onClose }) {
  const { user } = useAuth();
  const [ticket,   setTicket]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState(null);
  const scrollRef = useRef(null);

  // Charge ou réinitialise quand on ouvre
  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    (async () => {
      setError(null);
      const { data: existing, error: e1 } = await supabase
        .from("support_tickets")
        .select("id, status, subject, created_at, last_message_at")
        .eq("user_id", user.id)
        .neq("status", "resolved")
        .order("last_message_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (e1) { setError(e1.message); return; }

      if (existing?.[0]) {
        setTicket(existing[0]);
        const { data: msgs } = await supabase
          .from("support_messages")
          .select("id, role, content, created_at")
          .eq("ticket_id", existing[0].id)
          .order("created_at", { ascending: true });
        if (!cancelled) setMessages(msgs || []);
      } else {
        setTicket(null);
        setMessages([]);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user?.id]);

  // Auto-scroll en bas à chaque nouveau message
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy, open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || !user?.id) return;
    if (text.length > MAX_INPUT_CHARS) {
      setError(`Message trop long (max ${MAX_INPUT_CHARS} caractères)`);
      return;
    }

    setBusy(true);
    setError(null);

    let currentTicket = ticket;
    try {
      // 1. Crée le ticket si premier message
      if (!currentTicket) {
        const { data: created, error: createErr } = await supabase
          .from("support_tickets")
          .insert({ user_id: user.id, subject: text.slice(0, 80) })
          .select()
          .single();
        if (createErr) throw createErr;
        currentTicket = created;
        setTicket(created);
      }

      // 2. Insère le message utilisateur (RLS autorise role='user')
      const { data: insertedUser, error: insertErr } = await supabase
        .from("support_messages")
        .insert({ ticket_id: currentTicket.id, role: "user", content: text })
        .select()
        .single();
      if (insertErr) throw insertErr;

      const newMessages = [...messages, insertedUser];
      setMessages(newMessages);
      setInput("");

      // 3. Si en attente admin → on n'appelle pas Claude (l'admin va répondre via Telegram)
      if (currentTicket.status === "awaiting_admin") {
        setBusy(false);
        return;
      }

      // 4. Appel Claude (non-streamé) avec le contexte conversation
      const conversationForClaude = newMessages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

      const token = await getToken();
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify({
          model:             CLAUDE_MODEL,
          max_tokens:        800,
          system:            SUPPORT_SYSTEM_PROMPT,
          messages:          conversationForClaude,
          support_ticket_id: currentTicket.id,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errMsg = (typeof data?.error === "string" ? data.error
                      : data?.error?.message)
                      || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      const claudeText = (data?.content?.[0]?.text || "").trim();
      if (claudeText) {
        // L'API a déjà inséré la réponse en DB. On rafraîchit localement
        // pour récupérer l'id réel + created_at.
        const { data: refreshed } = await supabase
          .from("support_messages")
          .select("id, role, content, created_at")
          .eq("ticket_id", currentTicket.id)
          .order("created_at", { ascending: true });
        setMessages(refreshed || newMessages);
      }
    } catch (err) {
      console.error("[SupportChat] send failed:", err);
      setError(err?.message || "Erreur d'envoi");
    } finally {
      setBusy(false);
    }
  }, [input, busy, user?.id, ticket, messages]);

  const escalate = useCallback(async () => {
    if (!ticket || ticket.status === "awaiting_admin") return;
    setBusy(true);
    setError(null);
    try {
      const { error: updErr } = await supabase
        .from("support_tickets")
        .update({ status: "awaiting_admin" })
        .eq("id", ticket.id);
      if (updErr) throw updErr;
      setTicket({ ...ticket, status: "awaiting_admin" });

      // Notif Telegram fire-and-forget — la fonction Edge accepte le JWT user.
      const token = await getToken();
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind: "support_escalation",
          payload: {
            ticket_id:  ticket.id,
            user_email: user?.email || null,
            subject:    ticket.subject || null,
          },
        }),
      }).catch((e) => console.warn("[SupportChat] notif Telegram:", e?.message));
    } catch (err) {
      console.error("[SupportChat] escalate failed:", err);
      setError(err?.message || "Échec de l'escalade");
    } finally {
      setBusy(false);
    }
  }, [ticket, user?.email]);

  if (!user || !open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Support Zenbat"
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(0,0,0,.4)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
          <div
            style={{
              width: "100%", maxWidth: 480, height: "85%", maxHeight: 720,
              background: "#FAF7F2", borderRadius: "16px 16px 0 0",
              display: "flex", flexDirection: "column", overflow: "hidden",
              boxShadow: "0 -8px 32px rgba(0,0,0,.18)",
            }}
          >
            {/* Header */}
            <div style={{
              flexShrink: 0, padding: "14px 18px",
              background: accent, color: "white",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Support Zenbat</div>
                <div style={{ fontSize: 11, opacity: .85, marginTop: 2 }}>
                  {ticket?.status === "awaiting_admin"
                    ? "En attente d'un humain — tu seras notifié"
                    : "Claude répond en première ligne"}
                </div>
              </div>
              <button
                onClick={() => onClose?.()}
                aria-label="Fermer"
                style={{
                  background: "rgba(255,255,255,.18)", border: "none", color: "white",
                  width: 32, height: 32, borderRadius: 8, cursor: "pointer",
                  fontSize: 20, lineHeight: 1,
                }}
              >×</button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{
              flex: 1, overflowY: "auto", padding: 14,
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {messages.length === 0 && !busy && (
                <div style={{
                  textAlign: "center", color: "#78716c", fontSize: 13,
                  padding: "32px 16px", lineHeight: 1.5,
                }}>
                  Bonjour 👋<br/>
                  Pose ta question — je réponds tout de suite. Si je ne sais pas,
                  tu pourras contacter un humain en bas du chat.
                </div>
              )}

              {messages.map((m) => <MessageBubble key={m.id} message={m} accent={accent}/>)}

              {busy && (
                <div style={{
                  alignSelf: "flex-start", background: "white", color: "#78716c",
                  padding: "8px 12px", borderRadius: 12, fontSize: 13, fontStyle: "italic",
                  border: "1px solid #F0EBE3",
                }}>
                  …
                </div>
              )}
            </div>

            {/* Erreur */}
            {error && (
              <div style={{
                padding: "8px 14px", background: "#fef2f2", color: "#991b1b",
                fontSize: 12, borderTop: "1px solid #fecaca",
              }}>{error}</div>
            )}

            {/* Bouton escalade */}
            {ticket && ticket.status === "open" && messages.some(m => m.role === "user") && (
              <div style={{ padding: "8px 14px", borderTop: "1px solid #F0EBE3", background: "white" }}>
                <button
                  onClick={escalate}
                  disabled={busy}
                  style={{
                    width: "100%", padding: "8px 12px",
                    background: "#fef3c7", color: "#92400e",
                    border: "1px solid #fde68a", borderRadius: 8,
                    fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer",
                  }}
                >
                  Pas résolu — contacter le support humain
                </button>
              </div>
            )}

            {/* Input */}
            <div style={{
              flexShrink: 0, padding: 12, background: "white",
              borderTop: "1px solid #F0EBE3", display: "flex", gap: 8,
            }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={ticket?.status === "awaiting_admin"
                  ? "Ajoute une précision pour l'admin…"
                  : "Pose ta question…"}
                rows={2}
                maxLength={MAX_INPUT_CHARS}
                style={{
                  flex: 1, resize: "none", padding: "8px 10px",
                  border: "1px solid #E7E2D8", borderRadius: 10,
                  fontFamily: "inherit", fontSize: 14, outline: "none",
                  background: "#FAF7F2",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={busy || !input.trim()}
                aria-label="Envoyer"
                style={{
                  background: input.trim() && !busy ? accent : "#d6d3d1",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "0 16px", cursor: busy || !input.trim() ? "default" : "pointer",
                  fontWeight: 600, fontSize: 13,
                }}
              >
                Envoyer
              </button>
            </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, accent }) {
  const isUser   = message.role === "user";
  const isClaude = message.role === "claude";

  const bg = isUser   ? accent
           : isClaude ? "white"
           :            "#fef3c7"; // admin
  const color = isUser ? "white" : "#1c1917";
  const border = !isUser ? "1px solid #F0EBE3" : "none";
  const align = isUser ? "flex-end" : "flex-start";

  const label = isUser ? null
              : isClaude ? "Claude"
              : "Support Zenbat";

  return (
    <div style={{ alignSelf: align, maxWidth: "82%" }}>
      {label && (
        <div style={{ fontSize: 10, color: "#78716c", marginBottom: 3, marginLeft: 4 }}>
          {label}
        </div>
      )}
      <div style={{
        background: bg, color, border,
        padding: "8px 12px", borderRadius: 12,
        fontSize: 14, lineHeight: 1.45,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {message.content}
      </div>
    </div>
  );
}
