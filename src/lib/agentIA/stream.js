// Erreur typée pour distinguer une vraie erreur API Anthropic d'un problème
// réseau / SSE — utile pour décider si un fallback non-streamé est pertinent.
export class ClaudeApiError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "ClaudeApiError";
    this.status = status;
  }
}

async function readApiError(res) {
  const detail = await res.json().catch(() => null);
  const errVal = detail?.error;
  return typeof errVal === "string"
    ? errVal
    : (errVal?.message || detail?.message || `HTTP ${res.status}`);
}

// Détecte un rate limit Anthropic (429 ou message qui mentionne "rate limit" /
// "tokens per minute"). Le proxy /api/claude renvoie 429 dans les deux cas
// (limite journalière interne ou limite Anthropic propagée).
function isRateLimit(status, message) {
  if (status === 429) return true;
  return /rate.?limit|tokens per minute|too many requests/i.test(message || "");
}

// Lit le retry-after en secondes (ou 5s par défaut, plafonné à 20s pour ne
// pas faire poireauter l'utilisateur indéfiniment).
function readRetryAfterMs(res, fallbackSec = 5) {
  const raw = res?.headers?.get?.("retry-after");
  const sec = raw ? Number(raw) : NaN;
  const safe = Number.isFinite(sec) && sec > 0 ? Math.min(sec, 20) : fallbackSec;
  return safe * 1000;
}

// Streaming SSE : appelle /api/claude en mode stream et invoque onTextDelta
// à chaque chunk de texte reçu. Renvoie le texte brut complet accumulé.
// Lance ClaudeApiError si Anthropic répond une erreur, Error sinon (réseau/SSE).
// Retry auto une fois sur rate limit Anthropic (cap tokens/min de l'org)
// — sauf si c'est la limite journalière interne (irrécupérable).
export async function streamClaude({ body, authHeaders, onTextDelta }) {
  let res = await fetch("/api/claude", {
    method:  "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body:    JSON.stringify({ ...body, stream: true }),
  });
  if (!res.ok) {
    const msg = await readApiError(res);
    if (isRateLimit(res.status, msg) && !/journalière/i.test(msg)) {
      await new Promise(r => setTimeout(r, readRetryAfterMs(res)));
      res = await fetch("/api/claude", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body:    JSON.stringify({ ...body, stream: true }),
      });
      if (!res.ok) throw new ClaudeApiError(await readApiError(res), { status: res.status });
    } else {
      throw new ClaudeApiError(msg, { status: res.status });
    }
  }
  if (!res.body) throw new Error("no response body");

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const event = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let msg;
        try { msg = JSON.parse(payload); } catch { continue; }
        if (msg.type === "content_block_delta" && msg.delta?.type === "text_delta") {
          const delta = msg.delta.text || "";
          raw += delta;
          if (delta) onTextDelta?.(delta, raw);
        } else if (msg.type === "error") {
          throw new ClaudeApiError(msg.error?.message || "Erreur Anthropic");
        }
      }
    }
  }
  return raw;
}

// Appel non-streamé à /api/claude (utilisé en fallback quand le streaming
// échoue pour des raisons réseau/SSE, et pour la boucle de cohérence).
// Retry auto une fois sur rate limit Anthropic — sauf limite journalière interne.
export async function requestClaude({ body, authHeaders }) {
  const doFetch = () => fetch("/api/claude", {
    method:  "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body:    JSON.stringify(body),
  });
  let res = await doFetch();
  let data = await res.json().catch(() => null);
  if (!res.ok) {
    const errVal = data?.error;
    const msg = typeof errVal === "string"
      ? errVal
      : (errVal?.message || data?.message || `HTTP ${res.status}`);
    if (isRateLimit(res.status, msg) && !/journalière/i.test(msg)) {
      await new Promise(r => setTimeout(r, readRetryAfterMs(res)));
      res = await doFetch();
      data = await res.json().catch(() => null);
      if (!res.ok) {
        const errVal2 = data?.error;
        const msg2 = typeof errVal2 === "string"
          ? errVal2
          : (errVal2?.message || data?.message || `HTTP ${res.status}`);
        throw new ClaudeApiError(msg2, { status: res.status });
      }
    } else {
      throw new ClaudeApiError(msg, { status: res.status });
    }
  }
  return (data?.content?.[0]?.text || "").toString();
}

// Renvoie la portion "visible" du texte brut : tout ce qui précède la balise
// <DEVIS>. Utilisé pour afficher progressivement le message de l'IA pendant
// le streaming sans laisser fuiter le JSON brut.
export function visibleText(raw) {
  const cut = raw.indexOf("<DEVIS>");
  return (cut >= 0 ? raw.slice(0, cut) : raw).trim();
}
