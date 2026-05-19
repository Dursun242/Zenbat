import { cors } from "./_cors.js";
import { authenticate } from "./_withAuth.js";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const ALLOWED_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
];

const MAX_SYSTEM_CHARS   = 80_000;
const MAX_MESSAGES_CHARS = 40_000;
const STREAM_TIMEOUT_MS  = 55_000;
const AI_LIMIT_FREE      = 40;
const AI_LIMIT_PRO       = 200;

// ── Scraper de sites web (action scrape_urls) ───────────────────────────────
// Limites volontairement basses pour tenir dans le maxDuration 60s de Vercel
// et garder le coût Claude prévisible. Le batch tourne en parallèle.
const SCRAPE_MAX_URLS         = 5;
const SCRAPE_FETCH_TIMEOUT_MS = 10_000;
const SCRAPE_HTML_MAX_BYTES   = 2_000_000;
const SCRAPE_TEXT_MAX_CHARS   = 20_000;
const SCRAPE_MODEL            = "claude-haiku-4-5-20251001";

const SCRAPE_SYSTEM_PROMPT = `Tu extrais les informations de contact d'un site web professionnel (artisan, entreprise, indépendant).
Renvoie UNIQUEMENT un JSON valide entre <CONTACT></CONTACT>, sans texte autour.
Format strict :
{"type":"particulier|entreprise|artisan","raison_sociale":"","nom":"","prenom":"","email":"","telephone":"","telephone_fixe":"","adresse":"","code_postal":"","ville":"","siret":"","tva_intra":"","activite":""}
Règles :
- "type" : "artisan" pour métiers BTP/bâtiment, "entreprise" pour autres sociétés, "particulier" sinon.
- Numéros français : format "06 XX XX XX XX". Mobile commence par 06/07, fixe par 01-05/09. Si plusieurs numéros, "telephone" = mobile, "telephone_fixe" = fixe.
- Sépare "code_postal" (5 chiffres) de "ville".
- "activite" : description courte (ex : "Maçonnerie générale", "Plomberie chauffage").
- Si un champ est absent ou ambigu, laisse une chaîne vide "".
- Ne devine pas. Si la page ne contient pas d'info contact claire, tous les champs vides.`;

// IP privées / réservées — protection SSRF. Bloque AWS metadata (169.254.x),
// localhost, RFC1918, link-local, IPv6 ULA/link-local.
function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === "::1" || ip === "::" || ip === "0.0.0.0") return true;
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^0\./.test(ip)) return true;
  if (/^f[cd]/i.test(ip)) return true;
  if (/^fe[89ab]/i.test(ip)) return true;
  return false;
}

async function assertPublicHost(hostname) {
  if (!hostname) throw new Error("Hôte invalide");
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".local") || lower.endsWith(".internal") || lower.endsWith(".localhost")) {
    throw new Error("Domaine interdit");
  }
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("IP privée bloquée");
    return;
  }
  let address;
  try { address = (await lookup(hostname)).address; }
  catch { throw new Error("Domaine introuvable"); }
  if (isPrivateIp(address)) throw new Error("Domaine résout vers une IP privée");
}

function htmlToText(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch  = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
  const desc  = descMatch  ? descMatch[1].replace(/\s+/g, " ").trim()  : "";
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&eacute;/gi, "é").replace(/&egrave;/gi, "è").replace(/&ecirc;/gi, "ê")
    .replace(/&agrave;/gi, "à").replace(/&acirc;/gi, "â").replace(/&ccedil;/gi, "ç")
    .replace(/&ocirc;/gi, "ô").replace(/&ucirc;/gi, "û").replace(/&ugrave;/gi, "ù")
    .replace(/\s+/g, " ")
    .trim();
  const header = [title && `TITRE: ${title}`, desc && `DESCRIPTION: ${desc}`].filter(Boolean).join("\n");
  return (header ? header + "\n\n" : "") + body;
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), SCRAPE_FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":      "Mozilla/5.0 (compatible; ZenbatBot/1.0; +https://zenbat.fr)",
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
      },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("html") && !ct.includes("xml")) throw new Error("Pas une page HTML");
    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let html = "";
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > SCRAPE_HTML_MAX_BYTES) {
        reader.cancel().catch(() => {});
        break;
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

async function scrapeOneUrl(rawUrl, { admin, user }) {
  let urlStr = String(rawUrl || "").trim();
  if (!urlStr) throw new Error("URL vide");
  // Si l'utilisateur a tapé un schéma explicite, on le respecte pour pouvoir
  // rejeter ftp://, file://, javascript:, etc. Sinon on préfixe https://.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(urlStr);
  if (hasScheme && !/^https?:/i.test(urlStr)) throw new Error("Protocole non autorisé");
  if (!hasScheme) urlStr = "https://" + urlStr;
  let u;
  try { u = new URL(urlStr); } catch { throw new Error("URL invalide"); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Protocole non autorisé");
  await assertPublicHost(u.hostname);

  const html = await fetchHtml(u.toString());
  const text = htmlToText(html).slice(0, SCRAPE_TEXT_MAX_CHARS);
  if (!text.trim()) throw new Error("Page vide");

  const startTime = Date.now();
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      SCRAPE_MODEL,
      max_tokens: 800,
      system:     SCRAPE_SYSTEM_PROMPT,
      messages:   [{ role: "user", content: `URL: ${u.toString()}\n\nContenu de la page :\n${text}` }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Anthropic ${resp.status}`);

  if (data?.usage) {
    admin.from("claude_api_logs").insert({
      model:          SCRAPE_MODEL,
      use_case:       "scrape",
      input_tokens:   data.usage.input_tokens  || 0,
      output_tokens:  data.usage.output_tokens || 0,
      latency_ms:     Date.now() - startTime,
      status_code:    200,
      stream_enabled: false,
      user_id:        user.id,
    }).then(() => {}).catch(() => {});
  }

  const raw = data.content?.[0]?.text || "";
  const match = raw.match(/<CONTACT>([\s\S]*?)<\/CONTACT>/) || raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Extraction impossible");
  let parsed;
  try { parsed = JSON.parse((match[1] || match[0]).trim()); }
  catch { throw new Error("JSON invalide"); }
  return { url: u.toString(), contact: parsed };
}

async function handleScrape(res, { urls, admin, user }) {
  if (!Array.isArray(urls) || urls.length === 0)
    return res.status(400).json({ error: "scrape_urls doit être un tableau non vide" });
  if (urls.length > SCRAPE_MAX_URLS)
    return res.status(400).json({ error: `Maximum ${SCRAPE_MAX_URLS} URLs par requête` });
  if (!process.env.ANTHROPIC_KEY)
    return res.status(500).json({ error: "ANTHROPIC_KEY non configurée côté serveur" });

  const results = await Promise.allSettled(urls.map(u => scrapeOneUrl(u, { admin, user })));
  return res.status(200).json({
    results: results.map((r, i) => r.status === "fulfilled"
      ? { url: r.value.url, contact: r.value.contact }
      : { url: String(urls[i] || "").trim(), error: r.reason?.message || String(r.reason || "Erreur") }
    ),
  });
}

export default async function handler(req, res) {
  cors(req, res, { methods: "POST, OPTIONS", auth: true });

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── Auth Supabase ───────────────────────────────────────────────────────────
  const auth = await authenticate(req, res);
  if (!auth) return;
  const { user, admin } = auth;

  // ── Plan + rate limit ────────────────────────────────────────────────────────
  const { data: profile } = await admin.from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (!profile) return res.status(403).json({ error: "Profil introuvable" });

  // L'admin est toujours considéré pro, sans limite ni expiration d'essai.
  const adminEmail = process.env.ADMIN_EMAIL;
  const norm = (s) => String(s || "").trim().toLowerCase();
  const isAdmin = adminEmail && norm(user.email) === norm(adminEmail);
  const effectivePlan = isAdmin ? "pro" : profile.plan;

  const AI_DAILY_LIMIT = effectivePlan === "pro" ? AI_LIMIT_PRO : AI_LIMIT_FREE;
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count: callsToday } = await admin.from("ia_conversations")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .gte("created_at", todayStart.toISOString());

  // L'admin est exempté de toute limite journalière (debug, support, tests).
  if (!isAdmin && (callsToday || 0) >= AI_DAILY_LIMIT) {
    return res.status(429).json({
      error: `Limite journalière atteinte (${AI_DAILY_LIMIT} appels/jour). Réessayez demain.`,
    });
  }

  // ── Clé Anthropic ────────────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_KEY)
    return res.status(500).json({ error: "ANTHROPIC_KEY non configurée côté serveur" });

  // ── Mode scrape (import contacts depuis sites web) ──────────────────────────
  // Détecté via la présence de `scrape_urls`. Court-circuite la validation
  // classique (model/messages/etc.) car le payload est différent.
  if (Array.isArray(req.body?.scrape_urls)) {
    try {
      return await handleScrape(res, { urls: req.body.scrape_urls, admin, user });
    } catch (err) {
      console.error("[claude/scrape]", err?.message || err);
      return res.status(500).json({ error: "Erreur scrape" });
    }
  }

  // ── Validation des paramètres ────────────────────────────────────────────────
  const { model, max_tokens, messages, system, stream, temperature, top_p, support_ticket_id } = req.body || {};

  // Si support_ticket_id est fourni, on est dans le flux SupportChat :
  // Claude joue le rôle de support et sa réponse sera persistée dans support_messages.
  // On valide ici l'appartenance du ticket à l'utilisateur (RLS bypass via service_role).
  let supportTicket = null;
  if (support_ticket_id) {
    if (typeof support_ticket_id !== "string")
      return res.status(400).json({ error: "support_ticket_id invalide" });
    const { data, error: ticketErr } = await admin.from("support_tickets")
      .select("id, status")
      .eq("id", support_ticket_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ticketErr || !data)
      return res.status(403).json({ error: "Ticket support introuvable ou non autorisé" });
    if (data.status === "resolved")
      return res.status(400).json({ error: "Ticket clos — créez-en un nouveau" });
    supportTicket = data;
    // Force le mode non-streamé pour pouvoir capturer la réponse complète et l'insérer en DB.
    if (stream === true)
      return res.status(400).json({ error: "Le streaming n'est pas supporté pour le support" });
  }

  if (!model || typeof model !== "string" || !ALLOWED_MODELS.includes(model))
    return res.status(400).json({ error: "Paramètre 'model' manquant ou non autorisé" });
  if (!max_tokens || typeof max_tokens !== "number" || max_tokens < 1 || max_tokens > 8000)
    return res.status(400).json({ error: "Paramètre 'max_tokens' invalide (1–8000)" });
  if (!Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: "Paramètre 'messages' manquant ou vide" });
  if (temperature !== undefined && (typeof temperature !== "number" || temperature < 0 || temperature > 1))
    return res.status(400).json({ error: "Paramètre 'temperature' invalide (0–1)" });
  if (top_p !== undefined && (typeof top_p !== "number" || top_p < 0 || top_p > 1))
    return res.status(400).json({ error: "Paramètre 'top_p' invalide (0–1)" });

  // Limite de taille pour maîtriser les coûts tokens
  if (system && system.length > MAX_SYSTEM_CHARS)
    return res.status(400).json({ error: `system trop long (max ${MAX_SYSTEM_CHARS} caractères)` });
  const messagesSize = messages.reduce((s, m) => s + String(m.content || "").length, 0);
  if (messagesSize > MAX_MESSAGES_CHARS)
    return res.status(400).json({ error: `messages trop longs (max ${MAX_MESSAGES_CHARS} caractères)` });

  // ── Appel Anthropic ──────────────────────────────────────────────────────────
  const payload = { model, max_tokens, messages };
  if (system && typeof system === "string")
    payload.system = [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
  if (stream === true) payload.stream = true;
  if (typeof temperature === "number") payload.temperature = temperature;
  if (typeof top_p === "number")       payload.top_p = top_p;

  try {
    // 55 s — sous le maxDuration Vercel de 60 s, marge de 5 s pour transmettre
    // la réponse au client. Les T3 multi-lots (rénovation totale, extension)
    // peuvent légitimement prendre 30-50 s à générer.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    let upstream;
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type":        "application/json",
          "x-api-key":           process.env.ANTHROPIC_KEY,
          "anthropic-version":   "2023-06-01",
          "anthropic-beta":      "prompt-caching-2024-07-31",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // ── Streaming SSE ────────────────────────────────────────────────────────
    // IMPORTANT : ne jamais appeler upstream.json() avant de lire upstream.body.
    // json() consomme le ReadableStream — le pipe SSE lirait alors un stream vide.
    if (stream === true) {
      if (upstream.ok) {
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        let inputTokens = 0;
        let outputTokens = 0;
        const startTime = Date.now();

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            res.write(value);
            res.flush?.();

            // Parse SSE events to capture token usage
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const evt = JSON.parse(line.slice(6));
                if (evt.type === "message_start" && evt.message?.usage) {
                  inputTokens  = evt.message.usage.input_tokens  || 0;
                  outputTokens = evt.message.usage.output_tokens || 0;
                } else if (evt.type === "message_delta" && evt.usage) {
                  outputTokens = evt.usage.output_tokens || 0;
                }
              } catch {}
            }
          }
        } catch {
          // client abort ou erreur réseau — on ferme proprement
        }

        // Log token usage (fire-and-forget)
        if (inputTokens > 0 || outputTokens > 0) {
          admin.from("claude_api_logs").insert({
            model,
            use_case:      support_ticket_id ? "support" : "devis",
            input_tokens:  inputTokens,
            output_tokens: outputTokens,
            latency_ms:    Date.now() - startTime,
            status_code:   200,
            stream_enabled: true,
            user_id:       user.id,
          }).then(() => {}).catch(() => {});
        }

        return res.end();
      } else {
        // Erreur Anthropic sur une requête stream : on lit le JSON d'erreur
        const errorData = await upstream.json().catch(() => null);
        return res.status(upstream.status).json(errorData);
      }
    }

    // ── Non-streaming ────────────────────────────────────────────────────────
    const startTime = Date.now();
    const upstreamData = await upstream.json();

    // Log token usage (fire-and-forget)
    if (upstream.ok && upstreamData?.usage) {
      admin.from("claude_api_logs").insert({
        model,
        use_case:      support_ticket_id ? "support" : "devis",
        input_tokens:  upstreamData.usage.input_tokens  || 0,
        output_tokens: upstreamData.usage.output_tokens || 0,
        latency_ms:    Date.now() - startTime,
        status_code:   200,
        stream_enabled: false,
        user_id:       user.id,
      }).then(() => {}).catch(() => {});
    }

    // Persistance support : si on est dans un ticket, on insère la réponse Claude
    // dans support_messages (role='claude'). L'utilisateur a déjà inséré son propre
    // message côté client via RLS avant l'appel.
    if (supportTicket && upstream.ok) {
      const claudeText = upstreamData?.content?.[0]?.text || "";
      if (claudeText.trim()) {
        const { error: insertErr } = await admin.from("support_messages").insert({
          ticket_id: supportTicket.id,
          role:      "claude",
          content:   claudeText.slice(0, 8000),
        });
        if (insertErr) console.error("[claude/support] insert claude msg:", insertErr.message);
      }
    }

    return res.status(upstream.status).json(upstreamData);

  } catch (err) {
    if (err?.name === "AbortError")
      return res.status(504).json({ error: "Délai dépassé — Claude API n'a pas répondu en 55 secondes" });
    return res.status(502).json({ error: "Upstream Anthropic unreachable" });
  }
}
