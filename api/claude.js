import { cors } from "./_cors.js";
import { authenticate } from "./_withAuth.js";

const ALLOWED_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
];

const MAX_SYSTEM_CHARS   = 80_000;
const MAX_MESSAGES_CHARS = 40_000;
const STREAM_TIMEOUT_MS  = 55_000;
const MS_PER_DAY         = 86_400_000;
const AI_LIMIT_FREE      = 40;
const AI_LIMIT_PRO       = 200;
const TRIAL_DAYS_DEFAULT = 30;

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

  const accountAgeDays = Math.floor(
    (Date.now() - new Date(user.created_at).getTime()) / MS_PER_DAY
  );
  if (effectivePlan === "free" && accountAgeDays >= TRIAL_DAYS_DEFAULT) {
    return res.status(403).json({ error: "Période d'essai expirée" });
  }

  const AI_DAILY_LIMIT = effectivePlan === "pro" ? AI_LIMIT_PRO : AI_LIMIT_FREE;
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count: callsToday } = await admin.from("ia_conversations")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .gte("created_at", todayStart.toISOString());

  if ((callsToday || 0) >= AI_DAILY_LIMIT) {
    return res.status(429).json({
      error: `Limite journalière atteinte (${AI_DAILY_LIMIT} appels/jour). Réessayez demain.`,
    });
  }

  // ── Clé Anthropic ────────────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_KEY)
    return res.status(500).json({ error: "ANTHROPIC_KEY non configurée côté serveur" });

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
