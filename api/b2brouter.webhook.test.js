import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

const updateMock = vi.fn();
const eqMock     = vi.fn();
const fromMock   = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: fromMock }),
}));

import handler from "./b2brouter.js";

function makeRes() {
  const res = {
    statusCode: 0,
    body:       null,
    status(c) { this.statusCode = c; return this; },
    json(b)   { this.body = b;        return this; },
  };
  return res;
}

// req factice : implémente Symbol.asyncIterator pour que `for await (const c of req)` fonctionne.
// `url` inclut le marqueur ?route=webhook reproduit par la rewrite Vercel pour cibler le flux webhook.
function makeReq({ method = "POST", headers = {}, raw = "", url = "/api/b2brouter?route=webhook" } = {}) {
  const buf = Buffer.from(raw, "utf8");
  return {
    method,
    headers,
    url,
    [Symbol.asyncIterator]: async function* () { yield buf; },
  };
}

function sign(secret, raw) {
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

const ENV_KEYS = ["B2B_WEBHOOK_SECRET", "SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
let snap;

beforeEach(() => {
  snap = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  process.env.B2B_WEBHOOK_SECRET     = "topsecret";
  process.env.SUPABASE_URL           = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  // Supabase chain : from().update().eq() → { error: null }
  eqMock.mockResolvedValue({ error: null });
  updateMock.mockReturnValue({ eq: eqMock });
  fromMock.mockReturnValue({ update: updateMock });
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else                        process.env[k] = snap[k];
  }
  vi.clearAllMocks();
});

describe("b2brouter-webhook", () => {
  it("refuse les méthodes != POST", async () => {
    const res = makeRes();
    await handler(makeReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
  });

  it("renvoie 500 si B2B_WEBHOOK_SECRET n'est pas configuré", async () => {
    delete process.env.B2B_WEBHOOK_SECRET;
    const res = makeRes();
    await handler(makeReq({ raw: "{}" }), res);
    expect(res.statusCode).toBe(500);
  });

  it("renvoie 401 si la signature est absente", async () => {
    const res = makeRes();
    await handler(makeReq({ raw: "{}" }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/signature/);
  });

  it("renvoie 401 si la signature n'est pas un hex 64", async () => {
    const res = makeRes();
    await handler(
      makeReq({ raw: "{}", headers: { "x-b2b-signature": "pas-hex" } }),
      res,
    );
    expect(res.statusCode).toBe(401);
  });

  it("renvoie 401 si la signature ne correspond pas (timing-safe)", async () => {
    const raw = '{"invoice_id":"INV-1","status":"sent"}';
    const wrongSig = sign("autresecret", raw);
    const res = makeRes();
    await handler(
      makeReq({ raw, headers: { "x-b2b-signature": wrongSig } }),
      res,
    );
    expect(res.statusCode).toBe(401);
  });

  it("accepte une signature valide et met à jour la facture", async () => {
    const raw = '{"invoice_id":"INV-1","status":"paid"}';
    const sig = sign("topsecret", raw);
    const res = makeRes();
    await handler(
      makeReq({ raw, headers: { "x-b2b-signature": sig } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledTimes(1);
    const patch = updateMock.mock.calls[0][0];
    expect(patch.statut).toBe("payee");
    expect(patch.b2brouter_status).toBe("paid");
    expect(eqMock).toHaveBeenCalledWith("b2brouter_invoice_id", "INV-1");
  });

  it("accepte le préfixe sha256= dans le header", async () => {
    const raw = '{"invoice_id":"INV-2","status":"sent"}';
    const sig = sign("topsecret", raw);
    const res = makeRes();
    await handler(
      makeReq({ raw, headers: { "x-b2b-signature": "sha256=" + sig } }),
      res,
    );
    expect(res.statusCode).toBe(200);
  });

  it("accepte aussi le header alternatif x-b2brouter-signature", async () => {
    const raw = '{"invoice_id":"INV-3","status":"delivered"}';
    const sig = sign("topsecret", raw);
    const res = makeRes();
    await handler(
      makeReq({ raw, headers: { "x-b2brouter-signature": sig } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(updateMock.mock.calls[0][0].statut).toBe("recue");
  });

  it("renvoie 400 si le JSON est invalide après HMAC OK", async () => {
    const raw = "pas du json";
    const sig = sign("topsecret", raw);
    const res = makeRes();
    await handler(
      makeReq({ raw, headers: { "x-b2b-signature": sig } }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("renvoie 400 si invoice_id est manquant", async () => {
    const raw = '{"status":"sent"}';
    const sig = sign("topsecret", raw);
    const res = makeRes();
    await handler(
      makeReq({ raw, headers: { "x-b2b-signature": sig } }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  describe("mapping des statuts B2B → internes", () => {
    const cases = [
      ["sent",        "envoyee"],
      ["dispatched",  "envoyee"],
      ["delivered",   "recue"],
      ["paid",        "payee"],
      ["settled",     "payee"],
      ["rejected",    "rejetee"],
      ["failed",      "rejetee"],
      ["cancelled",   "annulee"],
    ];
    it.each(cases)("%s → %s", async (b2bStatus, expected) => {
      const raw = JSON.stringify({ invoice_id: "X", status: b2bStatus });
      const sig = sign("topsecret", raw);
      const res = makeRes();
      await handler(makeReq({ raw, headers: { "x-b2b-signature": sig } }), res);
      expect(updateMock.mock.calls.at(-1)[0].statut).toBe(expected);
    });

    it("ne mappe pas un statut inconnu (statut interne reste)", async () => {
      const raw = JSON.stringify({ invoice_id: "X", status: "unknown" });
      const sig = sign("topsecret", raw);
      const res = makeRes();
      await handler(makeReq({ raw, headers: { "x-b2b-signature": sig } }), res);
      const patch = updateMock.mock.calls.at(-1)[0];
      expect(patch).not.toHaveProperty("statut");
      expect(patch.b2brouter_status).toBe("unknown");
    });
  });
});
