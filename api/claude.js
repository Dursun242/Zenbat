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

  const { model, max_tokens, messages, system, stream } = req.body || {};
  if (!model || typeof model !== "string")
    return res.status(400).json({ error: "Paramètre 'model' manquant ou invalide" });
  if (!max_tokens || typeof max_tokens !== "number" || max_tokens < 1 || max_tokens > 8000)
    return res.status(400).json({ error: "Paramètre 'max_tokens' invalide (1–8000)" });
  if (!Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: "Paramètre 'messages' manquant ou vide" });

  const payload = { model, max_tokens, messages };
  if (system && typeof system === "string") payload.system = system;
  if (stream === true) payload.stream = true;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
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

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: "Upstream Anthropic unreachable" });
  }
}
