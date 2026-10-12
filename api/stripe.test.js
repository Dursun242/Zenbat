// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'

// ── Mocks ──────────────────────────────────────────────────────────────────
// Stripe : la vérification de signature est la VRAIE (webhooks.constructEvent
// de la librairie, HMAC sur le corps brut) ; seuls les appels réseau sont
// simulés.
const { stripeApi, signer } = vi.hoisted(() => ({
  stripeApi: {
    subscriptions:  { update: null, retrieve: null },
    customers:      { retrieve: null, create: null },
    checkout:       { sessions: { create: null } },
    billingPortal:  { sessions: { create: null } },
  },
  signer: { webhooks: null },
}))

vi.mock('stripe', async (importOriginal) => {
  const real = await importOriginal()
  const RealStripe = real.default
  signer.webhooks = new RealStripe('sk_test_signer').webhooks
  function FakeStripe() {
    return { ...stripeApi, webhooks: signer.webhooks }
  }
  return { default: FakeStripe }
})

let supabaseMock
vi.mock('@supabase/supabase-js', () => ({ createClient: () => supabaseMock }))
vi.mock('./_cors.js', () => ({ cors: () => {} }))
vi.mock('./_serverLog.js', () => ({ logServerError: vi.fn(async () => {}) }))
// authenticate reste le vrai (on veut le 401 réel) ; seule la notif Telegram
// est neutralisée.
vi.mock('./_withAuth.js', async (importOriginal) => ({
  ...(await importOriginal()),
  notifyTelegram: vi.fn(async () => {}),
}))

import handler from './stripe.js'
import { notifyTelegram } from './_withAuth.js'

// ── Faux Supabase : enregistre chaque requête (table + opérations) ─────────
function makeDb(resolver) {
  const calls = []
  const from = vi.fn((table) => {
    const ops = []
    calls.push({ table, ops })
    const settle = () => Promise.resolve(resolver(table, ops) ?? { data: null, error: null })
    const chain = {
      then:  (a, b) => settle().then(a, b),
      catch: (f) => settle().catch(f),
    }
    for (const m of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'is', 'gte', 'lte', 'order', 'limit']) {
      chain[m] = (...args) => { ops.push([m, ...args]); return chain }
    }
    chain.maybeSingle = () => { ops.push(['maybeSingle']); return settle() }
    chain.single = chain.maybeSingle
    return chain
  })
  return { from, calls }
}
const opArgs = (call, name) => call.ops.find(o => o[0] === name)?.slice(1)
const eqVal  = (ops, col) => ops.find(o => o[0] === 'eq' && o[1] === col)?.[2]

// ── Requêtes / réponses ────────────────────────────────────────────────────
function makeReq({ method = 'POST', headers = {}, chunks = [], url = '/api/stripe' } = {}) {
  const r = Readable.from(chunks)
  r.method = method
  r.headers = headers
  r.url = url
  return r
}
function makeRes() {
  const r = { statusCode: 0, body: null, headers: {} }
  r.status    = c => { r.statusCode = c; return r }
  r.json      = b => { r.body = b; return r }
  r.end       = () => r
  r.setHeader = (k, v) => { r.headers[k] = v }
  return r
}

const WH_SECRET = 'whsec_test_secret'
function signedReq(event, { payload } = {}) {
  const body = payload ?? JSON.stringify(event)
  const sig  = signer.webhooks.generateTestHeaderString({ payload: body, secret: WH_SECRET })
  return makeReq({ headers: { 'stripe-signature': sig }, chunks: [Buffer.from(body)] })
}
const evt = (type, object, id = 'evt_1') => ({ id, type, data: { object } })

// ── État simulé de la base pour le webhook ─────────────────────────────────
let processed, profilesByCustomer, profileUpdateErrors
function webhookResolver(table, ops) {
  const kind = ops[0]?.[0]
  if (table === 'stripe_webhook_events') {
    if (kind === 'insert') {
      const id = ops[0][1].event_id
      if (processed.has(id)) return { data: null, error: { code: '23505', message: 'duplicate key' } }
      processed.add(id)
      return { data: null, error: null }
    }
    if (kind === 'delete') { processed.delete(eqVal(ops, 'event_id')); return { error: null } }
  }
  if (table === 'profiles') {
    if (kind === 'select') return { data: profilesByCustomer[eqVal(ops, 'stripe_customer_id')] ?? null, error: null }
    if (kind === 'update') return { data: null, error: profileUpdateErrors.shift() ?? null }
  }
  return { data: null, error: null }
}

const ENV = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ALLOWED_ORIGINS']
let snap, db

beforeEach(() => {
  snap = Object.fromEntries(ENV.map(k => [k, process.env[k]]))
  process.env.STRIPE_SECRET_KEY         = 'sk_test_x'
  process.env.STRIPE_WEBHOOK_SECRET     = WH_SECRET
  process.env.SUPABASE_URL              = 'https://x.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.ALLOWED_ORIGINS           = 'https://zenbat.fr/, https://autre.fr'

  processed           = new Set()
  profilesByCustomer  = { cus_1: { id: 'user-1' } }
  profileUpdateErrors = []
  db = makeDb(webhookResolver)
  supabaseMock = {
    from: db.from,
    auth: {
      getUser: vi.fn(async (token) => token === 'good'
        ? { data: { user: { id: 'user-1', email: 'artisan@test.fr' } }, error: null }
        : { data: { user: null }, error: { status: 401, message: 'invalid JWT' } }),
      admin: { getUserById: vi.fn(async () => ({ data: { user: { email: 'artisan@test.fr' } } })) },
    },
  }
  stripeApi.subscriptions.update   = vi.fn(async () => ({}))
  stripeApi.subscriptions.retrieve = vi.fn()
  stripeApi.customers.retrieve     = vi.fn()
  stripeApi.customers.create       = vi.fn(async () => ({ id: 'cus_new' }))
  stripeApi.checkout.sessions.create      = vi.fn(async () => ({ url: 'https://checkout.stripe.test/s' }))
  stripeApi.billingPortal.sessions.create = vi.fn(async () => ({ url: 'https://billing.stripe.test/p' }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  for (const k of ENV) {
    if (snap[k] === undefined) delete process.env[k]
    else process.env[k] = snap[k]
  }
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

const profileUpdates = () => db.calls.filter(c => c.table === 'profiles' && c.ops[0][0] === 'update')

// ── Webhook ────────────────────────────────────────────────────────────────
describe('webhook — vérification de signature', () => {
  it('signature invalide → 400, aucune écriture en base', async () => {
    const r = makeRes()
    await handler(makeReq({ headers: { 'stripe-signature': 't=1,v1=deadbeef' }, chunks: [Buffer.from('{"id":"evt_x"}')] }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/Signature invalide/)
    expect(db.from).not.toHaveBeenCalled()
  })

  it('signée avec un autre secret → 400', async () => {
    const body = JSON.stringify(evt('checkout.session.completed', {}))
    const sig  = signer.webhooks.generateTestHeaderString({ payload: body, secret: 'whsec_autre' })
    const r = makeRes()
    await handler(makeReq({ headers: { 'stripe-signature': sig }, chunks: [Buffer.from(body)] }), r)
    expect(r.statusCode).toBe(400)
  })

  it('?route=webhook sans en-tête de signature → traité comme webhook, 400', async () => {
    const r = makeRes()
    await handler(makeReq({ url: '/api/stripe?route=webhook', chunks: [Buffer.from('{}')] }), r)
    expect(r.statusCode).toBe(400)
  })

  it('webhook en GET → 405', async () => {
    const r = makeRes()
    await handler(makeReq({ method: 'GET', headers: { 'stripe-signature': 'x' } }), r)
    expect(r.statusCode).toBe(405)
  })

  it('secret webhook absent → 500', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const r = makeRes()
    await handler(signedReq(evt('ping', {})), r)
    expect(r.statusCode).toBe(500)
  })

  it('corps brut : signature calculée sur les octets exacts (espaces, accents, morceaux multiples)', async () => {
    // JSON indenté avec accents : un re-sérialisé (JSON.stringify(JSON.parse()))
    // ne correspondrait plus à la signature.
    const payload = JSON.stringify(evt('checkout.session.completed', {
      mode: 'payment', customer: 'cus_1', metadata: { note: 'Électricité — été' },
    }), null, 2)
    const sig = signer.webhooks.generateTestHeaderString({ payload, secret: WH_SECRET })
    const buf = Buffer.from(payload)
    const r = makeRes()
    // Corps reçu en trois morceaux dont une chaîne : getRawBody doit les recoller.
    await handler(makeReq({
      headers: { 'stripe-signature': sig },
      chunks: [buf.subarray(0, 10), buf.subarray(10, 40).toString('utf8'), buf.subarray(40)],
    }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body).toEqual({ received: true })
  })

  it('corps modifié d’un octet après signature → 400', async () => {
    const payload = JSON.stringify(evt('checkout.session.completed', { mode: 'subscription', customer: 'cus_1' }))
    const sig = signer.webhooks.generateTestHeaderString({ payload, secret: WH_SECRET })
    const r = makeRes()
    await handler(makeReq({ headers: { 'stripe-signature': sig }, chunks: [Buffer.from(payload + ' ')] }), r)
    expect(r.statusCode).toBe(400)
    expect(profileUpdates()).toHaveLength(0)
  })
})

describe('webhook — checkout.session.completed', () => {
  const session = (over = {}) => ({
    mode: 'subscription', customer: 'cus_1', subscription: 'sub_1',
    metadata: { plan: 'monthly' }, amount_total: 1900,
    customer_details: { email: 'client@test.fr' }, ...over,
  })

  it('abonnement mensuel → profil passé en pro (pro_until effacé), notif paiement', async () => {
    const r = makeRes()
    await handler(signedReq(evt('checkout.session.completed', session())), r)
    expect(r.statusCode).toBe(200)
    const [up] = profileUpdates()
    expect(opArgs(up, 'update')[0]).toEqual({
      plan: 'pro', billing_cycle: 'monthly', stripe_subscription_id: 'sub_1', pro_until: null,
    })
    expect(eqVal(up.ops, 'id')).toBe('user-1')
    expect(stripeApi.subscriptions.update).not.toHaveBeenCalled()
    expect(notifyTelegram).toHaveBeenCalledWith('payment_success', { email: 'client@test.fr', plan: 'monthly', amount: 19 })
  })

  it("abonnement 6 mois : échec de l'annulation chez Stripe → 500, profil inchangé, nouvel essai possible", async () => {
    stripeApi.subscriptions.update = vi.fn(async () => { throw new Error('Stripe indisponible') })
    const r = makeRes()
    await handler(signedReq(evt('checkout.session.completed', session({ metadata: { plan: 'biannual' }, amount_total: 5700 }))), r)
    expect(r.statusCode).toBe(500)
    expect(profileUpdates()).toHaveLength(0)
    expect(processed.has('evt_1')).toBe(false)
  })

  it('abonnement 6 mois → billing_cycle biannual + annulation en fin de période', async () => {
    const r = makeRes()
    await handler(signedReq(evt('checkout.session.completed', session({ metadata: { plan: 'biannual' }, amount_total: 5700 }))), r)
    expect(r.statusCode).toBe(200)
    expect(opArgs(profileUpdates()[0], 'update')[0].billing_cycle).toBe('biannual')
    expect(stripeApi.subscriptions.update).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true })
  })

  it('paiement ponctuel (mode payment) → ignoré', async () => {
    const r = makeRes()
    await handler(signedReq(evt('checkout.session.completed', session({ mode: 'payment' }))), r)
    expect(r.statusCode).toBe(200)
    expect(profileUpdates()).toHaveLength(0)
  })

  it('client Stripe inconnu → 200 sans mise à jour (pas de retry inutile)', async () => {
    const r = makeRes()
    await handler(signedReq(evt('checkout.session.completed', session({ customer: 'cus_inconnu' }))), r)
    expect(r.statusCode).toBe(200)
    expect(profileUpdates()).toHaveLength(0)
  })

  it('colonne pro_until absente (42703) → nouvel essai sans la colonne', async () => {
    profileUpdateErrors = [{ code: '42703', message: 'column pro_until does not exist' }]
    const r = makeRes()
    await handler(signedReq(evt('checkout.session.completed', session())), r)
    expect(r.statusCode).toBe(200)
    const ups = profileUpdates()
    expect(ups).toHaveLength(2)
    expect(opArgs(ups[1], 'update')[0]).not.toHaveProperty('pro_until')
    expect(opArgs(ups[1], 'update')[0].plan).toBe('pro')
  })

  it('UPDATE profil en échec → 500 et trace de dédup retirée pour que le retry Stripe repasse', async () => {
    profileUpdateErrors = [{ code: '57014', message: 'timeout' }]
    const r = makeRes()
    await handler(signedReq(evt('checkout.session.completed', session())), r)
    expect(r.statusCode).toBe(500)
    expect(processed.has('evt_1')).toBe(false)

    // Le retry Stripe est bien retraité
    const r2 = makeRes()
    await handler(signedReq(evt('checkout.session.completed', session())), r2)
    expect(r2.statusCode).toBe(200)
    expect(r2.body.duplicate).toBeUndefined()
    expect(profileUpdates()).toHaveLength(2)
  })
})

describe('webhook — idempotence', () => {
  it('même événement reçu deux fois → traité une seule fois, 2ᵉ réponse duplicate', async () => {
    const e = evt('checkout.session.completed', {
      mode: 'subscription', customer: 'cus_1', subscription: 'sub_1', metadata: { plan: 'monthly' },
    }, 'evt_dup')
    const r1 = makeRes(); await handler(signedReq(e), r1)
    const r2 = makeRes(); await handler(signedReq(e), r2)
    expect(r1.statusCode).toBe(200)
    expect(r2.statusCode).toBe(200)
    expect(r2.body).toEqual({ received: true, duplicate: true })
    expect(profileUpdates()).toHaveLength(1)
    expect(notifyTelegram).toHaveBeenCalledTimes(1)
  })

  it('table de dédup absente (42P01) → le webhook est quand même traité', async () => {
    const base = webhookResolver
    db = makeDb((table, ops) => table === 'stripe_webhook_events'
      ? { error: { code: '42P01', message: 'relation does not exist' } }
      : base(table, ops))
    supabaseMock.from = db.from
    const r = makeRes()
    await handler(signedReq(evt('customer.subscription.deleted', { customer: 'cus_1' })), r)
    expect(r.statusCode).toBe(200)
    expect(profileUpdates()).toHaveLength(1)
  })
})

describe('webhook — cycle de vie de l’abonnement', () => {
  it('customer.subscription.deleted → profil repassé en free', async () => {
    const r = makeRes()
    await handler(signedReq(evt('customer.subscription.deleted', { id: 'sub_1', customer: 'cus_1' })), r)
    expect(r.statusCode).toBe(200)
    const [up] = profileUpdates()
    expect(opArgs(up, 'update')[0]).toEqual({ plan: 'free', billing_cycle: null, stripe_subscription_id: null })
    expect(eqVal(up.ops, 'id')).toBe('user-1')
    expect(notifyTelegram).toHaveBeenCalledWith('subscription_canceled', { email: 'artisan@test.fr' })
  })

  it('customer.subscription.deleted en échec d’écriture → 500 (retry Stripe)', async () => {
    profileUpdateErrors = [{ code: '57014', message: 'timeout' }]
    const r = makeRes()
    await handler(signedReq(evt('customer.subscription.deleted', { customer: 'cus_1' })), r)
    expect(r.statusCode).toBe(500)
    expect(processed.has('evt_1')).toBe(false)
  })

  it('customer.subscription.deleted pour un client inconnu → 200 sans écriture', async () => {
    const r = makeRes()
    await handler(signedReq(evt('customer.subscription.deleted', { customer: 'cus_zzz' })), r)
    expect(r.statusCode).toBe(200)
    expect(profileUpdates()).toHaveLength(0)
  })

  it('customer.subscription.updated unpaid → plan free', async () => {
    profilesByCustomer.cus_1 = { id: 'user-1', stripe_subscription_id: 'sub_1' }
    const r = makeRes()
    await handler(signedReq(evt('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', status: 'unpaid' })), r)
    expect(r.statusCode).toBe(200)
    expect(opArgs(profileUpdates()[0], 'update')[0]).toMatchObject({ plan: 'free', stripe_subscription_id: null })
  })

  it('customer.subscription.updated past_due → Pro gardé pendant les relances', async () => {
    const r = makeRes()
    await handler(signedReq(evt('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', status: 'past_due' })), r)
    expect(r.statusCode).toBe(200)
    expect(profileUpdates()).toHaveLength(0)
  })

  it("customer.subscription.updated d'un ancien abonnement → profil intact", async () => {
    profilesByCustomer.cus_1 = { id: 'user-1', stripe_subscription_id: 'sub_nouveau' }
    const r = makeRes()
    await handler(signedReq(evt('customer.subscription.updated', { id: 'sub_ancien', customer: 'cus_1', status: 'canceled' })), r)
    expect(profileUpdates()).toHaveLength(0)
  })
})

// ── Actions authentifiées ──────────────────────────────────────────────────
function actionReq(body, { token, method = 'POST' } = {}) {
  const headers = token ? { authorization: `Bearer ${token}` } : {}
  return makeReq({ method, headers, chunks: body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))] })
}

describe('actions POST (checkout, portal, info)', () => {
  it.each(['checkout', 'portal', 'info'])('%s sans jeton → 401, Stripe non appelé', async (action) => {
    const r = makeRes()
    await handler(actionReq({ action, plan: 'monthly' }), r)
    expect(r.statusCode).toBe(401)
    expect(stripeApi.checkout.sessions.create).not.toHaveBeenCalled()
    expect(stripeApi.billingPortal.sessions.create).not.toHaveBeenCalled()
  })

  it('jeton invalide → 401', async () => {
    const r = makeRes()
    await handler(actionReq({ action: 'info' }, { token: 'bad' }), r)
    expect(r.statusCode).toBe(401)
  })

  it('OPTIONS → 204 ; GET → 405', async () => {
    const r1 = makeRes(); await handler(actionReq(undefined, { method: 'OPTIONS' }), r1)
    const r2 = makeRes(); await handler(actionReq(undefined, { method: 'GET' }), r2)
    expect(r1.statusCode).toBe(204)
    expect(r2.statusCode).toBe(405)
  })

  it('JSON invalide → 400', async () => {
    const r = makeRes()
    await handler(actionReq('{pas du json', { token: 'good' }), r)
    expect(r.statusCode).toBe(400)
  })

  it('info sans abonnement → plan du profil, subscription null', async () => {
    db = makeDb((t) => t === 'profiles' ? { data: { plan: 'free', stripe_subscription_id: null }, error: null } : {})
    supabaseMock.from = db.from
    const r = makeRes()
    await handler(actionReq({ action: 'info' }, { token: 'good' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body).toEqual({ plan: 'free', subscription: null })
    expect(eqVal(db.calls[0].ops, 'id')).toBe('user-1')
  })

  it('portal sans client Stripe → 400', async () => {
    db = makeDb(() => ({ data: { stripe_customer_id: null }, error: null }))
    supabaseMock.from = db.from
    const r = makeRes()
    await handler(actionReq({ action: 'portal' }, { token: 'good' }), r)
    expect(r.statusCode).toBe(400)
  })

  it('portal → URL du portail, retour vers la 1ʳᵉ origine autorisée', async () => {
    db = makeDb(() => ({ data: { stripe_customer_id: 'cus_1' }, error: null }))
    supabaseMock.from = db.from
    const r = makeRes()
    await handler(actionReq({ action: 'portal' }, { token: 'good' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.url).toBe('https://billing.stripe.test/p')
    expect(stripeApi.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_1', return_url: 'https://zenbat.fr/app?stripe=portal_return',
    })
  })

  it('checkout plan invalide → 400', async () => {
    const r = makeRes()
    await handler(actionReq({ action: 'checkout', plan: 'gratuit-a-vie' }, { token: 'good' }), r)
    expect(r.statusCode).toBe(400)
    expect(stripeApi.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('checkout sans client Stripe → client créé, enregistré sur le profil, session à 19 €', async () => {
    db = makeDb((t, ops) => ops[0][0] === 'select' ? { data: { stripe_customer_id: null, company_name: 'ACME' }, error: null } : { error: null })
    supabaseMock.from = db.from
    const r = makeRes()
    await handler(actionReq({ plan: 'monthly' }, { token: 'good' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.url).toBe('https://checkout.stripe.test/s')
    expect(stripeApi.customers.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'artisan@test.fr', name: 'ACME', metadata: { supabase_user_id: 'user-1' },
    }))
    const up = db.calls.find(c => c.ops[0][0] === 'update')
    expect(opArgs(up, 'update')[0]).toEqual({ stripe_customer_id: 'cus_new' })
    expect(eqVal(up.ops, 'id')).toBe('user-1')
    const args = stripeApi.checkout.sessions.create.mock.calls[0][0]
    expect(args.customer).toBe('cus_new')
    expect(args.line_items[0].price_data.unit_amount).toBe(1900)
    expect(args.subscription_data.metadata).toEqual({ plan: 'monthly', supabase_user_id: 'user-1' })
  })

  it('erreur Stripe → 500 avec message générique (pas de fuite)', async () => {
    db = makeDb(() => ({ data: { stripe_customer_id: 'cus_1' }, error: null }))
    supabaseMock.from = db.from
    stripeApi.customers.retrieve = vi.fn(async () => { throw Object.assign(new Error('No such customer: cus_1 (sk_live_…)'), { code: 'api_error' }) })
    const r = makeRes()
    await handler(actionReq({ plan: 'biannual' }, { token: 'good' }), r)
    expect(r.statusCode).toBe(500)
    expect(r.body.error).not.toMatch(/cus_1|sk_/)
  })
})
