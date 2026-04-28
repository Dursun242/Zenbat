import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const insertMock = vi.fn();
const fromMock   = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: fromMock }),
}));
// Le helper cors écrit des headers — on l'écrase pour ne pas dépendre des env
vi.mock("./_cors.js", () => ({ cors: () => {} }));

import handler from "./newsletter.js";

function makeRes() {
  return {
    statusCode: 0,
    body:       null,
    status(c) { this.statusCode = c; return this; },
    json(b)   { this.body = b;        return this; },
    end()     { this.body = null;     return this; },
  };
}

const ENV_KEYS = ["SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "BREVO_API_KEY", "ADMIN_EMAIL"];
let snap;

beforeEach(() => {
  snap = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  process.env.SUPABASE_URL              = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  delete process.env.BREVO_API_KEY; // pas d'envoi mail dans les tests

  insertMock.mockResolvedValue({ error: null });
  fromMock.mockReturnValue({ insert: insertMock });
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else                        process.env[k] = snap[k];
  }
  vi.clearAllMocks();
});

describe("newsletter endpoint", () => {
  it("répond 204 sur OPTIONS (preflight CORS)", async () => {
    const res = makeRes();
    await handler({ method: "OPTIONS", headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(204);
  });

  it("refuse les méthodes != POST", async () => {
    const res = makeRes();
    await handler({ method: "GET", headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it("renvoie 400 si email absent", async () => {
    const res = makeRes();
    await handler({ method: "POST", headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(400);
  });

  it("renvoie 400 si email invalide", async () => {
    const res = makeRes();
    await handler({ method: "POST", headers: {}, body: { email: "pas-un-email" } }, res);
    expect(res.statusCode).toBe(400);
  });

  it("accepte un email valide et insère en DB", async () => {
    const res = makeRes();
    await handler({ method: "POST", headers: {}, body: { email: "User@Example.com" } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({ email: "user@example.com" });
  });

  it("renvoie 200 already=true si l'email existe déjà (code 23505)", async () => {
    insertMock.mockResolvedValueOnce({ error: { code: "23505" } });
    const res = makeRes();
    await handler({ method: "POST", headers: {}, body: { email: "x@y.fr" } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, already: true });
  });

  it("renvoie 500 sur erreur DB inattendue", async () => {
    insertMock.mockResolvedValueOnce({ error: { code: "OTHER", message: "boom" } });
    const res = makeRes();
    await handler({ method: "POST", headers: {}, body: { email: "x@y.fr" } }, res);
    expect(res.statusCode).toBe(500);
  });

  it("renvoie 500 si Supabase n'est pas configuré", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = makeRes();
    await handler({ method: "POST", headers: {}, body: { email: "x@y.fr" } }, res);
    expect(res.statusCode).toBe(500);
  });
});
