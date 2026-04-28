import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  streamClaude,
  requestClaude,
  visibleText,
  ClaudeApiError,
} from "./stream.js";

// Helper pour fabriquer un Response qui pipe une suite de chunks SSE
function sseResponse(chunks, { ok = true, status = 200 } = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return { ok, status, body: stream, json: async () => null };
}

describe("visibleText", () => {
  it("retourne le texte tel quel s'il n'y a pas de balise <DEVIS>", () => {
    expect(visibleText("Bonjour, voici un texte.")).toBe("Bonjour, voici un texte.");
  });

  it("retourne uniquement la partie avant <DEVIS>", () => {
    expect(visibleText("Voici un devis :\n<DEVIS>{...}</DEVIS>")).toBe("Voici un devis :");
  });

  it("retourne une chaîne vide si <DEVIS> est au début", () => {
    expect(visibleText("<DEVIS>{...}")).toBe("");
  });

  it("trim les espaces et sauts de ligne", () => {
    expect(visibleText("   bonjour   ")).toBe("bonjour");
  });
});

describe("ClaudeApiError", () => {
  it("est une instance d'Error avec name 'ClaudeApiError'", () => {
    const err = new ClaudeApiError("oops");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ClaudeApiError");
    expect(err.message).toBe("oops");
  });
});

describe("requestClaude", () => {
  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("renvoie le texte sur réponse OK", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: "Hello" }] }),
    });
    const out = await requestClaude({ body: { model: "x" }, authHeaders: {} });
    expect(out).toBe("Hello");
  });

  it("renvoie une chaîne vide si la réponse n'a pas de content", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    expect(await requestClaude({ body: {}, authHeaders: {} })).toBe("");
  });

  it("lance ClaudeApiError quand error est une string", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Limite journalière atteinte" }),
    });
    let caught;
    try { await requestClaude({ body: {}, authHeaders: {} }); }
    catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ClaudeApiError);
    expect(caught.message).toBe("Limite journalière atteinte");
  });

  it("lance ClaudeApiError avec error.message si error est un objet", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "boom" } }),
    });
    await expect(requestClaude({ body: {}, authHeaders: {} }))
      .rejects.toThrow("boom");
  });

  it("fallback sur HTTP <status> si le body est illisible", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => { throw new Error("bad json"); },
    });
    await expect(requestClaude({ body: {}, authHeaders: {} }))
      .rejects.toThrow("HTTP 502");
  });

  it("transmet les authHeaders dans la requête fetch", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: "ok" }] }),
    });
    await requestClaude({
      body: { model: "x" },
      authHeaders: { Authorization: "Bearer abc" },
    });
    const call = global.fetch.mock.calls[0];
    expect(call[1].headers.Authorization).toBe("Bearer abc");
    expect(call[1].headers["Content-Type"]).toBe("application/json");
  });
});

describe("streamClaude", () => {
  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("lance ClaudeApiError quand la réponse est non-OK", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "fail" }),
    });
    await expect(streamClaude({ body: {}, authHeaders: {}, onTextDelta: () => {} }))
      .rejects.toThrow(ClaudeApiError);
  });

  it("accumule les deltas et invoque onTextDelta à chaque chunk", async () => {
    const chunks = [
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Bon"}}\n\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"jour"}}\n\n',
      'data: [DONE]\n\n',
    ];
    global.fetch.mockResolvedValueOnce(sseResponse(chunks));
    const deltas = [];
    const raw = await streamClaude({
      body: {}, authHeaders: {},
      onTextDelta: (d, accum) => deltas.push({ d, accum }),
    });
    expect(raw).toBe("Bonjour");
    expect(deltas).toEqual([
      { d: "Bon",  accum: "Bon" },
      { d: "jour", accum: "Bonjour" },
    ]);
  });

  it("ignore les events autres que content_block_delta", async () => {
    const chunks = [
      'data: {"type":"message_start"}\n\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"X"}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ];
    global.fetch.mockResolvedValueOnce(sseResponse(chunks));
    const raw = await streamClaude({ body: {}, authHeaders: {}, onTextDelta: () => {} });
    expect(raw).toBe("X");
  });

  it("lance ClaudeApiError quand un event 'error' arrive en cours de stream", async () => {
    const chunks = [
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"avant"}}\n\n',
      'data: {"type":"error","error":{"message":"overloaded"}}\n\n',
    ];
    global.fetch.mockResolvedValueOnce(sseResponse(chunks));
    await expect(streamClaude({ body: {}, authHeaders: {}, onTextDelta: () => {} }))
      .rejects.toThrow("overloaded");
  });

  it("ignore les lignes JSON mal formées sans interrompre le stream", async () => {
    const chunks = [
      'data: pas-du-json\n\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\n',
    ];
    global.fetch.mockResolvedValueOnce(sseResponse(chunks));
    const raw = await streamClaude({ body: {}, authHeaders: {}, onTextDelta: () => {} });
    expect(raw).toBe("ok");
  });

  it("envoie stream:true dans le body de la requête", async () => {
    global.fetch.mockResolvedValueOnce(sseResponse(['data: [DONE]\n\n']));
    await streamClaude({ body: { model: "x" }, authHeaders: {}, onTextDelta: () => {} });
    const sent = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(sent.stream).toBe(true);
    expect(sent.model).toBe("x");
  });
});
