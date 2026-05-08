import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mocks Supabase / fetch — patchés à chaque test
const updateMock = vi.fn();
const selectMock = vi.fn();
const upsertMock = vi.fn();
const eqMock     = vi.fn();
const fromMock   = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: fromMock, auth: { getUser: vi.fn() } }),
}));

vi.mock("./_withAuth.js", () => ({
  authenticate: vi.fn(async (req, res) => {
    if (req.headers.authorization === "Bearer ok") {
      return { user: { id: "user-1", email: "user@example.com" }, admin: { from: fromMock } };
    }
    res.status(401).json({ error: "Non authentifié" });
    return null;
  }),
}));

vi.mock("./_cors.js", () => ({ cors: vi.fn() }));

import handler, { mapStatus } from "./superpdp.js";

function makeRes() {
  return {
    statusCode: 0,
    body:       null,
    status(c) { this.statusCode = c; return this; },
    json(b)   { this.body = b;        return this; },
    end()     { return this; },
    setHeader() {},
  };
}

function makeReq({ method = "POST", url = "/api/superpdp", headers = {}, body = undefined } = {}) {
  return { method, url, headers, body };
}

const ENV_KEYS = [
  "CRON_SECRET", "PDP_CLIENT_ID", "PDP_CLIENT_SECRET", "PDP_API_BASE",
  "SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
];
let snap;

beforeEach(() => {
  snap = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  process.env.CRON_SECRET                = "cron-shh";
  process.env.PDP_CLIENT_ID              = "test-client-id";
  process.env.PDP_CLIENT_SECRET          = "test-client-secret";
  process.env.PDP_API_BASE               = "https://api.superpdp.tech";
  process.env.SUPABASE_URL               = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY  = "service-key";

  // Chaîne Supabase par défaut : from().update().eq() / from().select().eq().single()
  eqMock.mockResolvedValue({ data: null, error: null, count: 0 });
  updateMock.mockReturnValue({ eq: eqMock });
  selectMock.mockReturnValue({ eq: eqMock, single: () => Promise.resolve({ data: null, error: null }) });
  upsertMock.mockResolvedValue({ data: null, error: null });
  fromMock.mockReturnValue({
    update: updateMock,
    select: selectMock,
    upsert: upsertMock,
  });
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else                        process.env[k] = snap[k];
  }
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("mapStatus()", () => {
  it.each([
    ["fr:200", "envoyee"],
    ["fr:201", "rejetee"],
    ["fr:203", "rejetee"],
    ["fr:210", "rejetee"],
    ["fr:202", "recue"],
    ["fr:204", "recue"],
    ["fr:206", "recue"],
    ["fr:212", "payee"],
  ])("%s → %s", (code, expected) => {
    expect(mapStatus(code)).toBe(expected);
  });

  it("renvoie null pour les codes intermédiaires non mappés", () => {
    expect(mapStatus("fr:205")).toBeNull();
    expect(mapStatus("fr:207")).toBeNull();
    expect(mapStatus("fr:208")).toBeNull();
    expect(mapStatus("inconnu")).toBeNull();
    expect(mapStatus(undefined)).toBeNull();
  });
});

describe("handler — routage", () => {
  it("refuse une requête poll sans Bearer", async () => {
    const res = makeRes();
    await handler(makeReq({ url: "/api/superpdp?route=poll", method: "GET" }), res);
    expect(res.statusCode).toBe(401);
  });

  it("refuse un Bearer poll incorrect", async () => {
    const res = makeRes();
    await handler(
      makeReq({ url: "/api/superpdp?route=poll", method: "GET", headers: { authorization: "Bearer wrong" } }),
      res,
    );
    expect(res.statusCode).toBe(401);
  });

  it("refuse une action sans authorization", async () => {
    const res = makeRes();
    await handler(makeReq({ method: "POST", body: { action: "test_connection" } }), res);
    expect(res.statusCode).toBe(401);
  });

  it("refuse une action sans champ `action`", async () => {
    const res = makeRes();
    await handler(
      makeReq({ method: "POST", headers: { authorization: "Bearer ok" }, body: {} }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/action/);
  });

  it("refuse une action inconnue", async () => {
    const res = makeRes();
    await handler(
      makeReq({
        method:  "POST",
        headers: { authorization: "Bearer ok" },
        body:    { action: "fake_action" },
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/inconnue/);
  });

  it("OPTIONS répond 204", async () => {
    const res = makeRes();
    await handler(makeReq({ method: "OPTIONS" }), res);
    expect(res.statusCode).toBe(204);
  });

  it("refuse un GET non-poll", async () => {
    const res = makeRes();
    await handler(makeReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
  });
});
