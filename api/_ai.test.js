import { describe, it, expect } from "vitest";
import { buildMistralBody, promptCacheKey, mistralToAnthropic, pipeMistralStream } from "./_ai.js";

describe("_ai — cache de prompt Mistral", () => {
  it("même début de prompt système → même prompt_cache_key, quelle que soit la fin", () => {
    const head = "RÈGLES COMMUNES ".repeat(400); // > 4000 caractères
    const a = buildMistralBody({ system: head + "Métiers : Maçonnerie", messages: [], max_tokens: 10 });
    const b = buildMistralBody({ system: head + "Métiers : Coiffure",   messages: [], max_tokens: 10 });
    expect(a.prompt_cache_key).toMatch(/^zenbat-[0-9a-f]+$/);
    expect(a.prompt_cache_key).toBe(b.prompt_cache_key);
  });

  it("prompts différents dès le début → clés différentes, pas de clé sans system", () => {
    expect(promptCacheKey("Agent devis")).not.toBe(promptCacheKey("Support"));
    expect(buildMistralBody({ messages: [], max_tokens: 10 }).prompt_cache_key).toBeUndefined();
  });

  it("remonte les tokens servis depuis le cache (réponse non-streamée)", () => {
    const msg = mistralToAnthropic({
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 14000, completion_tokens: 900, prompt_tokens_details: { cached_tokens: 11968 } },
    });
    expect(msg.usage).toEqual({ input_tokens: 14000, output_tokens: 900, cache_read_input_tokens: 11968 });
  });

  it("remonte les tokens servis depuis le cache (flux SSE)", async () => {
    const enc = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":14000,"completion_tokens":5,"prompt_tokens_details":{"cached_tokens":11968}}}\n\n',
      "data: [DONE]\n\n",
    ].map(c => enc.encode(c));
    const upstream = { body: { getReader: () => ({ read: async () => chunks.length ? { done: false, value: chunks.shift() } : { done: true } }) } };
    const res = { write: () => {}, flush: () => {} };
    const out = await pipeMistralStream(upstream, res);
    expect(out).toEqual({ inputTokens: 14000, outputTokens: 5, cachedInputTokens: 11968 });
  });
});
