// Bot Telegram **entrant** — reçoit les commandes de l'admin et les messages de support relayés.
//
// Différences avec `notify-telegram` (sortant) :
//   - `verify_jwt: false` (Telegram ne sait pas envoyer un JWT Supabase)
//   - Auth via header `X-Telegram-Bot-Api-Secret-Token` (passé par Telegram tel qu'il a été
//     configuré côté `setWebhook`).
//   - Filtrage par `chat_id` admin pour bloquer toute commande d'un tiers.
//
// Variables d'env requises (Supabase → Project Settings → Edge Functions → Secrets) :
//   TELEGRAM_BOT_TOKEN        — token du bot @BotFather (mutualisé avec notify-telegram)
//   TELEGRAM_CHAT_ID          — chat_id admin (mutualisé avec notify-telegram)
//   TELEGRAM_WEBHOOK_SECRET   — secret aléatoire fourni à `setWebhook` (32+ caractères)
//   SUPABASE_URL              — URL projet Supabase (auto-injecté en runtime)
//   SUPABASE_SERVICE_ROLE_KEY — clé service (auto-injectée en runtime)
//
// Déploiement (config impérative — pas de config.toml dans le repo) :
//   1. Déployer la fonction
//   2. Désactiver `Verify JWT` dans le dashboard Supabase pour cette fonction
//   3. `setWebhook` côté Telegram :
//        curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
//             -d url="https://<project>.supabase.co/functions/v1/telegram-bot" \
//             -d secret_token="<TELEGRAM_WEBHOOK_SECRET>"
//
// Commandes prises en charge :
//   /help, /start              — liste les commandes
//   /stats                     — résumé du jour (signups, devis, factures, tickets)
//   /user <email>              — fiche d'un utilisateur (plan, dates, derniers devis)
//   /tickets                   — liste les tickets ouverts
//   /reply <ticket_id> <texte> — insère une réponse admin sur un ticket

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Configuration ────────────────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN      = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID        = Deno.env.get("TELEGRAM_CHAT_ID")   ?? "";
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL            = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const TG_API = (method: string) =>
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;

// ─── Helpers ──────────────────────────────────────────────────────────────

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
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtDate(d: unknown): string {
  if (!d) return "—";
  const date = new Date(String(d));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function sendMessage(chatId: string | number, text: string): Promise<void> {
  if (!text.trim()) return;
  // Telegram limite à 4096 caractères par message — on tronque proprement.
  const safe = text.length > 4000 ? text.slice(0, 3990) + "\n…" : text;
  try {
    await fetch(TG_API("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: safe,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error("[telegram-bot] sendMessage failed:", err);
  }
}

// ─── Commandes ────────────────────────────────────────────────────────────

type Cmd = {
  name: string;
  args: string;       // tout ce qui suit la commande (peut être vide)
  raw:  string;       // texte complet du message
};

function parseCommand(text: string): Cmd | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const space = trimmed.indexOf(" ");
  // Telegram autorise /cmd@bot_name — on coupe le @
  const head = (space === -1 ? trimmed : trimmed.slice(0, space)).split("@")[0];
  const args = space === -1 ? "" : trimmed.slice(space + 1).trim();
  return { name: head.toLowerCase(), args, raw: trimmed };
}

const HELP_TEXT = [
  "<b>Zenbat — bot admin</b>",
  "",
  "/stats — résumé du jour (inscriptions, devis, factures, tickets)",
  "/user &lt;email&gt; — fiche d'un utilisateur",
  "/tickets — tickets de support ouverts",
  "/reply &lt;ticket_id&gt; &lt;message&gt; — répondre à un ticket",
  "/help — afficher cette aide",
].join("\n");

// deno-lint-ignore no-explicit-any
type Sb = ReturnType<typeof createClient<any, any, any>>;

async function cmdStats(sb: Sb): Promise<string> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const since = todayStart.toISOString();

  const [signups, devis, invoices, openTickets, awaitingTickets] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
    sb.from("devis").select("id", { count: "exact", head: true }).gte("created_at", since),
    sb.from("invoices").select("id", { count: "exact", head: true }).gte("created_at", since),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "awaiting_admin"),
  ]);

  return [
    "📊 <b>Résumé du jour</b>",
    `Inscriptions : <b>${signups.count ?? 0}</b>`,
    `Devis créés : <b>${devis.count ?? 0}</b>`,
    `Factures émises : <b>${invoices.count ?? 0}</b>`,
    "",
    "🎫 <b>Support</b>",
    `Tickets ouverts : <b>${openTickets.count ?? 0}</b>`,
    `En attente admin : <b>${awaitingTickets.count ?? 0}</b>`,
  ].join("\n");
}

async function cmdUser(sb: Sb, args: string): Promise<string> {
  const email = args.trim().toLowerCase();
  if (!email) return "Usage : <code>/user &lt;email&gt;</code>";

  // Pas de relation directe profiles ↔ auth.users côté API REST → on passe par auth.admin.
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const authUser = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
  if (!authUser) return `Utilisateur introuvable : <code>${escapeHtml(email)}</code>`;

  const { data: profile } = await sb.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
  const [devis, invoices] = await Promise.all([
    sb.from("devis").select("id", { count: "exact", head: true }).eq("owner_id", authUser.id),
    sb.from("invoices").select("id", { count: "exact", head: true }).eq("owner_id", authUser.id),
  ]);

  const lines = [
    `👤 <b>${escapeHtml(email)}</b>`,
    profile?.company_name ? `Entreprise : ${escapeHtml(profile.company_name)}` : "",
    `Plan : <b>${escapeHtml(profile?.plan ?? "free")}</b>`,
    `Inscrit le : ${fmtDate(authUser.created_at)}`,
    `Dernière connexion : ${fmtDate(authUser.last_sign_in_at)}`,
    "",
    `Devis : <b>${devis.count ?? 0}</b>  ·  Factures : <b>${invoices.count ?? 0}</b>`,
  ];
  return lines.filter(Boolean).join("\n");
}

async function cmdTickets(sb: Sb): Promise<string> {
  const { data, error } = await sb
    .from("support_tickets")
    .select("id, user_id, status, subject, last_message_at, created_at")
    .in("status", ["open", "awaiting_admin"])
    .order("last_message_at", { ascending: false })
    .limit(15);

  if (error) return `Erreur : ${escapeHtml(error.message)}`;
  if (!data || data.length === 0) return "Aucun ticket ouvert. 🎉";

  const lines = ["🎫 <b>Tickets ouverts</b>", ""];
  for (const t of data) {
    const flag = t.status === "awaiting_admin" ? "🔴" : "🟢";
    const subj = t.subject ? clip(t.subject, 60) : "(sans sujet)";
    lines.push(
      `${flag} <code>${t.id.slice(0, 8)}</code> — ${escapeHtml(subj)}`,
      `    ${fmtDate(t.last_message_at)}`,
    );
  }
  lines.push("", "Pour répondre : <code>/reply &lt;id&gt; &lt;message&gt;</code>");
  return lines.join("\n");
}

async function cmdReply(sb: Sb, args: string): Promise<string> {
  const space = args.indexOf(" ");
  if (space === -1) return "Usage : <code>/reply &lt;ticket_id&gt; &lt;message&gt;</code>";
  const idPart  = args.slice(0, space).trim();
  const message = args.slice(space + 1).trim();
  if (!idPart || !message) return "Usage : <code>/reply &lt;ticket_id&gt; &lt;message&gt;</code>";

  // Le ticket_id peut être l'UUID complet ou son préfixe (8 chars) renvoyé par /tickets.
  let ticket;
  if (idPart.length === 36) {
    const r = await sb.from("support_tickets").select("id, status").eq("id", idPart).maybeSingle();
    ticket = r.data;
  } else {
    const r = await sb.from("support_tickets")
      .select("id, status")
      .like("id", `${idPart}%`)
      .limit(2);
    if (r.data && r.data.length > 1) return "Préfixe ambigu — utilise l'UUID complet.";
    ticket = r.data?.[0];
  }
  if (!ticket) return `Ticket introuvable : <code>${escapeHtml(idPart)}</code>`;

  const { error: insertErr } = await sb.from("support_messages").insert({
    ticket_id: ticket.id,
    role: "admin",
    content: message,
  });
  if (insertErr) return `Erreur insert : ${escapeHtml(insertErr.message)}`;

  // Repasse le statut en 'open' : l'utilisateur peut maintenant répondre.
  await sb.from("support_tickets")
    .update({ status: "open" })
    .eq("id", ticket.id);

  return `✅ Réponse envoyée sur <code>${ticket.id.slice(0, 8)}</code>`;
}

// ─── Handler principal ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Telegram envoie POST exclusivement.
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Auth 1 : secret token Telegram.
  const provided = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!TELEGRAM_WEBHOOK_SECRET || provided !== TELEGRAM_WEBHOOK_SECRET) {
    console.warn("[telegram-bot] secret token invalide");
    return new Response("forbidden", { status: 403 });
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("[telegram-bot] env Telegram manquante");
    return new Response("misconfigured", { status: 200 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[telegram-bot] env Supabase manquante");
    return new Response("misconfigured", { status: 200 });
  }

  // Parse update.
  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return new Response("bad json", { status: 200 });
  }

  // deno-lint-ignore no-explicit-any
  const message: any = (update as any).message ?? (update as any).edited_message;
  if (!message || typeof message.text !== "string") {
    return new Response(JSON.stringify({ ok: true, ignored: "no text" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth 2 : chat_id admin uniquement (le bot ne discute avec personne d'autre).
  const chatId = String(message.chat?.id ?? "");
  if (chatId !== String(TELEGRAM_CHAT_ID)) {
    console.warn("[telegram-bot] chat_id non autorisé:", chatId);
    // On répond quand même 200 pour que Telegram n'enchaîne pas les retries.
    return new Response(JSON.stringify({ ok: true, ignored: "chat_id" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cmd = parseCommand(message.text);
  if (!cmd) {
    await sendMessage(chatId, "Tape /help pour voir les commandes.");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let reply = "";
  try {
    switch (cmd.name) {
      case "/start":
      case "/help":
        reply = HELP_TEXT;
        break;
      case "/stats":
        reply = await cmdStats(sb);
        break;
      case "/user":
        reply = await cmdUser(sb, cmd.args);
        break;
      case "/tickets":
        reply = await cmdTickets(sb);
        break;
      case "/reply":
        reply = await cmdReply(sb, cmd.args);
        break;
      default:
        reply = `Commande inconnue : <code>${escapeHtml(cmd.name)}</code>\nTape /help.`;
    }
  } catch (err) {
    console.error("[telegram-bot] command error:", err);
    reply = `❌ Erreur : ${escapeHtml(err instanceof Error ? err.message : String(err))}`;
  }

  await sendMessage(chatId, reply);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
