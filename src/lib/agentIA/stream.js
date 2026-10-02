// Erreur typée pour distinguer une vraie erreur API Anthropic d'un problème
// réseau / SSE — utile pour décider si un fallback non-streamé est pertinent.
export class ClaudeApiError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "ClaudeApiError";
    this.status = status;
  }
}

// Wrapper fetch avec retry réseau silencieux sur TypeError « Failed to fetch »
// ou AbortError. Ne retry QUE l'aller du fetch initial — pas le streaming
// déjà commencé (on aurait alors un doublon de génération côté Anthropic).
// Mesure la durée totale pour distinguer un timeout (long) d'un blip réseau
// (instantané) dans les logs admin.
async function fetchWithNetworkRetry(url, init, { retries = 1, retryDelayMs = 1200 } = {}) {
  const t0 = Date.now();
  let attempts = 0;
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    attempts += 1;
    try {
      const res = await fetch(url, init);
      res._zb = { durationMs: Date.now() - t0, attempts };
      return res;
    } catch (err) {
      lastErr = err;
      const isNetwork = err?.name === "TypeError" || err?.name === "AbortError";
      if (!isNetwork || i >= retries) break;
      await new Promise(r => setTimeout(r, retryDelayMs));
    }
  }
  if (lastErr) {
    lastErr.durationMs = Date.now() - t0;
    lastErr.attempts = attempts;
  }
  throw lastErr;
}

// Modèle réellement servi par /api/claude (en-tête X-AI-Model : Mistral ou
// Claude selon la config serveur). Sert à journaliser ia_conversations.model
// avec la vérité serveur plutôt qu'avec la constante CLAUDE_MODEL du front.
let lastServedModel = null;
export function getLastServedModel() {
  return lastServedModel;
}
function rememberServedModel(res) {
  const m = res?.headers?.get?.("x-ai-model");
  if (m) lastServedModel = m;
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

// Nouvelles tentatives sur rate limit fournisseur (Mistral surtout : limite
// par minute vite atteinte) : 3 essais supplémentaires, délai croissant
// (Retry-After s'il est fourni, sinon 4 s, 8 s, 16 s). Jamais pour la
// limite journalière interne (irrécupérable).
export const RATE_LIMIT_RETRIES = 3;
export async function fetchWithRateLimitRetry(doFetch, { retries = RATE_LIMIT_RETRIES, sleep = (ms) => new Promise(r => setTimeout(r, ms)) } = {}) {
  let res = await doFetch();
  for (let attempt = 0; attempt < retries && res.status === 429; attempt++) {
    // Lecture sur une copie : l'appelant lit encore le corps de la réponse finale
    const msg = await readApiError(res.clone ? res.clone() : res);
    if (/journalière/i.test(msg)) break;
    await sleep(readRetryAfterMs(res, 4 * 2 ** attempt));
    res = await doFetch();
  }
  return res;
}

// Streaming SSE : appelle /api/claude en mode stream et invoque onTextDelta
// à chaque chunk de texte reçu. Renvoie le texte brut complet accumulé.
// Lance ClaudeApiError si Anthropic répond une erreur, Error sinon (réseau/SSE).
// Nouvelles tentatives sur rate limit (fetchWithRateLimitRetry) — sauf si
// c'est la limite journalière interne (irrécupérable).
export async function streamClaude({ body, authHeaders, onTextDelta }) {
  const res = await fetchWithRateLimitRetry(() => fetchWithNetworkRetry("/api/claude", {
    method:  "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body:    JSON.stringify({ ...body, stream: true }),
  }));
  if (!res.ok) throw new ClaudeApiError(await readApiError(res), { status: res.status });
  rememberServedModel(res);
  if (!res.body) throw new Error("no response body");

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let buffer = "";
  // Anthropic termine toujours un stream sain par un event `message_stop`.
  // S'il manque, le flux a été coupé en route (upstream, Vercel, réseau
  // mobile, onglet passé en arrière-plan sur iOS…) et `raw` est tronqué —
  // typiquement « <DE » quand la coupure survient sur les premiers tokens.
  let complete = false;
  const t0 = Date.now();

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
        if (!payload) continue;
        if (payload === "[DONE]") { complete = true; continue; }
        let msg;
        try { msg = JSON.parse(payload); } catch { continue; }
        if (msg.type === "content_block_delta" && msg.delta?.type === "text_delta") {
          const delta = msg.delta.text || "";
          raw += delta;
          if (delta) onTextDelta?.(delta, raw);
        } else if (msg.type === "message_stop") {
          complete = true;
        } else if (msg.type === "stream_aborted") {
          // Émis par /api/claude quand SA lecture du flux Anthropic a échoué.
          // Erreur « réseau » (pas ClaudeApiError) → l'appelant retombe sur
          // le mode non-streamé au lieu d'afficher un message tronqué.
          throw markIncomplete(new Error(`stream-aborted: ${msg.message || "upstream"}`), raw, t0);
        } else if (msg.type === "error") {
          throw new ClaudeApiError(msg.error?.message || "Erreur Anthropic");
        }
      }
    }
  }
  if (!complete) throw markIncomplete(new Error("stream-incomplete"), raw, t0);
  return raw;
}

function markIncomplete(err, raw, t0) {
  err.partialRaw  = raw;
  err.partialLen  = raw.length;
  err.durationMs  = Date.now() - t0;
  return err;
}

// Appel non-streamé à /api/claude (utilisé en fallback quand le streaming
// échoue pour des raisons réseau/SSE, et pour la boucle de cohérence).
// Nouvelles tentatives sur rate limit (fetchWithRateLimitRetry) — sauf limite journalière interne.
export async function requestClaude({ body, authHeaders }) {
  const doFetch = () => fetchWithNetworkRetry("/api/claude", {
    method:  "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body:    JSON.stringify(body),
  });
  const res = await fetchWithRateLimitRetry(doFetch);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errVal = data?.error;
    const msg = typeof errVal === "string"
      ? errVal
      : (errVal?.message || data?.message || `HTTP ${res.status}`);
    throw new ClaudeApiError(msg, { status: res.status });
  }
  rememberServedModel(res);
  return (data?.content?.[0]?.text || "").toString();
}

const DEVIS_TAG = "<DEVIS>";

// Renvoie la portion "visible" du texte brut : tout ce qui précède la balise
// <DEVIS>. Utilisé pour afficher progressivement le message de l'IA pendant
// le streaming sans laisser fuiter le JSON brut.
// Masque aussi un début de balise en suspens en fin de texte (« < », « <DE »,
// « <DEVIS ») : pendant le streaming la balise arrive token par token, et un
// flux coupé à cet endroit laissait « <DE » affiché tel quel à l'utilisateur.
export function visibleText(raw) {
  const cut = raw.indexOf(DEVIS_TAG);
  let text = cut >= 0 ? raw.slice(0, cut) : raw;
  if (cut < 0) {
    for (let k = DEVIS_TAG.length - 1; k >= 1; k--) {
      if (text.endsWith(DEVIS_TAG.slice(0, k))) { text = text.slice(0, -k); break; }
    }
  }
  return text.trim();
}
