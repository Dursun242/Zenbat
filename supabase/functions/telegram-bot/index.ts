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

const TELEGRAM_BOT_TOKEN      = (Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "").trim();
const TELEGRAM_CHAT_ID        = (Deno.env.get("TELEGRAM_CHAT_ID")   ?? "").trim();
const TELEGRAM_WEBHOOK_SECRET = (Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "").trim();
const SUPABASE_URL            = (Deno.env.get("SUPABASE_URL") ?? "").trim();
const SUPABASE_SERVICE_KEY    = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

// Le chat_id Telegram est un entier (positif pour user, négatif pour group).
// On valide strictement le format pour éviter qu'une valeur tronquée ou
// composée d'espaces ne soit interprétée comme "tout chat_id accepté".
const TELEGRAM_CHAT_ID_VALID = /^-?\d+$/.test(TELEGRAM_CHAT_ID);

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

// Format relatif type "aujourd'hui 14:32", "hier 09:12", "il y a 4 jours",
// "il y a 2 mois". Plus parlant que "06/05/2026" pour évaluer si un user
// est actif ou en sommeil.
function fmtRelTime(d: unknown): string {
  if (!d) return "—";
  const date = new Date(String(d));
  if (Number.isNaN(date.getTime())) return "—";
  const now      = Date.now();
  const diffMs   = now - date.getTime();
  const diffMin  = Math.floor(diffMs / 60_000);
  const diffH    = Math.floor(diffMs / 3_600_000);
  const diffD    = Math.floor(diffMs / 86_400_000);
  const hhmm     = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diffMin < 1)   return "à l'instant";
  if (diffMin < 60)  return `il y a ${diffMin} min`;
  if (diffH   < 24 && date.toDateString() === new Date(now).toDateString())
                     return `aujourd'hui ${hhmm}`;
  if (diffD   < 2)   return `hier ${hhmm}`;
  if (diffD   < 30)  return `il y a ${diffD} jours`;
  if (diffD   < 365) return `il y a ${Math.floor(diffD / 30)} mois`;
  return fmtDate(d);
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
  "",
  "💡 Astuce : pour répondre à un ticket, utilise simplement la fonction",
  "« Répondre » de Telegram sur la notif — le ticket est détecté tout seul.",
].join("\n");

// deno-lint-ignore no-explicit-any
type Sb = ReturnType<typeof createClient<any, any, any>>;

async function cmdStats(sb: Sb): Promise<string> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const since = todayStart.toISOString();

  // - deleted_at IS NULL : on ne compte pas les devis/factures supprimés
  //   le même jour (sinon le chiffre est gonflé par des tests/erreurs).
  // - Factures "émises" = locked=true (la facture a quitté le statut
  //   brouillon, cf. trigger migration 0009). Une facture en brouillon
  //   n'est pas encore envoyée au client.
  // - "Devis envoyés/signés" : on remonte aussi un signal d'activité commerciale
  //   réelle, pas juste de la frappe en brouillon.
  const [signups, devisCreated, devisSent, invoicesIssued, openTickets, awaitingTickets, activeUsers] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
    sb.from("devis").select("id", { count: "exact", head: true })
      .gte("created_at", since).is("deleted_at", null),
    sb.from("devis").select("id", { count: "exact", head: true })
      .gte("created_at", since).is("deleted_at", null).in("statut", ["envoye", "en_signature", "accepte"]),
    sb.from("invoices").select("id", { count: "exact", head: true })
      .gte("created_at", since).is("deleted_at", null).eq("locked", true),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "awaiting_admin"),
    // Utilisateurs réellement actifs aujourd'hui (distinct owners avec
    // au moins une écriture en DB). Plus parlant que "signups" pour
    // sentir la santé du SaaS au jour le jour.
    sb.from("activity_log").select("owner_id").gte("created_at", since),
  ]);

  const dau = new Set((activeUsers.data || []).map((r: { owner_id: string | null }) => r.owner_id).filter(Boolean)).size;

  return [
    "📊 <b>Résumé du jour</b>",
    `Inscriptions : <b>${signups.count ?? 0}</b>`,
    `Utilisateurs actifs : <b>${dau}</b>`,
    `Devis créés : <b>${devisCreated.count ?? 0}</b> (dont <b>${devisSent.count ?? 0}</b> envoyés)`,
    `Factures émises : <b>${invoicesIssued.count ?? 0}</b>`,
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
  // - deleted_at IS NULL → on ne compte pas les devis/factures supprimés
  //   (sinon le compteur ne correspond pas à ce que l'utilisateur voit dans son app).
  // - Dernière activité = max(activity_log.created_at). Plus fiable que
  //   `auth.users.last_sign_in_at` qui ne bouge qu'à un vrai login alors
  //   que les sessions PWA tiennent des semaines via refresh tokens.
  const [devis, invoices, lastAct, issued] = await Promise.all([
    sb.from("devis").select("id", { count: "exact", head: true })
      .eq("owner_id", authUser.id).is("deleted_at", null),
    sb.from("invoices").select("id", { count: "exact", head: true })
      .eq("owner_id", authUser.id).is("deleted_at", null),
    sb.from("activity_log").select("created_at")
      .eq("owner_id", authUser.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("invoices").select("id", { count: "exact", head: true })
      .eq("owner_id", authUser.id).is("deleted_at", null).eq("locked", true),
  ]);

  // Fallback : si activity_log est vide (compte tout récent ou avant
  // migration 0012), on retombe sur le last_sign_in_at auth.
  const lastActivityAt = lastAct?.data?.created_at || authUser.last_sign_in_at;

  const lines = [
    `👤 <b>${escapeHtml(email)}</b>`,
    profile?.company_name ? `Entreprise : ${escapeHtml(profile.company_name)}` : "",
    `Plan : <b>${escapeHtml(profile?.plan ?? "free")}</b>`,
    `Inscrit le : ${fmtDate(authUser.created_at)}`,
    `Dernière activité : <b>${fmtRelTime(lastActivityAt)}</b>`,
    "",
    `Devis : <b>${devis.count ?? 0}</b>  ·  Factures : <b>${issued.count ?? 0}</b> émises / <b>${invoices.count ?? 0}</b> total`,
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

  // Le ticket_id peut être l'UUID complet ou son préfixe (8 chars) renvoyé par
  // /tickets et les notifs. On ne peut PAS faire .like() sur une colonne uuid
  // (PostgREST refuse), donc on borne par gte/lte sur les UUIDs équivalents :
  //   préfixe "bd87d1e5" → de "bd87d1e5-0000-...-0..0" à "bd87d1e5-ffff-...-f..f".
  const lo = uuidPrefixBoundary(idPart, "0");
  const hi = uuidPrefixBoundary(idPart, "f");
  if (!lo || !hi) return `ID invalide : <code>${escapeHtml(idPart)}</code>`;

  const r = await sb.from("support_tickets")
    .select("id, status")
    .gte("id", lo)
    .lte("id", hi)
    .limit(2);
  if (r.error) return `Erreur recherche : ${escapeHtml(r.error.message)}`;
  if (r.data && r.data.length > 1) return "Préfixe ambigu — utilise l'UUID complet.";
  const ticket = r.data?.[0];
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

// Construit la borne basse ("0") ou haute ("f") d'un UUID à partir d'un préfixe
// (avec ou sans tirets). Renvoie null si le préfixe n'est pas hex valide ou
// dépasse 32 caractères de contenu.
function uuidPrefixBoundary(prefix: string, fill: "0" | "f"): string | null {
  const clean = prefix.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean) || clean.length > 32) return null;
  const padded = clean.padEnd(32, fill);
  return `${padded.slice(0,8)}-${padded.slice(8,12)}-${padded.slice(12,16)}-${padded.slice(16,20)}-${padded.slice(20,32)}`;
}

// Extrait un ticket_id (UUID complet ou préfixe 8 chars) d'un message de notif.
// La notif contient toujours "/reply <id>" en clair → on s'appuie dessus.
function extractTicketIdFromNotif(text: string | null | undefined): string | null {
  if (!text) return null;
  // Cherche /reply suivi d'un UUID complet (avec tirets) ou d'un préfixe hex.
  const m = text.match(/\breply\s+([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9a-f]{8,32})\b/i);
  return m ? m[1].toLowerCase() : null;
}

// ─── Handler principal ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Telegram envoie POST exclusivement.
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Fail-fast si une variable d'env critique est absente OU mal formée.
  // On répond 200 pour que Telegram n'enchaîne pas les retries (le webhook
  // reste enregistré côté Telegram, mais on ignore le payload).
  // ⚠ On valide AVANT toute autre logique pour qu'aucune comparaison ne
  // puisse retomber sur des chaînes vides ("" === "" = true).
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID_VALID) {
    console.error("[telegram-bot] env Telegram manquante ou invalide (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID)");
    return new Response("misconfigured", { status: 200 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[telegram-bot] env Supabase manquante");
    return new Response("misconfigured", { status: 200 });
  }
  if (!TELEGRAM_WEBHOOK_SECRET) {
    console.error("[telegram-bot] TELEGRAM_WEBHOOK_SECRET manquant — webhook non sécurisé");
    return new Response("misconfigured", { status: 200 });
  }

  // Auth 1 : secret token Telegram (comparaison stricte, secret non-vide garanti ci-dessus).
  const provided = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (provided !== TELEGRAM_WEBHOOK_SECRET) {
    console.warn("[telegram-bot] secret token invalide");
    return new Response("forbidden", { status: 403 });
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
  // chatId vide → reject (évite "" === "" si TELEGRAM_CHAT_ID l'était aussi,
  // bien que la validation au boot l'interdise déjà).
  const chatId = String(message.chat?.id ?? "");
  if (!chatId || chatId !== TELEGRAM_CHAT_ID) {
    console.warn("[telegram-bot] chat_id non autorisé:", chatId);
    // On répond quand même 200 pour que Telegram n'enchaîne pas les retries.
    return new Response(JSON.stringify({ ok: true, ignored: "chat_id" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Reply natif Telegram ─────────────────────────────────────────────────
  // Si l'admin utilise la fonction "Répondre" de Telegram sur une notif de
  // ticket, on extrait le ticket_id du message original et on traite le texte
  // de réponse comme contenu de /reply. UX : aucun copier-coller d'UUID.
  // deno-lint-ignore no-explicit-any
  const replyTo: any = message.reply_to_message;
  const cmd = parseCommand(message.text);
  if (replyTo && !cmd) {
    const ticketId = extractTicketIdFromNotif(replyTo.text);
    if (ticketId) {
      let reply = "";
      try {
        reply = await cmdReply(sb, `${ticketId} ${message.text}`);
      } catch (err) {
        console.error("[telegram-bot] reply-to error:", err);
        reply = `❌ Erreur : ${escapeHtml(err instanceof Error ? err.message : String(err))}`;
      }
      await sendMessage(chatId, reply);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  }

  if (!cmd) {
    await sendMessage(chatId, "Tape /help pour voir les commandes.");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

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
