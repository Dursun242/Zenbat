// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { randomBytes } from "node:crypto"

vi.mock("./_serverLog.js", () => ({ logServerError: vi.fn(async () => {}) }))

import {
  seal, unseal, newPkce, authorizeUrl, accessTokenFor, summarizeInvoice,
  handlePdpAction, handlePdpCallback, redirectUri,
} from "./_pdp.js"

// ── Faux Supabase en mémoire (juste les chaînes utilisées par _pdp.js) ─────
function fakeDb(tables = {}) {
  const t = (name) => (tables[name] ||= [])
  const from = (name) => {
    let op = "select", payload = null, filters = [], selectAfter = false
    const rows = () => t(name).filter(r => filters.every(([k, v]) => r[k] === v))
    const run = () => {
      if (op === "select") return { data: rows(), error: null }
      if (op === "delete") {
        const gone = rows(); tables[name] = t(name).filter(r => !gone.includes(r))
        return { data: selectAfter ? gone : null, error: null }
      }
      if (op === "update") { const hit = rows(); hit.forEach(r => Object.assign(r, payload)); return { data: hit, error: null } }
      if (op === "insert") { t(name).push({ created_at: new Date().toISOString(), ...payload }); return { data: null, error: null } }
      if (op === "upsert") {
        const i = t(name).findIndex(r => r.user_id === payload.user_id)
        if (i >= 0) t(name)[i] = payload; else t(name).push(payload)
        return { data: null, error: null }
      }
    }
    const chain = {
      select: () => { if (op !== "select") selectAfter = true; return chain },
      eq: (k, v) => { filters.push([k, v]); return chain },
      update: (p) => { op = "update"; payload = p; return chain },
      delete: () => { op = "delete"; return chain },
      insert: (p) => { op = "insert"; payload = p; return chain },
      upsert: (p) => { op = "upsert"; payload = p; return chain },
      maybeSingle: async () => { const r = run(); return { data: (r.data || [])[0] || null, error: null } },
      then: (a, b) => Promise.resolve(run()).then(a, b),
    }
    return chain
  }
  return { from, tables }
}

function makeRes() {
  const r = { statusCode: 0, body: null, headers: {} }
  r.status = c => { r.statusCode = c; return r }
  r.json = b => { r.body = b; return r }
  r.setHeader = (k, v) => { r.headers[k] = v }
  r.end = () => r
  return r
}

// Super PDP simulé : chaque appel fetch est routé sur (méthode, chemin).
let routes
const jsonRes = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
beforeEach(() => {
  process.env.PDP_CLIENT_ID = "cid"
  process.env.PDP_CLIENT_SECRET = "csecret"
  process.env.PDP_TOKEN_KEY = randomBytes(32).toString("base64")
  process.env.ALLOWED_ORIGINS = "https://zenbat.fr"
  routes = {}
  vi.stubGlobal("fetch", vi.fn(async (url, init = {}) => {
    const u = new URL(url)
    const h = routes[`${init.method || "GET"} ${u.pathname}`]
    if (!h) return jsonRes(404, { error: "no route" })
    return h(u, init)
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe("chiffrement des jetons", () => {
  it("aller-retour, et rien en clair", () => {
    const s = seal("secret-token")
    expect(s).not.toContain("secret-token")
    expect(unseal(s)).toBe("secret-token")
  })
  it("une autre clé ne déchiffre pas", () => {
    const s = seal("x")
    process.env.PDP_TOKEN_KEY = randomBytes(32).toString("base64")
    expect(() => unseal(s)).toThrow()
  })
})

describe("OAuth", () => {
  it("URL d'autorisation : code + PKCE S256 + adresse de retour Zenbat", () => {
    const { challenge } = newPkce()
    const u = new URL(authorizeUrl({ state: "st", challenge }))
    expect(u.origin + u.pathname).toBe("https://api.superpdp.tech/oauth2/authorize")
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      response_type: "code", client_id: "cid", state: "st", code_challenge: challenge,
      code_challenge_method: "S256", redirect_uri: "https://zenbat.fr/api/superpdp/callback",
    })
    expect(redirectUri()).toBe("https://zenbat.fr/api/superpdp/callback")
  })

  it("pdp_connect enregistre un state à usage unique et renvoie l'URL", async () => {
    const db = fakeDb()
    const res = makeRes()
    await handlePdpAction({ body: { action: "pdp_connect" } }, res, { user: { id: "u1" }, admin: db })
    expect(res.statusCode).toBe(200)
    const state = new URL(res.body.url).searchParams.get("state")
    expect(db.tables.pdp_oauth_states).toEqual([expect.objectContaining({ state, user_id: "u1" })])
  })

  it("retour OAuth : échange le code, lit l'entreprise, chiffre les jetons", async () => {
    const db = fakeDb({ pdp_oauth_states: [{ state: "st", user_id: "u1", code_verifier: "ver", created_at: new Date().toISOString() }] })
    let tokenBody
    routes["POST /oauth2/token"] = async (_u, init) => { tokenBody = Object.fromEntries(new URLSearchParams(init.body)); return jsonRes(200, { access_token: "AT", refresh_token: "RT", expires_in: 3600 }) }
    routes["GET /v1.beta/companies/me"] = async () => jsonRes(200, { id: 7, env: "sandbox", number: "123456789", formal_name: "Plomberie Dupont" })
    routes["GET /v1.beta/oauth2_sessions/me"] = async () => jsonRes(200, { company_verification_status: "verified" })
    const res = makeRes()
    await handlePdpCallback({ query: { code: "C", state: "st" } }, res, { admin: db })
    expect(res.headers.Location).toBe("https://zenbat.fr/app?pdp=connected")
    expect(tokenBody).toMatchObject({ grant_type: "authorization_code", code: "C", code_verifier: "ver", client_secret: "csecret" })
    const acc = db.tables.pdp_accounts[0]
    expect(acc).toMatchObject({ user_id: "u1", siren: "123456789", company_name: "Plomberie Dupont", env: "sandbox", verification_status: "verified" })
    expect(acc.refresh_token_enc).not.toContain("RT")
    expect(unseal(acc.refresh_token_enc)).toBe("RT")
    expect(db.tables.pdp_oauth_states).toHaveLength(0) // state consommé
  })

  it("retour OAuth avec un state inconnu ou rejoué → expired, aucun échange", async () => {
    const db = fakeDb()
    const res = makeRes()
    await handlePdpCallback({ query: { code: "C", state: "nope" } }, res, { admin: db })
    expect(res.headers.Location).toBe("https://zenbat.fr/app?pdp=expired")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("refus sur Super PDP → denied", async () => {
    const res = makeRes()
    await handlePdpCallback({ query: { error: "access_denied" } }, res, { admin: fakeDb() })
    expect(res.headers.Location).toBe("https://zenbat.fr/app?pdp=denied")
  })
})

describe("accessTokenFor", () => {
  const account = (over = {}) => ({
    user_id: "u1", access_token_enc: seal("OLD"), refresh_token_enc: seal("RT1"),
    token_expires_at: new Date(Date.now() - 1000).toISOString(), token_version: 3, ...over,
  })

  it("jeton encore valide : pas d'appel réseau", async () => {
    const db = fakeDb({ pdp_accounts: [account({ token_expires_at: new Date(Date.now() + 3600e3).toISOString() })] })
    expect(await accessTokenFor(db, "u1")).toBe("OLD")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("expiré : refresh, et le nouveau refresh token (rotation) est enregistré", async () => {
    const db = fakeDb({ pdp_accounts: [account()] })
    routes["POST /oauth2/token"] = async (_u, init) => {
      expect(new URLSearchParams(init.body).get("refresh_token")).toBe("RT1")
      return jsonRes(200, { access_token: "NEW", refresh_token: "RT2", expires_in: 3600 })
    }
    expect(await accessTokenFor(db, "u1")).toBe("NEW")
    const acc = db.tables.pdp_accounts[0]
    expect(unseal(acc.refresh_token_enc)).toBe("RT2")
    expect(acc.token_version).toBe(4)
  })

  it("refresh refusé → reconnect", async () => {
    const db = fakeDb({ pdp_accounts: [account()] })
    routes["POST /oauth2/token"] = async () => jsonRes(400, { error: "invalid_grant" })
    await expect(accessTokenFor(db, "u1")).rejects.toMatchObject({ code: "reconnect" })
  })

  it("non connecté → not_connected", async () => {
    await expect(accessTokenFor(fakeDb(), "u1")).rejects.toMatchObject({ code: "not_connected", status: 409 })
  })
})

describe("factures reçues", () => {
  const connected = () => fakeDb({ pdp_accounts: [{
    user_id: "u1", access_token_enc: seal("AT"), refresh_token_enc: seal("RT"),
    token_expires_at: new Date(Date.now() + 3600e3).toISOString(), token_version: 0,
  }] })

  it("summarizeInvoice : fournisseur, montants, dernier statut", () => {
    const s = summarizeInvoice({
      id: 9, created_at: "2026-10-01T10:00:00Z",
      en_invoice: { number: "F-12", issue_date: "2026-09-30", currency_code: "EUR",
        seller: { name: "Négoce Matériaux" }, totals: { total_without_vat: "100.00", amount_due_for_payment: "120.00" } },
      events: [
        { id: 2, status_code: "fr:205", created_at: "2026-10-02T00:00:00Z" },
        { id: 1, status_code: "fr:200", created_at: "2026-10-01T00:00:00Z" },
      ],
    })
    expect(s).toMatchObject({ id: 9, number: "F-12", seller_name: "Négoce Matériaux", total_ht: 100, total_ttc: 120, status: "fr:205", status_label: "Approuvée" })
  })

  it("pdp_inbox : factures entrantes avec le jeton de l'artisan", async () => {
    let q, auth
    routes["GET /v1.beta/invoices"] = async (u, init) => { q = u.searchParams; auth = init.headers.Authorization; return jsonRes(200, { data: [{ id: 1, en_invoice: { number: "A" } }], has_after: true }) }
    const res = makeRes()
    await handlePdpAction({ body: { action: "pdp_inbox" } }, res, { user: { id: "u1" }, admin: connected() })
    expect(res.statusCode).toBe(200)
    expect(auth).toBe("Bearer AT")
    expect(q.get("direction")).toBe("in")
    expect(q.getAll("expand[]")).toEqual(["en_invoice"])
    expect(res.body).toMatchObject({ has_after: true, invoices: [{ id: 1, number: "A" }] })
  })

  it("pdp_event : seuls les statuts acheteur sont acceptés", async () => {
    const res = makeRes()
    await handlePdpAction({ body: { action: "pdp_event", invoice_id: 1, status_code: "fr:212" } }, res, { user: { id: "u1" }, admin: connected() })
    expect(res.statusCode).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("pdp_event : approuve la facture", async () => {
    let sent
    routes["POST /v1.beta/invoice_events"] = async (_u, init) => { sent = JSON.parse(init.body); return jsonRes(201, { status_code: "fr:205", created_at: "2026-11-04T09:00:00Z" }) }
    const res = makeRes()
    await handlePdpAction({ body: { action: "pdp_event", invoice_id: 4, status_code: "fr:205" } }, res, { user: { id: "u1" }, admin: connected() })
    expect(sent).toEqual({ invoice_id: 4, status_code: "fr:205" })
    expect(res.body).toMatchObject({ status: "fr:205", status_label: "Approuvée" })
  })

  it("Super PDP renvoie 401 → 409 reconnect (pas pris pour une session Zenbat expirée)", async () => {
    routes["GET /v1.beta/invoices"] = async () => jsonRes(401, { error: "unauthorized" })
    const res = makeRes()
    await handlePdpAction({ body: { action: "pdp_inbox" } }, res, { user: { id: "u1" }, admin: connected() })
    expect(res.statusCode).toBe(409)
    expect(res.body.code).toBe("reconnect")
  })

  it("non connecté → 409 not_connected", async () => {
    const res = makeRes()
    await handlePdpAction({ body: { action: "pdp_inbox" } }, res, { user: { id: "u1" }, admin: fakeDb() })
    expect(res.statusCode).toBe(409)
    expect(res.body.code).toBe("not_connected")
  })
})
