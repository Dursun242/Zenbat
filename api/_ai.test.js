import { describe, it, expect } from "vitest";
import { buildMistralBody, mistralToAnthropic, pipeMistralStream } from "./_ai.js";

describe("_ai — cache de prompt Mistral", () => {
  it("n'envoie pas de prompt_cache_key (rejeté en prod le 2026-10-27)", () => {
    const body = buildMistralBody({ system: "Agent devis", messages: [], max_tokens: 10 });
    expect(body.prompt_cache_key).toBeUndefined();
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
