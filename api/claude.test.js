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

const ENV_KEYS = ["SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_KEY", "ADMIN_EMAIL", "AI_PROVIDER", "MISTRAL_API_KEY", "MISTRAL_MODEL"];
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
  delete process.env.AI_PROVIDER;
  delete process.env.MISTRAL_API_KEY;
  delete process.env.MISTRAL_MODEL;

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

  it("refuse les méthodes != GET/POST", async () => {
    const res = makeRes();
    await handler(makeReq({ method: "PUT" }), res);
    expect(res.statusCode).toBe(405);
  });

  it("GET renvoie le diagnostic fournisseur sans exposer les clés", async () => {
    process.env.MISTRAL_API_KEY = "mistral-secret";
    process.env.MISTRAL_MODEL   = "mistral-small-latest";
    const res = makeRes();
    await handler(makeReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.provider).toBe("mistral");
    expect(res.body.model).toBe("mistral-small-latest");
    expect(res.body.keys).toEqual({ MISTRAL_API_KEY: true, ANTHROPIC_KEY: true });
    expect(JSON.stringify(res.body)).not.toContain("mistral-secret");
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("GET indique anthropic quand aucune clé Mistral n'est posée", async () => {
    const res = makeRes();
    await handler(makeReq({ method: "GET" }), res);
    expect(res.body.provider).toBe("anthropic");
    expect(res.body.keys.MISTRAL_API_KEY).toBe(false);
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

  it("autorise l'appel IA même pour un compte free ancien (freemium permanent)", async () => {
    const oldDate = new Date(Date.now() - 40 * 86_400_000).toISOString();
    authedUser({ created_at: oldDate });
    setupSupabaseProfile("free", 0);
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer t" } }), res);
    // Le statut ne doit pas être 403 « Période d'essai » : depuis la 0039,
    // free = freemium permanent (limite à la création de devis, pas à l'IA).
    expect(res.statusCode).not.toBe(403);
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
    const huge = "x".repeat(80_001);
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

describe("claude endpoint — mode scrape_urls (import sites web)", () => {
  function setupAuthed() {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "u1", email: "u@x.fr", created_at: new Date().toISOString() } }, error: null });
    // setupSupabaseProfile + retourne le from() generic pour les inserts claude_api_logs
    const baseProfile = {
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { plan: "pro" }, error: null }),
    };
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      gte:    vi.fn().mockResolvedValue({ count: 0, error: null }),
    };
    fromMock.mockImplementation((table) => {
      if (table === "profiles")         return baseProfile;
      if (table === "ia_conversations") return countChain;
      if (table === "claude_api_logs")  return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });
  }

  // Helper : fabrique un Response stream qu'on lit en boucle reader.read()
  function htmlResp(html, contentType = "text/html; charset=utf-8") {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(html);
    let consumed = false;
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => (k.toLowerCase() === "content-type" ? contentType : null) },
      body: {
        getReader: () => ({
          read: async () => {
            if (consumed) return { done: true, value: undefined };
            consumed = true;
            return { done: false, value: bytes };
          },
          cancel: async () => {},
        }),
      },
    };
  }

  it("renvoie 400 si scrape_urls est vide", async () => {
    setupAuthed();
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { scrape_urls: [] } }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/tableau non vide/);
  });

  it("renvoie 400 si trop d'URLs (>5)", async () => {
    setupAuthed();
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { scrape_urls: Array(6).fill("https://example.com") } }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Maximum 5/);
  });

  it("bloque les IP privées (SSRF) sans appeler fetch", async () => {
    setupAuthed();
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { scrape_urls: ["http://127.0.0.1/admin", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data/"] } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    // Aucun fetch HTTP ne doit avoir été appelé pour ces URLs privées
    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.body.results).toHaveLength(3);
    res.body.results.forEach(r => {
      expect(r.error).toBeTruthy();
      expect(r.error).toMatch(/privée|bloquée/i);
    });
  });

  it("renvoie une erreur par URL invalide sans casser le batch", async () => {
    setupAuthed();
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { scrape_urls: ["pas-une-url valide ! @#$", "ftp://example.com/x"] } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0].error).toBeTruthy();
    expect(res.body.results[1].error).toMatch(/Protocole/);
  });

  it("happy path : extrait un contact JSON depuis une page HTML", async () => {
    setupAuthed();
    // 1er fetch = HTML site, 2e fetch = appel Anthropic
    global.fetch
      .mockResolvedValueOnce(htmlResp(`<html><head><title>Dupont Maçonnerie</title><meta name="description" content="Artisan maçon en Normandie"></head><body><h1>Contactez-nous</h1><p>06 12 34 56 78</p><p>contact@dupont-maconnerie.fr</p></body></html>`))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: `<CONTACT>{"type":"artisan","raison_sociale":"Dupont Maçonnerie","nom":"","prenom":"","email":"contact@dupont-maconnerie.fr","telephone":"06 12 34 56 78","telephone_fixe":"","adresse":"","code_postal":"","ville":"","siret":"","tva_intra":"","activite":"Maçonnerie générale"}</CONTACT>` }],
          usage: { input_tokens: 1000, output_tokens: 100 },
        }),
      });

    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { scrape_urls: ["https://1.1.1.1/"] } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.results).toHaveLength(1);
    const r = res.body.results[0];
    expect(r.error).toBeUndefined();
    expect(r.contact.raison_sociale).toBe("Dupont Maçonnerie");
    expect(r.contact.telephone).toBe("06 12 34 56 78");
    expect(r.contact.type).toBe("artisan");
  });

  it("renvoie une erreur si le JSON Claude est mal formé", async () => {
    setupAuthed();
    global.fetch
      .mockResolvedValueOnce(htmlResp("<html><body>plop</body></html>"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ content: [{ text: "ce n'est pas du JSON" }], usage: { input_tokens: 10, output_tokens: 5 } }),
      });
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { scrape_urls: ["https://1.1.1.1/"] } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.results[0].error).toMatch(/Extraction|JSON/);
  });

  it("rejette les content-type non HTML (PDF, image…)", async () => {
    setupAuthed();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/pdf" },
      body: { getReader: () => ({ read: async () => ({ done: true }), cancel: async () => {} }) },
    });
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { scrape_urls: ["https://1.1.1.1/doc.pdf"] } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.results[0].error).toMatch(/HTML/);
  });

  it("respecte la limite journalière même en mode scrape", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "u1", email: "u@x.fr", created_at: new Date().toISOString() } }, error: null });
    setupSupabaseProfile("free", 40); // free saturé
    const res = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer t" }, body: { scrape_urls: ["https://1.1.1.1/"] } }),
      res,
    );
    expect(res.statusCode).toBe(429);
  });
});

describe("claude endpoint — fournisseur Mistral", () => {
  function setupAuthed() {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "u1", email: "u@x.fr", created_at: new Date().toISOString() } }, error: null });
    setupSupabaseProfile("pro", 0);
    const base = fromMock.getMockImplementation();
    fromMock.mockImplementation((table) => table === "claude_api_logs"
      ? { insert: vi.fn().mockResolvedValue({ data: null, error: null }) }
      : base(table));
  }
  const baseBody = { model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [{ role: "user", content: "x" }] };

  function sseResp(chunks) {
    const encoder = new TextEncoder();
    const queue = chunks.map(c => encoder.encode(c));
    return {
      ok: true,
      status: 200,
      body: { getReader: () => ({ read: async () => queue.length ? { done: false, value: queue.shift() } : { done: true, value: undefined } }) },
    };
  }

  beforeEach(() => {
    process.env.MISTRAL_API_KEY = "mistral-test";
  });

  it("bascule sur Mistral quand MISTRAL_API_KEY est posée et traduit la requête", async () => {
    setupAuthed();
    process.env.MISTRAL_MODEL = "mistral-small-latest";
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "bonjour" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 12, completion_tokens: 3 },
      }),
    });
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer t" }, body: { ...baseBody, system: "Tu es un assistant", temperature: 0.2 } }), res);

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.mistral.ai/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer mistral-test");
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe("mistral-small-latest");
    expect(sent.messages).toEqual([
      { role: "system", content: "Tu es un assistant" },
      { role: "user", content: "x" },
    ]);
    expect(sent.temperature).toBe(0.2);

    expect(res.statusCode).toBe(200);
    expect(res.body.content[0].text).toBe("bonjour");
    expect(res.body.stop_reason).toBe("end_turn");
    expect(res.body.usage).toEqual({ input_tokens: 12, output_tokens: 3 });
    expect(res.headers["X-AI-Provider"]).toBe("mistral");
    expect(res.headers["X-AI-Model"]).toBe("mistral-small-latest");
  });

  it("AI_PROVIDER=anthropic force Anthropic même avec une clé Mistral", async () => {
    setupAuthed();
    process.env.AI_PROVIDER = "anthropic";
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: [{ text: "ok" }] }) });
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer t" }, body: baseBody }), res);
    expect(global.fetch.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/messages");
    expect(res.body.content[0].text).toBe("ok");
  });

  it("l'admin peut forcer Mistral via ai_provider même si la prod est sur Anthropic", async () => {
    process.env.ADMIN_EMAIL = "admin@x.fr";
    process.env.AI_PROVIDER = "anthropic";
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "a1", email: "Admin@x.fr", created_at: new Date().toISOString() } }, error: null });
    setupSupabaseProfile("free", 0);
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }) });
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer t" }, body: { ...baseBody, ai_provider: "mistral" } }), res);
    expect(global.fetch.mock.calls[0][0]).toBe("https://api.mistral.ai/v1/chat/completions");
    expect(res.headers["X-AI-Provider"]).toBe("mistral");
  });

  it("ignore ai_provider pour un utilisateur non admin", async () => {
    process.env.ADMIN_EMAIL = "admin@x.fr";
    process.env.AI_PROVIDER = "anthropic";
    setupAuthed();
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: [{ text: "ok" }] }) });
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer t" }, body: { ...baseBody, ai_provider: "mistral" } }), res);
    expect(global.fetch.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/messages");
  });

  it("renvoie 500 si AI_PROVIDER=mistral sans MISTRAL_API_KEY", async () => {
    setupAuthed();
    process.env.AI_PROVIDER = "mistral";
    delete process.env.MISTRAL_API_KEY;
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer t" }, body: baseBody }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/MISTRAL_API_KEY/);
  });

  it("normalise les erreurs Mistral au format { error: { message } }", async () => {
    setupAuthed();
    global.fetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ message: "Requests rate limit exceeded", type: "rate_limited" }) });
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer t" }, body: baseBody }), res);
    expect(res.statusCode).toBe(429);
    expect(res.body.error.message).toBe("Requests rate limit exceeded");
  });

  it("traduit le flux SSE Mistral en events Anthropic", async () => {
    setupAuthed();
    global.fetch.mockResolvedValueOnce(sseResp([
      'data: {"choices":[{"delta":{"role":"assistant","content":""}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Bon"}}]}\n\ndata: {"choices":[{"delta":{"con',
      'tent":"jour"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2}}\n\n',
      "data: [DONE]\n\n",
    ]));
    const res = makeRes();
    let out = "";
    res.write = (chunk) => { out += chunk; };
    await handler(makeReq({ headers: { authorization: "Bearer t" }, body: { ...baseBody, stream: true } }), res);

    expect(JSON.parse(global.fetch.mock.calls[0][1].body).stream).toBe(true);
    const events = out.split("\n").filter(l => l.startsWith("data: ")).map(l => JSON.parse(l.slice(6)));
    const text = events.filter(e => e.type === "content_block_delta").map(e => e.delta.text).join("");
    expect(text).toBe("Bonjour");
    expect(events.at(-1).type).toBe("message_stop");
  });

  it("n'émet pas message_stop si le flux Mistral est coupé avant la fin", async () => {
    setupAuthed();
    global.fetch.mockResolvedValueOnce(sseResp([
      'data: {"choices":[{"delta":{"content":"<DE"}}]}\n\n',
    ]));
    const res = makeRes();
    let out = "";
    res.write = (chunk) => { out += chunk; };
    await handler(makeReq({ headers: { authorization: "Bearer t" }, body: { ...baseBody, stream: true } }), res);
    expect(out).toContain("<DE");
    expect(out).not.toContain("message_stop");
  });
});
