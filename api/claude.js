const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

function resolveOrigin(req) {
  const origin = req.headers.origin || "";
  // Pas de wildcard : en prod on whitelist, sinon on reflète l'origine connue.
  if (process.env.VERCEL_ENV !== "production") return origin;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0] || "";
}

// Simple in-memory queue pour logs asynchrones (ne bloque pas la réponse)
const logQueue = [];
let logFlushInterval;

function queueLog(logData) {
  logQueue.push(logData);
  // Flush après 5 secondes ou 10 logs
  if (!logFlushInterval) {
    logFlushInterval = setInterval(flushLogs, 5000);
  }
  if (logQueue.length >= 10) flushLogs();
}

async function flushLogs() {
  if (logQueue.length === 0) return;
  const toFlush = logQueue.splice(0);
  try {
    await fetch("https://api.anthropic.com/v1/messages", { // Placeholder — remplacer par endpoint réel
      // Les logs seront stocker localement ou via un service externe
    }).catch(() => {
      // Silent fail — ne pas bloquer si logging échoue
    });
  } catch {}
}

export default async function handler(req, res) {
  const origin = resolveOrigin(req);
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.ANTHROPIC_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_KEY non configurée côté serveur" });
  }

  const { model, max_tokens, messages, system, stream, temperature, top_p } = req.body || {};
  if (!model || typeof model !== "string")
    return res.status(400).json({ error: "Paramètre 'model' manquant ou invalide" });
  if (!max_tokens || typeof max_tokens !== "number" || max_tokens < 1 || max_tokens > 8000)
    return res.status(400).json({ error: "Paramètre 'max_tokens' invalide (1–8000)" });
  if (!Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: "Paramètre 'messages' manquant ou vide" });
  if (temperature !== undefined && (typeof temperature !== "number" || temperature < 0 || temperature > 1))
    return res.status(400).json({ error: "Paramètre 'temperature' invalide (0–1)" });
  if (top_p !== undefined && (typeof top_p !== "number" || top_p < 0 || top_p > 1))
    return res.status(400).json({ error: "Paramètre 'top_p' invalide (0–1)" });

  const payload = { model, max_tokens, messages };
  if (system && typeof system === "string") payload.system = system;
  if (stream === true) payload.stream = true;
  if (typeof temperature === "number") payload.temperature = temperature;
  if (typeof top_p === "number")       payload.top_p = top_p;

  const startTime = Date.now();
  const isDevise = system?.includes("DEVIS") ? "devis" : system?.includes("contact") ? "contact" : null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);

    let upstream;
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - startTime;
    const upstreamData = await upstream.json();
    const inputTokens = upstreamData?.usage?.input_tokens;
    const outputTokens = upstreamData?.usage?.output_tokens;

    // Log asynchrone (ne bloque pas)
    queueLog({
      model,
      use_case: isDevise,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      latency_ms: latencyMs,
      status_code: upstream.status,
      error_message: upstream.ok ? null : upstreamData?.error?.message,
      stream_enabled: stream === true,
    });

    if (stream === true && upstream.ok && upstream.body) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          res.write(value);
          res.flush?.();
        }
      } catch {
        // client abort or upstream error — end cleanly
      }
      return res.end();
    }

    return res.status(upstream.status).json(upstreamData);
  } catch (err) {
    const latencyMs = Date.now() - startTime;

    // Log l'erreur
    queueLog({
      model,
      use_case: isDevise,
      input_tokens: null,
      output_tokens: null,
      latency_ms: latencyMs,
      status_code: err?.name === "AbortError" ? 504 : 502,
      error_message: err?.message || "Unknown error",
      stream_enabled: stream === true,
    });

    if (err?.name === "AbortError") {
      return res.status(504).json({ error: "Délai dépassé — Claude API n'a pas répondu en 28 secondes" });
    }
    return res.status(502).json({ error: "Upstream Anthropic unreachable" });
  }
}
