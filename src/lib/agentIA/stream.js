// Erreur typée pour distinguer une vraie erreur API Anthropic d'un problème
// réseau / SSE — utile pour décider si un fallback non-streamé est pertinent.
export class ClaudeApiError extends Error {
  constructor(message) {
    super(message);
    this.name = "ClaudeApiError";
  }
}

async function readApiError(res) {
  const detail = await res.json().catch(() => null);
  const errVal = detail?.error;
  return typeof errVal === "string"
    ? errVal
    : (errVal?.message || detail?.message || `HTTP ${res.status}`);
}

// Streaming SSE : appelle /api/claude en mode stream et invoque onTextDelta
// à chaque chunk de texte reçu. Renvoie le texte brut complet accumulé.
// Lance ClaudeApiError si Anthropic répond une erreur, Error sinon (réseau/SSE).
export async function streamClaude({ body, authHeaders, onTextDelta }) {
  const res = await fetch("/api/claude", {
    method:  "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body:    JSON.stringify({ ...body, stream: true }),
  });
  if (!res.ok) throw new ClaudeApiError(await readApiError(res));
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
export async function requestClaude({ body, authHeaders }) {
  const res = await fetch("/api/claude", {
    method:  "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body:    JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errVal = data?.error;
    const msg = typeof errVal === "string"
      ? errVal
      : (errVal?.message || data?.message || `HTTP ${res.status}`);
    throw new ClaudeApiError(msg);
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
