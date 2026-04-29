import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────
const getUserMock = vi.fn();
const fromMock    = vi.fn();
let supabaseChain;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("./_cors.js", () => ({ cors: () => {} }));

import handler from "./claude.js";

function makeRes() {
  return {
    statusCode: 0,
    body:       null,
    headers:    {},
    status(c) { this.statusCode = c; return this; },
    json(b)   { this.body = b;        return this; },
    end()     { return this; },
    setHeader(k, v) { this.headers[k] = v; },
    flushHeaders() {},
    flush() {},
    write() {},
  };
}

function makeReq({ method = "POST", headers = {}, body = null } = {}) {
  return { method, headers, body };
}

const ENV_KEYS = ["SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_KEY", "ADMIN_EMAIL"];
let snap;

function setupSupabaseProfile(plan = "free", callsToday = 0) {
  // Chain for `.from("profiles").select("plan").eq("id", id).single()`
  // and `.from("ia_conversations").select("id", {...}).eq().gte()` (returns count)
  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { plan }, error: null }),
  };
  const countChain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    gte:    vi.fn().mockResolvedValue({ count: callsToday, error: null }),
  };
  fromMock.mockImplementation((table) => {
    if (table === "profiles")        return profileChain;
    if (table === "ia_conversations") return countChain;
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
  });
  return { profileChain, countChain };
}

beforeEach(() => {
  snap = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  process.env.SUPABASE_URL              = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.ANTHROPIC_KEY             = "sk-ant-test";

  global.fetch = vi.fn();
  vi.clearAllMocks();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else                        process.env[k] = snap[k];
  }
  vi.restoreAllMocks();
});

describe("claude endpoint — méthodes & auth", () => {
  it("répond 204 sur OPTIONS", async () => {
    const res = makeRes();
    await handler(makeReq({ method: "OPTIONS" }), res);
    expect(res.statusCode).toBe(204);
  });

  it("refuse les méthodes != POST", async () => {
    const res = makeRes();
    await handler(makeReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
  });

  it("renvoie 401 si pas de token", async () => {
    const res = makeRes();
    await handler(makeReq({ headers: {} }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/Non authentifié/);
  });

  it("renvoie 500 si Supabase n'est pas configuré", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer t" } }), res);
    expect(res.statusCode).toBe(500);
  });

  it("renvoie 401 si le token est invalide", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: { message: "bad" } });
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer t" } }), res);
    expect(res.statusCode).toBe(401);
  });
});

describe("claude endpoint — plan, trial, rate-limit", () => {
  function authedUser({ id = "u1", email = "user@example.com", created_at = new Date().toISOString() } = {}) {
    getUserMock.mockResolvedValueOnce({ data: { user: { id, email, created_at } }, error: null });
  }

  it("renvoie 403 si le profil n'existe pas", async () => {
    authedUser();
    fromMock.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer t" } }), res);
    expect(res.statusCode).toBe(403);
  });

  it("renvoie 403 si la période d'essai est expirée (free + > 30j)", async () => {
    const oldDate = new Date(Date.now() - 40 * 86_400_000).toISOString();
    authedUser({ created_at: oldDate });
    setupSupabaseProfile("free", 0);
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer t" } }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Période d'essai/);
  });

  it("renvoie 429 si la limite journalière est atteinte (free=40)", async () => {
    authedUser();
    setupSupabaseProfile("free", 40);
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer t" } }), res);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toMatch(/Limite journalière/);
  });

  it("la limite est plus élevée pour le plan pro (200)", async () => {
    authedUser();
    setupSupabaseProfile("pro", 50);
    const res = makeRes();
    // Pas d'ANTHROPIC_KEY pour court-circuiter avant le fetch
    delete process.env.ANTHROPIC_KEY;
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { model: "x", max_tokens: 100, messages: [{ role: "user", content: "hi" }] } }),
      res,
    );
    // Pas 429 → on doit avoir avancé jusqu'à la check ANTHROPIC_KEY
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/ANTHROPIC_KEY/);
  });

  it("l'admin n'est pas bloqué par l'expiration d'essai (case-insensitive)", async () => {
    // L'admin compte free vieux de 999 jours doit passer (effectivePlan='pro').
    // callsToday=0 pour ne pas être bloqué par le rate-limit.
    process.env.ADMIN_EMAIL = "admin@zenbat.fr";
    const oldDate = new Date(Date.now() - 999 * 86_400_000).toISOString();
    authedUser({ email: "Admin@Zenbat.FR", created_at: oldDate }); // case mismatch volontaire
    setupSupabaseProfile("free", 0);
    delete process.env.ANTHROPIC_KEY;
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [{ role: "user", content: "hi" }] } }),
      res,
    );
    // Court-circuit ANTHROPIC_KEY = on a passé tous les checks de plan/limit
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/ANTHROPIC_KEY/);
  });
});

describe("claude endpoint — validation des paramètres", () => {
  function setupAuthed() {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "u1", email: "u@x.fr", created_at: new Date().toISOString() } }, error: null });
    setupSupabaseProfile("pro", 0);
  }

  it("renvoie 400 si model est manquant", async () => {
    setupAuthed();
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { max_tokens: 100, messages: [{ role: "user", content: "x" }] } }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/model/);
  });

  it("renvoie 400 si model n'est pas dans la whitelist", async () => {
    setupAuthed();
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { model: "gpt-4", max_tokens: 100, messages: [{ role: "user", content: "x" }] } }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("renvoie 400 si max_tokens est hors borne", async () => {
    setupAuthed();
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { model: "claude-haiku-4-5-20251001", max_tokens: 99999, messages: [{ role: "user", content: "x" }] } }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("renvoie 400 si messages est vide ou non-array", async () => {
    setupAuthed();
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [] } }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("renvoie 400 si temperature est hors [0, 1]", async () => {
    setupAuthed();
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [{ role: "user", content: "x" }], temperature: 2 } }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("renvoie 400 si system dépasse la taille max", async () => {
    setupAuthed();
    const res = makeRes();
    const huge = "x".repeat(40_001);
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [{ role: "user", content: "x" }], system: huge } }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/system trop long/);
  });

  it("accepte un system de 30 000 caractères (BTP multi-métiers + historique)", async () => {
    setupAuthed();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: "ok" }] }),
    });
    const res = makeRes();
    const big = "x".repeat(30_000);
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [{ role: "user", content: "x" }], system: big } }),
      res,
    );
    expect(res.statusCode).toBe(200);
  });
});

describe("claude endpoint — appel Anthropic non-streamé", () => {
  function setupAuthed() {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "u1", email: "u@x.fr", created_at: new Date().toISOString() } }, error: null });
    setupSupabaseProfile("pro", 0);
  }

  it("propage la réponse Anthropic sur succès", async () => {
    setupAuthed();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: "bonjour" }] }),
    });
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [{ role: "user", content: "x" }] } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.content[0].text).toBe("bonjour");
  });

  it("propage le status d'erreur Anthropic", async () => {
    setupAuthed();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 529,
      json: async () => ({ error: { message: "overloaded" } }),
    });
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [{ role: "user", content: "x" }] } }),
      res,
    );
    expect(res.statusCode).toBe(529);
  });

  it("renvoie 504 si Anthropic est trop lent (AbortError)", async () => {
    setupAuthed();
    global.fetch.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [{ role: "user", content: "x" }] } }),
      res,
    );
    expect(res.statusCode).toBe(504);
  });

  it("renvoie 502 sur erreur réseau autre", async () => {
    setupAuthed();
    global.fetch.mockRejectedValueOnce(new Error("network"));
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [{ role: "user", content: "x" }] } }),
      res,
    );
    expect(res.statusCode).toBe(502);
  });
});
