import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mapStatus,
  isAdminUser,
  isPdpPollRequest,
  handlePdpPoll,
  handlePdpAction,
  PDP_ACTIONS,
  _resetTokenCache,
} from "./_superpdp.js";

// ── Fakes Supabase / HTTP ───────────────────────────────────────────────────
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

function makeReq({ method = "POST", url = "/api/facturx", headers = {}, body = undefined } = {}) {
  return { method, url, headers, body };
}

// Chaîne Supabase minimale : from().select().eq().eq().maybeSingle() /
// from().update().eq().eq().select() / from().upsert()
function makeAdminFake({ invoiceRow = null, stateRow = { last_event_id: 0 } } = {}) {
  const calls = { updates: [], upserts: [] };
  const admin = {
    calls,
    from(table) {
      const chain = {
        _table: table,
        _patch: null,
        select() { return chain; },
        eq()     { return chain; },
        single() {
          if (table === "pdp_state") return Promise.resolve({ data: stateRow, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() {
          if (table === "invoices") return Promise.resolve({ data: invoiceRow, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        update(patch, opts) {
          calls.updates.push({ table, patch, opts });
          chain._patch = patch;
          // .update().eq().eq() awaité directement (poll) → thenable ; ou .select() (send)
          const thenable = {
            eq() { return thenable; },
            select() { return Promise.resolve({ data: [{ statut: patch.statut || "envoyee", locked: true }], error: null }); },
            then(resolve) { return resolve({ data: null, error: null, count: table === "invoices" ? 1 : 0 }); },
          };
          return thenable;
        },
        upsert(row, opts) {
          calls.upserts.push({ table, row, opts });
          return Promise.resolve({ data: null, error: null });
        },
      };
      return chain;
    },
  };
  return admin;
}

const ENV_KEYS = ["CRON_SECRET", "PDP_CLIENT_ID", "PDP_CLIENT_SECRET", "PDP_API_BASE", "ADMIN_EMAIL", "PDP_SANDBOX_RECEIVER_PEPPOL", "PDP_SANDBOX_RECEIVER_SIREN"];
let snap;

beforeEach(() => {
  snap = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  process.env.CRON_SECRET       = "cron-shh";
  process.env.PDP_CLIENT_ID     = "test-client-id";
  process.env.PDP_CLIENT_SECRET = "test-client-secret";
  process.env.PDP_API_BASE      = "https://api.superpdp.tech";
  process.env.ADMIN_EMAIL       = "Admin@Zenbat.fr";
  delete process.env.PDP_SANDBOX_RECEIVER_PEPPOL;
  delete process.env.PDP_SANDBOX_RECEIVER_SIREN;
  _resetTokenCache();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else                        process.env[k] = snap[k];
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const adminUser = { id: "user-admin", email: "admin@zenbat.fr" };
const otherUser = { id: "user-2",     email: "artisan@example.com" };

// Stub fetch : 1er appel = OAuth, suivants = réponses fournies dans l'ordre.
function stubPdpFetch(responses) {
  const queue = [...responses];
  const fetchMock = vi.fn(async (url) => {
    if (String(url).endsWith("/oauth2/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }), text: async () => "" };
    }
    const next = queue.shift() || { ok: true, status: 200, body: {} };
    return {
      ok:     next.ok,
      status: next.status,
      text:   async () => JSON.stringify(next.body),
      json:   async () => next.body,
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

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

describe("isAdminUser() / isPdpPollRequest() / PDP_ACTIONS", () => {
  it("compare l'email normalisé à ADMIN_EMAIL", () => {
    expect(isAdminUser({ email: "ADMIN@zenbat.fr " })).toBe(true);
    expect(isAdminUser({ email: "artisan@example.com" })).toBe(false);
    delete process.env.ADMIN_EMAIL;
    expect(isAdminUser({ email: "admin@zenbat.fr" })).toBe(false);
  });

  it("détecte ?route=pdp_poll", () => {
    expect(isPdpPollRequest(makeReq({ url: "/api/facturx?route=pdp_poll" }))).toBe(true);
    expect(isPdpPollRequest(makeReq({ url: "/api/facturx?route=other" }))).toBe(false);
    expect(isPdpPollRequest(makeReq({ url: "/api/facturx" }))).toBe(false);
    expect(isPdpPollRequest({})).toBe(false);
  });

  it("expose les 3 actions pdp_*", () => {
    expect([...PDP_ACTIONS].sort()).toEqual(["pdp_get_status", "pdp_send_invoice", "pdp_test_connection"]);
  });
});

describe("handlePdpPoll — auth cron", () => {
  it("refuse sans Bearer", async () => {
    const res = makeRes();
    await handlePdpPoll(makeReq({ method: "GET", url: "/api/facturx?route=pdp_poll" }), res, { admin: makeAdminFake() });
    expect(res.statusCode).toBe(401);
  });

  it("refuse un Bearer incorrect", async () => {
    const res = makeRes();
    await handlePdpPoll(makeReq({ method: "GET", headers: { authorization: "Bearer wrong" } }), res, { admin: makeAdminFake() });
    expect(res.statusCode).toBe(401);
  });

  it("500 si CRON_SECRET absent", async () => {
    delete process.env.CRON_SECRET;
    const res = makeRes();
    await handlePdpPoll(makeReq({ method: "GET", headers: { authorization: "Bearer x" } }), res, { admin: makeAdminFake() });
    expect(res.statusCode).toBe(500);
  });

  it("propage les events sur invoices et avance le curseur", async () => {
    stubPdpFetch([
      { ok: true, status: 200, body: { data: [
        { id: 11, invoice_id: "inv-A", status_code: "fr:202" },
        { id: 12, invoice_id: "inv-B", status_code: "fr:205" },
      ], has_after: false } },
    ]);
    const admin = makeAdminFake({ stateRow: { last_event_id: 10 } });
    const res = makeRes();
    await handlePdpPoll(makeReq({ method: "GET", headers: { authorization: "Bearer cron-shh" } }), res, { admin });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, pages: 1, last_event_id: 12 });
    const invUpdates = admin.calls.updates.filter(u => u.table === "invoices");
    expect(invUpdates).toHaveLength(2);
    expect(invUpdates[0].patch).toMatchObject({ pdp_status_raw: "fr:202", statut: "recue" });
    // fr:205 intermédiaire : code brut persisté, statut Zenbat inchangé
    expect(invUpdates[1].patch.pdp_status_raw).toBe("fr:205");
    expect(invUpdates[1].patch.statut).toBeUndefined();
    const stateUpdate = admin.calls.updates.find(u => u.table === "pdp_state");
    expect(stateUpdate.patch.last_event_id).toBe(12);
  });
});

describe("handlePdpAction — garde admin v0", () => {
  it("403 pour un utilisateur non-admin", async () => {
    const res = makeRes();
    await handlePdpAction(makeReq({ body: { action: "pdp_test_connection" } }), res, { user: otherUser, admin: makeAdminFake() });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/administrateur/);
  });

  it("400 sur une action inconnue (admin)", async () => {
    const res = makeRes();
    await handlePdpAction(makeReq({ body: { action: "pdp_fake" } }), res, { user: adminUser, admin: makeAdminFake() });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/inconnue/);
  });

  it("500 explicite si PDP_CLIENT_ID / SECRET manquent", async () => {
    delete process.env.PDP_CLIENT_ID;
    const res = makeRes();
    await handlePdpAction(makeReq({ body: { action: "pdp_test_connection" } }), res, { user: adminUser, admin: makeAdminFake() });
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/PDP_CLIENT_ID/);
  });
});

describe("handlePdpAction — pdp_test_connection", () => {
  it("renvoie l'identité sandbox + receiver Peppol et trace pdp_accounts", async () => {
    process.env.PDP_SANDBOX_RECEIVER_PEPPOL = "0225:315143296_6591";
    stubPdpFetch([{ ok: true, status: 200, body: { number: "123456789", env: "sandbox" } }]);
    const admin = makeAdminFake();
    const res = makeRes();
    await handlePdpAction(makeReq({ body: { action: "pdp_test_connection" } }), res, { user: adminUser, admin });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, number: "123456789", env: "sandbox", sandbox_receiver_peppol: "0225:315143296_6591" });
    expect(admin.calls.upserts[0]).toMatchObject({ table: "pdp_accounts", row: { owner_id: "user-admin", company_siren: "123456789", company_env: "sandbox" } });
  });

  it("construit 0225:<siren> depuis PDP_SANDBOX_RECEIVER_SIREN en fallback", async () => {
    process.env.PDP_SANDBOX_RECEIVER_SIREN = "315 143 296";
    stubPdpFetch([{ ok: true, status: 200, body: { number: "1", env: "sandbox" } }]);
    const res = makeRes();
    await handlePdpAction(makeReq({ body: { action: "pdp_test_connection" } }), res, { user: adminUser, admin: makeAdminFake() });
    expect(res.body.sandbox_receiver_peppol).toBe("0225:315143296");
  });
});

describe("handlePdpAction — pdp_send_invoice", () => {
  const bigPdf = Buffer.alloc(2048, 1).toString("base64");

  it("400 sans invoice_id / pdf_base64", async () => {
    let res = makeRes();
    await handlePdpAction(makeReq({ body: { action: "pdp_send_invoice" } }), res, { user: adminUser, admin: makeAdminFake() });
    expect(res.statusCode).toBe(400);
    res = makeRes();
    await handlePdpAction(makeReq({ body: { action: "pdp_send_invoice", invoice_id: "inv-1" } }), res, { user: adminUser, admin: makeAdminFake() });
    expect(res.statusCode).toBe(400);
  });

  it("404 si la facture n'appartient pas à l'utilisateur", async () => {
    const res = makeRes();
    await handlePdpAction(makeReq({ body: { action: "pdp_send_invoice", invoice_id: "inv-1", pdf_base64: bigPdf } }), res,
      { user: adminUser, admin: makeAdminFake({ invoiceRow: null }) });
    expect(res.statusCode).toBe(404);
  });

  it("400 si déjà transmise (idempotence)", async () => {
    const res = makeRes();
    await handlePdpAction(makeReq({ body: { action: "pdp_send_invoice", invoice_id: "inv-1", pdf_base64: bigPdf } }), res,
      { user: adminUser, admin: makeAdminFake({ invoiceRow: { id: "inv-1", pdp_invoice_id: "pdp-9", statut: "envoyee" } }) });
    expect(res.statusCode).toBe(400);
    expect(res.body.pdp_invoice_id).toBe("pdp-9");
  });

  it("400 si le PDF est trop petit pour être un Factur-X", async () => {
    const res = makeRes();
    await handlePdpAction(makeReq({ body: { action: "pdp_send_invoice", invoice_id: "inv-1", pdf_base64: "aGVsbG8=" } }), res,
      { user: adminUser, admin: makeAdminFake({ invoiceRow: { id: "inv-1", statut: "brouillon" } }) });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/invalide/);
  });

  it("POST le PDF binaire à /v1.beta/invoices puis verrouille + trace la facture", async () => {
    const fetchMock = stubPdpFetch([{ ok: true, status: 200, body: { id: "pdp-42" } }]);
    const admin = makeAdminFake({ invoiceRow: { id: "inv-1", statut: "brouillon", locked: false } });
    const res = makeRes();
    await handlePdpAction(makeReq({ body: { action: "pdp_send_invoice", invoice_id: "inv-1", pdf_base64: bigPdf } }), res, { user: adminUser, admin });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, pdp_invoice_id: "pdp-42", statut: "envoyee", locked: true });

    const sendCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/v1.beta/invoices"));
    expect(sendCall).toBeTruthy();
    expect(sendCall[1].method).toBe("POST");
    expect(sendCall[1].headers["Content-Type"]).toBe("application/pdf");
    expect(Buffer.isBuffer(sendCall[1].body)).toBe(true);
    expect(sendCall[1].headers.Authorization).toBe("Bearer tok");

    const invUpdate = admin.calls.updates.find(u => u.table === "invoices");
    expect(invUpdate.patch).toMatchObject({ pdp_invoice_id: "pdp-42", pdp_status: "sent", pdp_status_raw: "fr:200", statut: "envoyee", locked: true });
  });

  it("remonte le statut + detail Super PDP en cas de refus (validation)", async () => {
    stubPdpFetch([{ ok: false, status: 422, body: { error: "receiver address does not exist in peppol directory" } }]);
    const res = makeRes();
    await handlePdpAction(makeReq({ body: { action: "pdp_send_invoice", invoice_id: "inv-1", pdf_base64: bigPdf } }), res,
      { user: adminUser, admin: makeAdminFake({ invoiceRow: { id: "inv-1", statut: "envoyee", locked: true } }) });
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toMatch(/peppol directory/);
    expect(res.body.detail).toMatchObject({ error: expect.stringMatching(/peppol/) });
  });
});
