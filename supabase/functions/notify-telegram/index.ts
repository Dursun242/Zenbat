// Relais Telegram — point d'entrée unique pour toutes les notifications admin.
// Reçoit un événement et le pousse à Telegram (sendMessage ou sendDocument).
// Aucune persistance, aucun stockage : tout transite en mémoire.
//
// Sources qui appellent cette fonction :
//   • DB Webhooks Supabase (profiles, activity_log, ia_error_logs, ia_negative_logs, app_logs)
//   • Front Zenbat (helper src/lib/telegramNotify.js — envoi PDF)
//   • Vercel API stripe-webhook.js (paiements)
//
// Auth : verify_jwt activé par défaut côté Supabase. Les DB Webhooks envoient
// le service_role key dans Authorization, le front envoie le JWT user, et
// les API server-to-server utilisent le service_role key.
//
// Variables d'env requises (Project Settings → Edge Functions secrets) :
//   TELEGRAM_BOT_TOKEN — token du bot @BotFather
//   TELEGRAM_CHAT_ID   — chat_id de l'admin (obtenu via @userinfobot)

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID   = Deno.env.get("TELEGRAM_CHAT_ID")   ?? "";

const TG_API = (method: string) =>
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;

// ─── Utils ────────────────────────────────────────────────────────────────

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clip(s: unknown, max = 300): string {
  const str = String(s ?? "");
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function fmtAmount(n: unknown): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return x.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

// ─── Formatage des événements ────────────────────────────────────────────

type EventKind =
  | "signup"
  | "activity"
  | "ia_error"
  | "ia_negative"
  | "app_log_error"
  | "payment_success"
  | "subscription_canceled"
  | "pdf_generated"
  | "raw";

function formatEvent(kind: EventKind, payload: Record<string, unknown>): string {
  const p = payload || {};

  switch (kind) {
    case "signup": {
      const email = escapeHtml(clip(p.email, 80));
      const trade = escapeHtml(clip(p.metier_principal, 60));
      return [
        "🆕 <b>Nouvelle inscription</b>",
        email,
        trade ? `Métier : ${trade}` : "",
      ].filter(Boolean).join("\n");
    }

    case "activity": {
      const t = String(p.table_name ?? "");
      const action = String(p.action ?? "");
      const nd = (p.new_data as Record<string, unknown>) ?? {};
      const od = (p.old_data as Record<string, unknown>) ?? {};

      if (t === "devis" && action === "insert") {
        return `🆕 Nouveau devis <b>${escapeHtml(nd.numero)}</b>` +
          (nd.total_ttc ? ` — ${fmtAmount(nd.total_ttc)}` : "");
      }
      if (t === "devis" && action === "update" && nd.statut !== od.statut) {
        return `📄 Devis <b>${escapeHtml(nd.numero)}</b> : ` +
          `${escapeHtml(od.statut)} → <b>${escapeHtml(nd.statut)}</b>`;
      }
      if (t === "invoices" && action === "insert") {
        return `🧾 Nouvelle facture <b>${escapeHtml(nd.numero)}</b>` +
          (nd.total_ttc ? ` — ${fmtAmount(nd.total_ttc)}` : "");
      }
      if (t === "invoices" && action === "update" && nd.statut !== od.statut) {
        return `🧾 Facture <b>${escapeHtml(nd.numero)}</b> : ` +
          `${escapeHtml(od.statut)} → <b>${escapeHtml(nd.statut)}</b>`;
      }
      // Inscription via trigger sur profiles (cf migration 0028)
      if (t === "profiles" && action === "insert") {
        return `🆕 <b>Nouvelle inscription</b>\n` +
          escapeHtml(clip(nd.email ?? nd.id, 80));
      }
      return "";
    }

    case "ia_error":
      return [
        "🔥 <b>Erreur IA</b>",
        escapeHtml(clip(p.error_message ?? p.message ?? p.error, 400)),
      ].join("\n");

    case "ia_negative":
      return [
        "👎 <b>Feedback IA négatif</b>",
        escapeHtml(clip(p.feedback ?? p.comment ?? p.reason, 400)),
      ].join("\n");

    case "app_log_error":
      return [
        "🚨 <b>Erreur applicative</b>",
        escapeHtml(clip(p.message, 400)),
      ].join("\n");

    case "payment_success":
      return [
        "💰 <b>Paiement réussi</b>",
        p.email     ? `User : ${escapeHtml(p.email)}`     : "",
        p.plan      ? `Plan : ${escapeHtml(p.plan)}`      : "",
        p.amount    ? `Montant : ${fmtAmount(p.amount)}`  : "",
      ].filter(Boolean).join("\n");

    case "subscription_canceled":
      return [
        "⚠️ <b>Abonnement annulé</b>",
        p.email ? `User : ${escapeHtml(p.email)}` : "",
      ].filter(Boolean).join("\n");

    case "pdf_generated": {
      const k = p.kind === "facture" ? "Facture" : "Devis";
      return [
        `📎 ${k} <b>${escapeHtml(p.numero ?? "—")}</b>`,
        p.user_email ? `User : ${escapeHtml(p.user_email)}` : "",
        p.total_ttc  ? `Montant : ${fmtAmount(p.total_ttc)}` : "",
      ].filter(Boolean).join("\n");
    }

    case "raw":
      return escapeHtml(clip(p.text, 1000));

    default:
      return "";
  }
}

// ─── Détection du shape « Supabase DB Webhook » ──────────────────────────
// Supabase envoie : { type: 'INSERT'|'UPDATE'|'DELETE', table, record, old_record, schema }

function fromSupabaseWebhook(body: Record<string, unknown>): { kind: EventKind; payload: Record<string, unknown> } | null {
  if (!body?.type || !body?.table) return null;
  const table  = String(body.table);
  const action = String(body.type).toLowerCase();
  const record = (body.record as Record<string, unknown>) ?? {};

  if (table === "activity_log" && action === "insert") {
    return { kind: "activity", payload: record };
  }
  if (table === "profiles" && action === "insert") {
    return { kind: "signup", payload: record };
  }
  if (table === "ia_error_logs" && action === "insert") {
    return { kind: "ia_error", payload: record };
  }
  if (table === "ia_negative_logs" && action === "insert") {
    return { kind: "ia_negative", payload: record };
  }
  if (table === "app_logs" && action === "insert" && record.level === "error") {
    return { kind: "app_log_error", payload: record };
  }
  return null;
}

// ─── Envoi Telegram ───────────────────────────────────────────────────────

async function sendText(text: string): Promise<boolean> {
  if (!text.trim()) return true; // event ignoré → succès silencieux
  const r = await fetch(TG_API("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  return r.ok;
}

async function sendDocument(filename: string, blob: Blob, caption: string): Promise<boolean> {
  const fd = new FormData();
  fd.append("chat_id", TELEGRAM_CHAT_ID);
  fd.append("caption", caption.slice(0, 1024));
  fd.append("parse_mode", "HTML");
  fd.append("document", blob, filename);
  const r = await fetch(TG_API("sendDocument"), { method: "POST", body: fd });
  return r.ok;
}

// ─── Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("[notify-telegram] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquant");
    return new Response(
      JSON.stringify({ ok: false, error: "telegram_not_configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const ctype = req.headers.get("content-type") || "";

    // ── Cas 1 : multipart/form-data → PDF en pièce jointe ─────────────
    if (ctype.startsWith("multipart/form-data")) {
      const fd = await req.formData();
      const kind = (String(fd.get("kind") || "pdf_generated")) as EventKind;
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(String(fd.get("payload") || "{}"));
      } catch { /* payload invalide → on continue avec {} */ }

      const file = fd.get("pdf");
      const caption = formatEvent(kind, payload) || "📎 PDF";

      let ok = false;
      if (file instanceof File) {
        ok = await sendDocument(file.name || "document.pdf", file, caption);
      } else {
        ok = await sendText(caption);
      }
      return new Response(
        JSON.stringify({ ok }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Cas 2 : JSON ──────────────────────────────────────────────────
    const body = await req.json() as Record<string, unknown>;

    // 2a. Supabase DB Webhook
    const webhook = fromSupabaseWebhook(body);
    if (webhook) {
      const text = formatEvent(webhook.kind, webhook.payload);
      const ok = await sendText(text);
      return new Response(
        JSON.stringify({ ok }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2b. Appel direct : { kind, payload }
    const kind    = String(body.kind ?? "raw") as EventKind;
    const payload = (body.payload as Record<string, unknown>) ?? {};
    const text = formatEvent(kind, payload);
    const ok = await sendText(text);
    return new Response(
      JSON.stringify({ ok }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[notify-telegram] error:", err);
    // On retourne 200 pour ne pas déclencher de retry sur les DB Webhooks.
    return new Response(
      JSON.stringify({ ok: false, error: String(err instanceof Error ? err.message : err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
