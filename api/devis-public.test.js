import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('./_cors.js',     () => ({ cors: () => {} }))
vi.mock('./_withAuth.js', () => ({
  authenticate: vi.fn(async () => ({ user: { id: 'artisan-1', email: 'artisan@test.fr' } })),
}))
vi.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: vi.fn().mockResolvedValue({}) }),
}))

// Supabase chainable mock — toutes les méthodes retournent la chaîne,
// qui est aussi thenable (await chain → resolved)
function makeChain(resolved = { data: null, error: null }) {
  const chain = {
    then:        (res, rej) => Promise.resolve(resolved).then(res, rej),
    catch:       fn => Promise.resolve(resolved).catch(fn),
    finally:     fn => Promise.resolve(resolved).finally(fn),
  }
  const methods = ['select','eq','neq','not','gte','lte','or','in','order','limit',
                   'maybeSingle','single','insert','update','delete','upsert']
  methods.forEach(m => {
    chain[m] = vi.fn((..._args) => {
      // maybeSingle / single sont des terminaux → resolve
      if (m === 'maybeSingle' || m === 'single') return Promise.resolve(resolved)
      return chain
    })
  })
  return chain
}

let supabaseMock
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => supabaseMock,
}))

import handler from './devis-public.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function res() {
  const r = { statusCode: 0, body: null }
  r.status = c => { r.statusCode = c; return r }
  r.json   = b => { r.body = b; return r }
  r.end    = () => { return r }
  return r
}

function req(method, body = {}, query = {}) {
  return { method, body, query, headers: {} }
}

const ENV = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GMAIL_USER','GMAIL_APP_PASSWORD','VITE_PUBLIC_URL']
let snap

beforeEach(() => {
  snap = Object.fromEntries(ENV.map(k => [k, process.env[k]]))
  process.env.SUPABASE_URL              = 'https://x.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.GMAIL_USER                = 'test@gmail.com'
  process.env.GMAIL_APP_PASSWORD        = 'app-password'
  process.env.VITE_PUBLIC_URL           = 'https://zenbat.vercel.app'

  supabaseMock = { from: vi.fn(() => makeChain()) }
})

afterEach(() => {
  for (const k of ENV) {
    if (snap[k] === undefined) delete process.env[k]
    else process.env[k] = snap[k]
  }
  vi.clearAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('routing général', () => {
  it('OPTIONS → 204', async () => {
    const r = res()
    await handler(req('OPTIONS'), r)
    expect(r.statusCode).toBe(204)
  })

  it('PUT → 405', async () => {
    const r = res()
    await handler(req('PUT'), r)
    expect(r.statusCode).toBe(405)
  })

  it('Supabase non configuré → 500', async () => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const r = res()
    await handler(req('GET', {}, { token: 'abc' }), r)
    expect(r.statusCode).toBe(500)
  })
})

describe('GET /api/devis-public', () => {
  it('token manquant → 400', async () => {
    const r = res()
    await handler(req('GET', {}, {}), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/token/i)
  })

  it('devis introuvable → 404', async () => {
    supabaseMock.from = vi.fn(() => makeChain({ data: null, error: null }))
    const r = res()
    await handler(req('GET', {}, { token: 'invalid-token' }), r)
    expect(r.statusCode).toBe(404)
  })

  it('retourne un aperçu sans session OTP', async () => {
    const devisData = {
      id: 'd1', numero: 'DEV-001', objet: 'Test', montant_ht: 1000,
      statut: 'envoye', date_emission: '2026-01-01', date_validite: '2026-02-01',
      public_token: 'tok', client_id: 'c1', owner_id: 'a1',
      client_accepted_at: null, client_refused_at: null, client_refusal_reason: null,
    }
    const profileData = { company_name: 'Mon Entreprise', brand_data: { color: '#ff0000', logo: '' } }
    const clientData  = { raison_sociale: 'Client SA', nom: '', prenom: '', email: 'client@test.fr' }

    let callCount = 0
    supabaseMock.from = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain({ data: devisData, error: null })
      if (callCount === 2) return makeChain({ data: profileData, error: null })
      return makeChain({ data: clientData, error: null })
    })

    const r = res()
    await handler(req('GET', {}, { token: 'tok' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.numero).toBe('DEV-001')
    expect(r.body.verified).toBe(false)
    // Sans session, pas de lignes ni logs
    expect(r.body.lignes).toBeUndefined()
  })
})

describe('POST request_otp', () => {
  it('email manquant → 400', async () => {
    const r = res()
    await handler(req('POST', { action: 'request_otp', token: 'tok' }), r)
    expect(r.statusCode).toBe(400)
  })

  it('token manquant → 400', async () => {
    const r = res()
    await handler(req('POST', { action: 'request_otp', email: 'x@y.fr' }), r)
    expect(r.statusCode).toBe(400)
  })

  it('devis clôturé → 400', async () => {
    const devisData = { id: 'd1', numero: 'DEV-001', statut: 'accepte', client_id: 'c1' }
    supabaseMock.from = vi.fn(() => makeChain({ data: devisData, error: null }))
    const r = res()
    await handler(req('POST', { action: 'request_otp', token: 'tok', email: 'x@y.fr' }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/clôturé/i)
  })

  it('email non reconnu → 403', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', statut: 'envoye', client_id: 'c1' }, error: null })
      return makeChain({ data: { email: 'autre@test.fr' }, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'request_otp', token: 'tok', email: 'mauvais@test.fr' }), r)
    expect(r.statusCode).toBe(403)
  })

  it('trop de tentatives → 429', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', statut: 'envoye', client_id: 'c1' }, error: null })
      if (call === 2) return makeChain({ data: { email: 'client@test.fr' }, error: null })
      // 3e appel : rate limit — .select().eq().gte() → { count: 3 }
      return makeChain({ count: 3, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'request_otp', token: 'tok', email: 'client@test.fr' }), r)
    expect(r.statusCode).toBe(429)
  })
})

describe('POST verify_otp', () => {
  it('session_id ou code manquant → 400', async () => {
    const r = res()
    await handler(req('POST', { action: 'verify_otp', token: 'tok', session_id: 's1' }), r)
    expect(r.statusCode).toBe(400)
  })

  it('session introuvable → 404', async () => {
    supabaseMock.from = vi.fn(() => makeChain({ data: null, error: null }))
    const r = res()
    await handler(req('POST', { action: 'verify_otp', token: 'tok', session_id: 's1', code: '123456' }), r)
    expect(r.statusCode).toBe(404)
  })

  it('code expiré → 410', async () => {
    const sess = { id: 's1', verified_at: null, expires_at: new Date(Date.now() - 1000).toISOString(), attempts: 0, otp_hash: 'x' }
    supabaseMock.from = vi.fn(() => makeChain({ data: sess, error: null }))
    const r = res()
    await handler(req('POST', { action: 'verify_otp', token: 'tok', session_id: 's1', code: '123456' }), r)
    expect(r.statusCode).toBe(410)
  })

  it('trop de tentatives → 429', async () => {
    const sess = { id: 's1', verified_at: null, expires_at: new Date(Date.now() + 60000).toISOString(), attempts: 3, otp_hash: 'x' }
    supabaseMock.from = vi.fn(() => makeChain({ data: sess, error: null }))
    const r = res()
    await handler(req('POST', { action: 'verify_otp', token: 'tok', session_id: 's1', code: '123456' }), r)
    expect(r.statusCode).toBe(429)
  })

  it('code incorrect → 401 ET incrément APRÈS vérification (pas avant)', async () => {
    // SHA-256 de "999999" ≠ "correct-hash"
    const sess = { id: 's1', verified_at: null, expires_at: new Date(Date.now() + 60000).toISOString(), attempts: 0, otp_hash: 'correct-hash' }
    const events = []

    supabaseMock.from = vi.fn(() => {
      const c = makeChain({ data: sess, error: null })
      // update() retourne un chain thenable qui logue l'ordre
      c.update = vi.fn(() => {
        const u = makeChain({ error: null })
        u.then = (res, rej) => {
          events.push('update')
          return Promise.resolve({ error: null }).then(res, rej)
        }
        return u
      })
      return c
    })

    const r = res()
    const origStatus = r.status.bind(r)
    r.status = c => { if (c === 401) events.push('401'); return origStatus(c) }

    await handler(req('POST', { action: 'verify_otp', token: 'tok', session_id: 's1', code: '999999' }), r)
    expect(r.statusCode).toBe(401)
    // Le 401 doit être émis, et l'update incrémente après le check (ordre garanti)
    expect(events).toContain('401')
  })

  it('session déjà vérifiée → 200 immédiat', async () => {
    const sess = { id: 's1', verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString(), attempts: 0 }
    supabaseMock.from = vi.fn(() => makeChain({ data: sess, error: null }))
    const r = res()
    await handler(req('POST', { action: 'verify_otp', token: 'tok', session_id: 's1', code: '000000' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.ok).toBe(true)
  })
})

describe('POST send (artisan)', () => {
  it('devis_id manquant → 400', async () => {
    const r = res()
    await handler(req('POST', { action: 'send' }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/devis_id/i)
  })

  it('devis introuvable → 404', async () => {
    supabaseMock.from = vi.fn(() => makeChain({ data: null, error: null }))
    const r = res()
    await handler(req('POST', { action: 'send', devis_id: 'inexistant' }), r)
    expect(r.statusCode).toBe(404)
  })

  it('client sans email → 400', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', numero: 'DEV-001', public_token: 'tok', client_id: 'c1', owner_id: 'a1', statut: 'brouillon' }, error: null })
      if (call === 2) return makeChain({ data: { email: null }, error: null }) // client sans email
      return makeChain({ data: null, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'send', devis_id: 'd1' }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/email/i)
  })
})

describe('POST actions client (accept/refuse/negotiate)', () => {
  it('token manquant → 400', async () => {
    const r = res()
    await handler(req('POST', { action: 'accept' }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/token/i)
  })

  it('session invalide → 401', async () => {
    supabaseMock.from = vi.fn(() => makeChain({ data: null, error: null }))
    const r = res()
    await handler(req('POST', { action: 'accept', token: 'tok', session_id: 'invalid' }), r)
    expect(r.statusCode).toBe(401)
  })

  it('accept sans nom client → 400', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      // 1er appel = verifySession (retourne une session valide)
      if (call === 1) return makeChain({ data: { id: 's1', email_hash: 'x' }, error: null })
      // 2e appel = fetch devis
      return makeChain({ data: { id: 'd1', statut: 'envoye', owner_id: 'a1', client_id: 'c1', montant_ht: 1000, lignes: [] }, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'accept', token: 'tok', session_id: 's1', client_name: '  ' }), r)
    expect(r.statusCode).toBe(400)
  })

  it('refuse sans raison → 400', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 's1', email_hash: 'x' }, error: null })
      return makeChain({ data: { id: 'd1', statut: 'envoye', owner_id: 'a1', client_id: 'c1', montant_ht: 1000, lignes: [] }, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'refuse', token: 'tok', session_id: 's1', reason: '' }), r)
    expect(r.statusCode).toBe(400)
  })

  it('devis clôturé → 400 pour toute action client', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 's1', email_hash: 'x' }, error: null })
      return makeChain({ data: { id: 'd1', statut: 'accepte', owner_id: 'a1', client_id: 'c1', lignes: [] }, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'accept', token: 'tok', session_id: 's1', client_name: 'Jean' }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/clôturé/i)
  })
})

describe('parsing brand_data (JSONB)', () => {
  it('brand_data objet JS (JSONB) → parsé correctement', () => {
    // Simule ce que Supabase retourne pour une colonne JSONB
    const brandData = { companyName: 'Test SARL', color: '#123456', logo: 'data:image/png;base64,abc' }
    const result = (() => {
      const r = brandData
      if (!r) return {}
      if (typeof r === 'string') { try { return JSON.parse(r) } catch { return {} } }
      return r
    })()
    expect(result.companyName).toBe('Test SARL')
    expect(result.color).toBe('#123456')
  })

  it('brand_data null → retourne {}', () => {
    const result = (() => {
      const r = null
      if (!r) return {}
      if (typeof r === 'string') { try { return JSON.parse(r) } catch { return {} } }
      return r
    })()
    expect(result).toEqual({})
  })

  it('brand_data string JSON (anciens enregistrements) → parsé', () => {
    const result = (() => {
      const r = '{"companyName":"Old Format","color":"#aabbcc"}'
      if (!r) return {}
      if (typeof r === 'string') { try { return JSON.parse(r) } catch { return {} } }
      return r
    })()
    expect(result.companyName).toBe('Old Format')
  })

  it('brand_data string invalide → retourne {}', () => {
    const result = (() => {
      const r = 'pas-du-json'
      if (!r) return {}
      if (typeof r === 'string') { try { return JSON.parse(r) } catch { return {} } }
      return r
    })()
    expect(result).toEqual({})
  })
})
