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
import { useModalGuard } from "../hooks/useModalGuard.js";
import { ZB } from "../lib/theme.js";
import { btnPrimary, btnSecondary } from "./ui/Register.jsx";

const MAX_INPUT_CHARS = 2000;

// La prop `accent` passée par App est ignorée : l'interface garde la terre
// cuite du système « Bordereau » (ZB.accent).
export default function SupportChat({ open, onClose }) {
  const { user } = useAuth();
  const [ticket,   setTicket]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState(null);
  const scrollRef = useRef(null);

  useModalGuard(open, onClose);

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

        // Marque les messages comme vus (badge "non lu" disparaît).
        // Fire-and-forget : un échec ne bloque pas l'affichage du chat.
        supabase
          .from("support_tickets")
          .update({ user_last_seen_at: new Date().toISOString() })
          .eq("id", existing[0].id)
          .then(({ error }) => { if (error) console.warn("[SupportChat] user_last_seen_at:", error.code, error.message) },
                () => {});
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

      // 3. Si en attente admin → on n'appelle pas Claude (l'admin va répondre via Telegram).
      //
      // Re-fetch du status avant l'appel Claude : si l'admin a pris la main
      // entre l'ouverture du chat et l'envoi du message (depuis Telegram via
      // /reply), la valeur locale `currentTicket.status` est obsolète et on
      // déclencherait Claude par-dessus la réponse humaine. On préfère un
      // aller-retour DB rapide à un message Claude parasite.
      const { data: fresh } = await supabase
        .from("support_tickets")
        .select("status")
        .eq("id", currentTicket.id)
        .maybeSingle();
      const liveStatus = fresh?.status ?? currentTicket.status;
      if (liveStatus === "awaiting_admin") {
        if (liveStatus !== currentTicket.status) {
          setTicket({ ...currentTicket, status: liveStatus });
        }
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

        // Bump user_last_seen_at après que l'user a vu la réponse Claude
        // (sinon le badge "non lu" réapparaîtrait au prochain check focus).
        supabase
          .from("support_tickets")
          .update({ user_last_seen_at: new Date().toISOString() })
          .eq("id", currentTicket.id)
          .then(({ error }) => { if (error) console.warn("[SupportChat] user_last_seen_at:", error.code, error.message) },
                () => {});
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

  const canSend = !busy && !!input.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Support Zenbat"
      className="zb-support"
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(26,22,18,.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        fontFamily: ZB.font, color: ZB.ink,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
          <style>{`
            .zb-support button:focus-visible, .zb-support textarea:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; }
            .zb-support textarea:focus { border-color: ${ZB.accent} !important; }
            .zb-support textarea::placeholder { color: ${ZB.ink3}; opacity: 1; }
            @media (hover: hover) { .zb-support .zb-support-send:not(:disabled):hover { background: var(--zb-accent-hover) !important; } }
          `}</style>
          <div
            style={{
              width: "100%", maxWidth: 520, height: "85%", maxHeight: 720,
              background: ZB.paper, borderRadius: "10px 10px 0 0",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              flexShrink: 0, padding: "6px 6px 6px 18px",
              borderBottom: `1px solid ${ZB.rule}`,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontWeight: 700, fontSize: 19 }}>Support Zenbat</h2>
                <div style={{ fontSize: 13, color: ZB.ink2, marginTop: 2 }}>
                  {ticket?.status === "awaiting_admin"
                    ? "En attente d'un humain — tu seras notifié"
                    : "Zenbot répond en première ligne"}
                </div>
              </div>
              <button
                onClick={() => onClose?.()}
                aria-label="Fermer"
                style={{
                  background: "none", border: "none", color: ZB.ink2,
                  width: 44, height: 44, display: "grid", placeItems: "center",
                  cursor: "pointer", flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} aria-live="polite" style={{
              flex: 1, overflowY: "auto", padding: 12,
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              {messages.length === 0 && !busy && (
                <p style={{
                  margin: 0, textAlign: "center", color: ZB.ink2, fontSize: 15,
                  padding: "32px 16px", lineHeight: 1.45,
                }}>
                  Bonjour.<br/>
                  Pose ta question — je réponds tout de suite. Si je ne sais pas,
                  tu pourras contacter un humain en bas du chat.
                </p>
              )}

              {messages.map((m) => <MessageEntry key={m.id} message={m}/>)}

              {busy && (
                <div style={{
                  padding: "10px 12px", fontSize: 14, color: ZB.ink2, fontStyle: "italic",
                }}>
                  Réponse en cours…
                </div>
              )}
            </div>

            {/* Erreur */}
            {error && (
              <div role="alert" style={{
                padding: "10px 16px", background: ZB.dangerSoft, color: ZB.danger,
                fontSize: 14, borderTop: `1px solid ${ZB.danger}`,
              }}>{error}</div>
            )}

            {/* Bouton escalade */}
            {ticket && ticket.status === "open" && messages.some(m => m.role === "user") && (
              <div style={{ padding: "8px 12px", borderTop: `1px solid ${ZB.rule}`, background: ZB.paper }}>
                <button
                  onClick={escalate}
                  disabled={busy}
                  style={{
                    ...btnSecondary, width: "100%", minHeight: 44, fontSize: 14,
                    cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
                  }}
                >
                  Pas résolu — contacter le support humain
                </button>
              </div>
            )}

            {/* Input */}
            <div style={{
              flexShrink: 0, padding: "10px 12px", paddingBottom: "max(10px, env(safe-area-inset-bottom))",
              background: ZB.paper, borderTop: `1px solid ${ZB.rule}`,
              display: "flex", alignItems: "flex-end", gap: 8,
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
                aria-label="Ton message"
                rows={1}
                maxLength={MAX_INPUT_CHARS}
                style={{
                  flex: 1, minWidth: 0, resize: "none", minHeight: 48, maxHeight: 120,
                  padding: "12px 12px", lineHeight: 1.4,
                  border: `1px solid ${ZB.field}`, borderRadius: 8,
                  fontFamily: "inherit", fontSize: 16, color: ZB.ink, outline: "none",
                  background: ZB.sheet,
                }}
              />
              <button
                onClick={sendMessage}
                disabled={busy || !input.trim()}
                aria-label="Envoyer"
                className="zb-support-send"
                style={{
                  ...btnPrimary, minHeight: 48, padding: "0 16px",
                  background: canSend ? ZB.accent : ZB.rule,
                  color: canSend ? ZB.sheet : ZB.ink2,
                  cursor: canSend ? "pointer" : "default",
                }}
              >
                Envoyer
              </button>
            </div>
      </div>
    </div>
  );
}

// Un message du fil, tracé comme une entrée de registre : libellé
// « Toi » / « Zenbot » / « Support » puis le texte, sans bulle colorée.
function MessageEntry({ message }) {
  const isUser   = message.role === "user";
  const isClaude = message.role === "claude";

  const label = isUser ? "Toi"
              : isClaude ? "Zenbot"
              : "Support";

  return (
    <div style={{
      background: isUser ? ZB.paper2 : ZB.sheet,
      borderStyle: "solid",
      borderColor: isUser ? ZB.paper2 : ZB.rule,
      borderWidth: !isUser && !isClaude ? "1px 1px 1px 3px" : 1,
      borderLeftColor: !isUser && !isClaude ? ZB.ink : (isUser ? ZB.paper2 : ZB.rule),
      borderRadius: 8, padding: "10px 12px",
    }}>
      <div style={{ fontSize: 13, fontWeight: isUser || isClaude ? 600 : 700, color: isUser || isClaude ? ZB.ink2 : ZB.ink, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize: 15, lineHeight: 1.45, color: ZB.ink,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {message.content}
      </div>
    </div>
  );
}
