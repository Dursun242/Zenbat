// Couche fournisseur IA pour /api/claude.
//
// Le front parle exclusivement le format Anthropic Messages (réponse
// `content[0].text`, SSE `content_block_delta` / `message_stop`). Pour pouvoir
// basculer sur Mistral (moins cher) sans toucher au client, ce module traduit
// requêtes et réponses Mistral (format OpenAI chat/completions) vers ce format.
//
// Sélection du fournisseur :
//   - AI_PROVIDER=mistral|anthropic  → explicite
//   - sinon : Mistral si MISTRAL_API_KEY est posée, Anthropic sinon
// Le modèle Mistral est choisi côté serveur (MISTRAL_MODEL), le `model` Claude
// envoyé par le client est ignoré dans ce cas.

export const MISTRAL_API_URL       = "https://api.mistral.ai/v1/chat/completions";
export const MISTRAL_DEFAULT_MODEL = "mistral-medium-latest";

export function aiProvider() {
  const explicit = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (explicit === "mistral" || explicit === "anthropic") return explicit;
  return process.env.MISTRAL_API_KEY ? "mistral" : "anthropic";
}

// Renvoie le nom de la variable d'env manquante, ou null si la clé est posée.
export function missingAiKey() {
  if (aiProvider() === "mistral") return process.env.MISTRAL_API_KEY ? null : "MISTRAL_API_KEY";
  return process.env.ANTHROPIC_KEY ? null : "ANTHROPIC_KEY";
}

export function mistralModel() {
  return String(process.env.MISTRAL_MODEL || "").trim() || MISTRAL_DEFAULT_MODEL;
}

// Le contenu Anthropic peut être une string ou un tableau de blocs
// ({type:"text", text}). Mistral attend une string.
function flattenContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(b => (typeof b === "string" ? b : b?.text || "")).join("");
  }
  return String(content ?? "");
}

export function buildMistralBody({ model, system, messages, max_tokens, temperature, top_p, stream }) {
  const out = [];
  if (system) out.push({ role: "system", content: flattenContent(system) });
  for (const m of messages || []) {
    out.push({ role: m.role === "assistant" ? "assistant" : "user", content: flattenContent(m.content) });
  }
  const body = { model: model || mistralModel(), messages: out, max_tokens };
  if (typeof temperature === "number") body.temperature = temperature;
  if (typeof top_p === "number")       body.top_p = top_p;
  if (stream === true)                 body.stream = true;
  return body;
}

export function mistralFetchInit(body, signal) {
  return {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal,
  };
}

const STOP_REASONS = { stop: "end_turn", length: "max_tokens", model_length: "max_tokens", tool_calls: "tool_use" };

// Réponse non-streamée Mistral → forme Anthropic Messages.
export function mistralToAnthropic(data) {
  const choice = data?.choices?.[0] || {};
  return {
    id:            data?.id || null,
    type:          "message",
    role:          "assistant",
    model:         data?.model || null,
    content:       [{ type: "text", text: flattenContent(choice.message?.content) }],
    stop_reason:   STOP_REASONS[choice.finish_reason] || choice.finish_reason || null,
    usage: {
      input_tokens:  data?.usage?.prompt_tokens     || 0,
      output_tokens: data?.usage?.completion_tokens || 0,
    },
  };
}

// Erreur Mistral ({message} | {detail: [...]} | …) → { error: { type, message } }.
export function mistralError(data, status) {
  let message = data?.message || data?.error?.message;
  if (!message && data?.detail) {
    message = Array.isArray(data.detail)
      ? data.detail.map(d => d?.msg || JSON.stringify(d)).join(" ; ")
      : String(data.detail);
  }
  if (typeof message !== "string") message = message ? JSON.stringify(message) : `Mistral HTTP ${status}`;
  return { type: "error", error: { type: data?.type || "api_error", message } };
}

function sse(obj) {
  return `event: ${obj.type}\ndata: ${JSON.stringify(obj)}\n\n`;
}

// Lit le flux SSE Mistral et le réémet au client au format SSE Anthropic.
// `message_stop` n'est émis que si Mistral a réellement terminé ([DONE] ou
// finish_reason) : un flux coupé en route reste détecté comme incomplet par
// le client (cf src/lib/agentIA/stream.js). Les erreurs de lecture remontent
// à l'appelant, qui émet `stream_aborted`.
export async function pipeMistralStream(upstream, res) {
  const reader  = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let finished = false;
  let stopReason = null;

  res.write(sse({ type: "message_start", message: { type: "message", role: "assistant", content: [] } }));
  res.write(sse({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }));
  res.flush?.();

  const handleLine = (line) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload) return;
    if (payload === "[DONE]") { finished = true; return; }
    let evt;
    try { evt = JSON.parse(payload); } catch { return; }
    if (evt?.object === "error" || (evt?.message && !evt?.choices)) {
      res.write(sse({ type: "error", error: mistralError(evt, 500).error }));
      return;
    }
    const choice = evt?.choices?.[0];
    const text = flattenContent(choice?.delta?.content ?? "");
    if (text) {
      res.write(sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }));
      res.flush?.();
    }
    if (choice?.finish_reason) {
      finished = true;
      stopReason = STOP_REASONS[choice.finish_reason] || choice.finish_reason;
    }
    if (evt?.usage) {
      inputTokens  = evt.usage.prompt_tokens     || inputTokens;
      outputTokens = evt.usage.completion_tokens || outputTokens;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line.trim());
  }
  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer.trim());

  if (finished) {
    res.write(sse({ type: "content_block_stop", index: 0 }));
    res.write(sse({ type: "message_delta", delta: { stop_reason: stopReason || "end_turn" }, usage: { output_tokens: outputTokens } }));
    res.write(sse({ type: "message_stop" }));
    res.flush?.();
  }
  return { inputTokens, outputTokens };
}

// Appel simple non-streamé (system + un message user) → { text, usage, model }.
// Utilisé par le scraper de sites web, indépendamment du fournisseur.
export async function completeText({ system, user, max_tokens, anthropicModel }) {
  if (aiProvider() === "mistral") {
    const body = buildMistralBody({ system, messages: [{ role: "user", content: user }], max_tokens });
    const resp = await fetch(MISTRAL_API_URL, mistralFetchInit(body));
    const data = await resp.json().catch(() => null);
    if (!resp.ok) throw new Error(mistralError(data, resp.status).error.message);
    const msg = mistralToAnthropic(data);
    return { text: msg.content[0].text, usage: msg.usage, model: body.model };
  }
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: anthropicModel, max_tokens, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Anthropic ${resp.status}`);
  return { text: data.content?.[0]?.text || "", usage: data.usage || null, model: anthropicModel };
}
