import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'crypto'

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const { sendMailMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn().mockResolvedValue({}),
}))

vi.mock('./_cors.js',     () => ({ cors: () => {} }))
vi.mock('./_withAuth.js', () => ({
  authenticate: vi.fn(async () => ({ user: { id: 'artisan-1', email: 'artisan@test.fr' } })),
}))
vi.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: sendMailMock }),
}))

// Supabase chainable mock — toutes les méthodes retournent la chaîne,
// qui est aussi thenable (await chain → resolved)
function makeChain(resolved = { data: null, error: null }) {
  const chain = {
    then:    (res, rej) => Promise.resolve(resolved).then(res, rej),
    catch:   fn => Promise.resolve(resolved).catch(fn),
    finally: fn => Promise.resolve(resolved).finally(fn),
  }
  const methods = ['select','eq','neq','not','gte','lte','or','in','order','limit',
                   'maybeSingle','single','insert','update','delete','upsert']
  methods.forEach(m => {
    chain[m] = vi.fn((..._args) => {
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
const hashCode = c => createHash('sha256').update(String(c)).digest('hex')

function res() {
  const r = { statusCode: 0, body: null }
  r.status = c => { r.statusCode = c; return r }
  r.json   = b => { r.body = b; return r }
  r.end    = () => r
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

  it('action inconnue (avec session valide) → 400', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 's1', email_hash: 'x' }, error: null }) // verifySession
      return makeChain({ data: { id: 'd1', statut: 'envoye', owner_id: 'a1', client_id: 'c1', montant_ht: 100, lignes: [] }, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'teleport', token: 'tok', session_id: 's1' }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/action invalide/i)
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

  it('aperçu sans session OTP : pas de lignes ni client', async () => {
    const devisData = {
      id: 'd1', numero: 'DEV-001', objet: 'Test', montant_ht: 1000,
      statut: 'envoye', date_emission: '2026-01-01', date_validite: '2026-02-01',
      public_token: 'tok', client_id: 'c1', owner_id: 'a1',
      client_accepted_at: null, client_refused_at: null, client_refusal_reason: null,
    }
    const profileData = { company_name: 'Mon Entreprise', brand_data: { color: '#ff0000', logo: '' } }
    const clientData  = { raison_sociale: 'Client SA', nom: '', prenom: '', email: 'client@test.fr' }

    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: devisData, error: null })
      if (call === 2) return makeChain({ data: profileData, error: null })
      return makeChain({ data: clientData, error: null })
    })

    const r = res()
    await handler(req('GET', {}, { token: 'tok' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.numero).toBe('DEV-001')
    expect(r.body.verified).toBe(false)
    expect(r.body.lignes).toBeUndefined()
  })

  it('aperçu avec session vérifiée → retourne lignes + client + docs', async () => {
    const devisData = {
      id: 'd1', numero: 'DEV-001', objet: 'Carrelage', montant_ht: 2500,
      statut: 'envoye', date_emission: '2026-01-01', date_validite: '2026-06-01',
      public_token: 'tok', client_id: 'c1', owner_id: 'a1',
      client_accepted_at: null, client_refused_at: null, client_refusal_reason: null,
      lignes: [{ id: 'l1', position: 1, designation: 'Carrelage', quantite: 10, prix_unitaire: 100, type_ligne: 'ouvrage' }],
    }
    const profileData = { company_name: 'Pro SARL', brand_data: { color: '#0077cc' } }
    const clientData  = { raison_sociale: '', nom: 'Dupont', prenom: 'Jean', email: 'jean@test.fr' }

    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: devisData, error: null })    // devis
      if (call === 2) return makeChain({ data: profileData, error: null })  // profile
      if (call === 3) return makeChain({ data: clientData, error: null })   // client
      if (call === 4) return makeChain({ data: { id: 's1', email_hash: 'x' }, error: null }) // verifySession
      if (call === 5) return makeChain({ data: [], error: null })           // documents
      if (call === 6) return makeChain({ data: [], error: null })           // audit_log
      return makeChain({ data: null, error: null })                         // negotiation
    })

    const r = res()
    await handler(req('GET', {}, { token: 'tok', session_id: 's1' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.verified).toBe(true)
    expect(r.body.lignes).toHaveLength(1)
    expect(r.body.client.name).toBe('Jean Dupont')
    expect(r.body.docs).toEqual([])
  })

  it('artisan fields exposés : color, logo, brand complet', async () => {
    const brand = { color: '#abcdef', logo: 'https://cdn.test/logo.png', email: 'pro@test.fr', phone: '0600000000', address: '1 rue Test', siret: '12345678901234' }
    const devisData = { id: 'd1', numero: 'DEV-002', objet: null, montant_ht: 500, statut: 'envoye', date_emission: '2026-01-01', date_validite: null, public_token: 'tok', client_id: 'c1', owner_id: 'a1', client_accepted_at: null, client_refused_at: null, client_refusal_reason: null }
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: devisData, error: null })
      if (call === 2) return makeChain({ data: { company_name: 'Artisans Pro', brand_data: brand }, error: null })
      return makeChain({ data: { email: 'c@test.fr' }, error: null })
    })

    const r = res()
    await handler(req('GET', {}, { token: 'tok' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.artisan.color).toBe('#abcdef')
    expect(r.body.artisan.logo).toBe('https://cdn.test/logo.png')
    expect(r.body.artisan.brand.siret).toBe('12345678901234')
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

  it('devis introuvable → 404', async () => {
    supabaseMock.from = vi.fn(() => makeChain({ data: null, error: null }))
    const r = res()
    await handler(req('POST', { action: 'request_otp', token: 'bad-tok', email: 'x@y.fr' }), r)
    expect(r.statusCode).toBe(404)
  })

  it('devis clôturé → 400', async () => {
    supabaseMock.from = vi.fn(() => makeChain({ data: { id: 'd1', statut: 'accepte', client_id: 'c1' }, error: null }))
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

  it('client sans email → 400', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', statut: 'envoye', client_id: 'c1' }, error: null })
      return makeChain({ data: { email: null }, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'request_otp', token: 'tok', email: 'x@y.fr' }), r)
    expect(r.statusCode).toBe(400)
  })

  it('trop de tentatives → 429', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', statut: 'envoye', client_id: 'c1' }, error: null })
      if (call === 2) return makeChain({ data: { email: 'client@test.fr' }, error: null })
      return makeChain({ count: 3, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'request_otp', token: 'tok', email: 'client@test.fr' }), r)
    expect(r.statusCode).toBe(429)
  })

  it('erreur création session → 500', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', statut: 'envoye', client_id: 'c1', numero: 'DEV-001' }, error: null })
      if (call === 2) return makeChain({ data: { email: 'client@test.fr' }, error: null })
      if (call === 3) return makeChain({ count: 0, error: null })
      return makeChain({ data: null, error: { message: 'DB error' } })
    })
    const r = res()
    await handler(req('POST', { action: 'request_otp', token: 'tok', email: 'client@test.fr' }), r)
    expect(r.statusCode).toBe(500)
  })

  it('succès → 200 avec session_id', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', statut: 'envoye', client_id: 'c1', numero: 'DEV-001' }, error: null })
      if (call === 2) return makeChain({ data: { email: 'client@test.fr' }, error: null })
      if (call === 3) return makeChain({ count: 0, error: null })
      return makeChain({ data: { id: 'sess-new' }, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'request_otp', token: 'tok', email: 'client@test.fr' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.session_id).toBe('sess-new')
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
    const sess = { id: 's1', verified_at: null, expires_at: new Date(Date.now() + 60000).toISOString(), attempts: 0, otp_hash: 'correct-hash' }
    const events = []

    supabaseMock.from = vi.fn(() => {
      const c = makeChain({ data: sess, error: null })
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
    expect(events).toContain('401')
  })

  it('code incorrect → message indique les essais restants', async () => {
    const sess = { id: 's1', verified_at: null, expires_at: new Date(Date.now() + 60000).toISOString(), attempts: 1, otp_hash: 'wrong' }
    supabaseMock.from = vi.fn(() => makeChain({ data: sess, error: null }))
    const r = res()
    await handler(req('POST', { action: 'verify_otp', token: 'tok', session_id: 's1', code: '000000' }), r)
    expect(r.statusCode).toBe(401)
    expect(r.body.error).toMatch(/1 essai/i)
  })

  it('session déjà vérifiée → 200 immédiat sans re-vérifier le code', async () => {
    const sess = { id: 's1', verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString(), attempts: 0 }
    supabaseMock.from = vi.fn(() => makeChain({ data: sess, error: null }))
    const r = res()
    await handler(req('POST', { action: 'verify_otp', token: 'tok', session_id: 's1', code: '000000' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.ok).toBe(true)
  })

  it('code correct → 200', async () => {
    const code = '654321'
    const sess = { id: 's1', verified_at: null, expires_at: new Date(Date.now() + 60000).toISOString(), attempts: 0, otp_hash: hashCode(code) }
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: sess, error: null })
      return makeChain({ data: { id: 'd1' }, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'verify_otp', token: 'tok', session_id: 's1', code }), r)
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
      if (call === 2) return makeChain({ data: { email: null }, error: null })
      return makeChain({ data: null, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'send', devis_id: 'd1' }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/email/i)
  })

  it('succès → 200 avec publicUrl et token', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', numero: 'DEV-001', objet: 'Plomberie', montant_ht: 500, public_token: 'tok', client_id: 'c1', owner_id: 'artisan-1', statut: 'brouillon' }, error: null })
      if (call === 2) return makeChain({ data: { raison_sociale: '', nom: 'Martin', prenom: '', email: 'client@test.fr' }, error: null })
      if (call === 3) return makeChain({ data: { company_name: 'Plomberie Pro', brand_data: { color: '#00aaff' } }, error: null })
      return makeChain({ data: null, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'send', devis_id: 'd1' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.ok).toBe(true)
    expect(r.body.publicUrl).toContain('/d/tok')
    expect(r.body.token).toBe('tok')
  })

  it('logo base64 → attachment CID inclus dans sendMail', async () => {
    const b64Logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ=='
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', numero: 'DEV-001', objet: null, montant_ht: 100, public_token: 'tok', client_id: 'c1', owner_id: 'artisan-1', statut: 'brouillon' }, error: null })
      if (call === 2) return makeChain({ data: { email: 'c@test.fr', nom: '', prenom: '', raison_sociale: 'Corp' }, error: null })
      if (call === 3) return makeChain({ data: { company_name: '', brand_data: { color: '#333', logo: b64Logo } }, error: null })
      return makeChain({ data: null, error: null })
    })
    await handler(req('POST', { action: 'send', devis_id: 'd1' }), res())
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({ cid: 'company-logo', encoding: 'base64' }),
        ]),
      })
    )
  })

  it("logo http → pas d'attachment, URL présente dans le HTML", async () => {
    const httpLogo = 'https://cdn.example.com/logo.png'
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', numero: 'DEV-001', objet: null, montant_ht: 100, public_token: 'tok', client_id: 'c1', owner_id: 'artisan-1', statut: 'brouillon' }, error: null })
      if (call === 2) return makeChain({ data: { email: 'c@test.fr', nom: '', prenom: '', raison_sociale: 'Corp' }, error: null })
      if (call === 3) return makeChain({ data: { company_name: '', brand_data: { logo: httpLogo } }, error: null })
      return makeChain({ data: null, error: null })
    })
    await handler(req('POST', { action: 'send', devis_id: 'd1' }), res())
    const callArg = sendMailMock.mock.calls[0][0]
    expect(callArg.attachments).toBeUndefined()
    expect(callArg.html).toContain(httpLogo)
  })

  it('CC contient email artisan + email marque (dédupliqués)', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', numero: 'DEV-002', objet: null, montant_ht: 200, public_token: 'tok2', client_id: 'c2', owner_id: 'artisan-1', statut: 'brouillon' }, error: null })
      if (call === 2) return makeChain({ data: { email: 'client2@test.fr', nom: 'Doe', prenom: 'Jane', raison_sociale: '' }, error: null })
      if (call === 3) return makeChain({ data: { company_name: '', brand_data: { email: 'pro@artisan.fr' } }, error: null })
      return makeChain({ data: null, error: null })
    })
    await handler(req('POST', { action: 'send', devis_id: 'd1' }), res())
    const callArg = sendMailMock.mock.calls[0][0]
    expect(callArg.cc).toContain('artisan@test.fr')
    expect(callArg.cc).toContain('pro@artisan.fr')
  })

  it("fromName toujours 'Consulter votre devis' (jamais le nom de l'entreprise)", async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', numero: 'DEV-003', objet: null, montant_ht: 300, public_token: 'tok3', client_id: 'c3', owner_id: 'artisan-1', statut: 'brouillon' }, error: null })
      if (call === 2) return makeChain({ data: { email: 'c3@test.fr', nom: '', prenom: '', raison_sociale: '' }, error: null })
      if (call === 3) return makeChain({ data: { company_name: 'ID MAÎTRISE', brand_data: {} }, error: null })
      return makeChain({ data: null, error: null })
    })
    await handler(req('POST', { action: 'send', devis_id: 'd1' }), res())
    const callArg = sendMailMock.mock.calls[0][0]
    expect(callArg.from).toContain('Consulter votre devis')
    expect(callArg.from).not.toContain('ID MAÎTRISE')
  })

  it('email non configuré → 502', async () => {
    delete process.env.GMAIL_USER
    delete process.env.GMAIL_APP_PASSWORD
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', numero: 'DEV-001', objet: null, montant_ht: 100, public_token: 'tok', client_id: 'c1', owner_id: 'artisan-1', statut: 'brouillon' }, error: null })
      if (call === 2) return makeChain({ data: { email: 'c@test.fr', nom: '', prenom: '', raison_sociale: '' }, error: null })
      if (call === 3) return makeChain({ data: { company_name: '', brand_data: {} }, error: null })
      return makeChain({ data: null, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'send', devis_id: 'd1' }), r)
    expect(r.statusCode).toBe(502)
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
      if (call === 1) return makeChain({ data: { id: 's1', email_hash: 'x' }, error: null })
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

  it('accept succès → 200', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 's1', email_hash: 'x' }, error: null })
      if (call === 2) return makeChain({ data: { id: 'd1', numero: 'DEV-001', objet: 'Test', statut: 'envoye', owner_id: 'a1', client_id: 'c1', montant_ht: 1000, lignes: [] }, error: null })
      return makeChain({ data: null, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'accept', token: 'tok', session_id: 's1', client_name: 'Marie Curie' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.ok).toBe(true)
  })

  it('refuse succès → 200', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 's1', email_hash: 'x' }, error: null })
      if (call === 2) return makeChain({ data: { id: 'd1', numero: 'DEV-005', objet: null, statut: 'envoye', owner_id: 'a1', client_id: 'c1', montant_ht: 800, lignes: [] }, error: null })
      return makeChain({ data: null, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'refuse', token: 'tok', session_id: 's1', reason: 'Budget insuffisant' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.ok).toBe(true)
  })

  it('negotiate succès → 200 avec newTotal', async () => {
    const lignes = [
      { id: 'l1', type_ligne: 'ouvrage', quantite: 5, prix_unitaire: 100 },
      { id: 'l2', type_ligne: 'ouvrage', quantite: 3, prix_unitaire: 50 },
    ]
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 's1', email_hash: 'x' }, error: null })
      if (call === 2) return makeChain({ data: { id: 'd1', statut: 'envoye', owner_id: 'a1', client_id: 'c1', montant_ht: 650, lignes }, error: null })
      return makeChain({ count: 0, data: null, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'negotiate', token: 'tok', session_id: 's1', message: 'Je voudrais une réduction' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.ok).toBe(true)
    expect(typeof r.body.newTotal).toBe('number')
  })

  it('negotiate sans message, changes ni budget → 400', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 's1', email_hash: 'x' }, error: null })
      return makeChain({ data: { id: 'd1', statut: 'envoye', owner_id: 'a1', client_id: 'c1', montant_ht: 500, lignes: [] }, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'negotiate', token: 'tok', session_id: 's1' }), r)
    expect(r.statusCode).toBe(400)
  })

  it('negotiate avec line_changes remove → calcule newTotal sans la ligne supprimée', async () => {
    const lignes = [
      { id: 'l1', type_ligne: 'ouvrage', quantite: 10, prix_unitaire: 50 },
      { id: 'l2', type_ligne: 'ouvrage', quantite: 2, prix_unitaire: 200 },
    ]
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 's1', email_hash: 'x' }, error: null })
      if (call === 2) return makeChain({ data: { id: 'd1', statut: 'envoye', owner_id: 'a1', client_id: 'c1', montant_ht: 900, lignes }, error: null })
      return makeChain({ count: 1, data: null, error: null })
    })
    const r = res()
    await handler(req('POST', {
      action: 'negotiate', token: 'tok', session_id: 's1',
      message: 'Retirer l2',
      line_changes: [{ action: 'remove', ligne_id: 'l2' }],
    }), r)
    expect(r.statusCode).toBe(200)
    // newTotal = 10*50 = 500 (l2 supprimée)
    expect(r.body.newTotal).toBe(500)
  })
})

describe('POST artisan_respond', () => {
  it('token manquant → 400', async () => {
    const r = res()
    await handler(req('POST', { action: 'artisan_respond', response: 'accept_client_changes' }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/token/i)
  })

  it('devis introuvable → 404', async () => {
    supabaseMock.from = vi.fn(() => makeChain({ data: null, error: null }))
    const r = res()
    await handler(req('POST', { action: 'artisan_respond', token: 'tok', response: 'accept_client_changes', negotiation_id: 'n1' }), r)
    expect(r.statusCode).toBe(404)
  })

  it("owner_id ne correspond pas à l'artisan authentifié → 403", async () => {
    supabaseMock.from = vi.fn(() => makeChain({ data: { id: 'd1', owner_id: 'autre-artisan', numero: 'DEV-001', statut: 'en_negociation', client_id: 'c1', lignes: [] }, error: null }))
    const r = res()
    await handler(req('POST', { action: 'artisan_respond', token: 'tok', response: 'accept_client_changes', negotiation_id: 'n1' }), r)
    expect(r.statusCode).toBe(403)
  })

  it('accept_client_changes → 200 avec newHt', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', numero: 'DEV-010', objet: 'Peinture', statut: 'en_negociation', owner_id: 'artisan-1', client_id: 'c1', lignes: [] }, error: null })
      if (call === 2) return makeChain({ data: { id: 'n1', line_changes: [], devis_id: 'd1' }, error: null })
      if (call === 3) return makeChain({ data: [], error: null })  // new lignes
      if (call === 4) return makeChain({ data: null, error: null }) // update devis
      if (call === 5) return makeChain({ data: null, error: null }) // update negotiation
      if (call === 6) return makeChain({ data: null, error: null }) // audit_log
      return makeChain({ data: { email: null }, error: null })      // client (no email)
    })
    const r = res()
    await handler(req('POST', { action: 'artisan_respond', token: 'tok', response: 'accept_client_changes', negotiation_id: 'n1' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.ok).toBe(true)
    expect(typeof r.body.newHt).toBe('number')
  })

  it('accept_client_changes envoie email client si email disponible', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', numero: 'DEV-011', objet: null, statut: 'en_negociation', owner_id: 'artisan-1', client_id: 'c1', lignes: [] }, error: null })
      if (call === 2) return makeChain({ data: { id: 'n1', line_changes: [], devis_id: 'd1' }, error: null })
      if (call === 3) return makeChain({ data: [], error: null })
      if (call === 4) return makeChain({ data: null, error: null })
      if (call === 5) return makeChain({ data: null, error: null })
      if (call === 6) return makeChain({ data: null, error: null })
      return makeChain({ data: { email: 'client@test.fr', nom: 'Doe', prenom: 'Jane', raison_sociale: '' }, error: null })
    })
    await handler(req('POST', { action: 'artisan_respond', token: 'tok', response: 'accept_client_changes', negotiation_id: 'n1' }), res())
    // sendMail appelé pour la confirmation client (fire-and-forget via .catch)
    // On attend la micro-task pour que la promesse se résolve
    await new Promise(r => setTimeout(r, 10))
    expect(sendMailMock).toHaveBeenCalled()
  })

  it('refuse_client_changes → 200', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', numero: 'DEV-012', objet: null, statut: 'en_negociation', owner_id: 'artisan-1', client_id: 'c1', lignes: [] }, error: null })
      return makeChain({ data: null, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'artisan_respond', token: 'tok', response: 'refuse_client_changes', negotiation_id: 'n1' }), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.ok).toBe(true)
  })

  it('response invalide → 400', async () => {
    let call = 0
    supabaseMock.from = vi.fn(() => {
      call++
      if (call === 1) return makeChain({ data: { id: 'd1', owner_id: 'artisan-1', statut: 'en_negociation', client_id: 'c1', lignes: [] }, error: null })
      return makeChain({ data: null, error: null })
    })
    const r = res()
    await handler(req('POST', { action: 'artisan_respond', token: 'tok', response: 'unknown_response', negotiation_id: 'n1' }), r)
    expect(r.statusCode).toBe(400)
  })
})

describe('parsing brand_data (JSONB)', () => {
  const parse = r => {
    if (!r) return {}
    if (typeof r === 'string') { try { return JSON.parse(r) } catch { return {} } }
    return r
  }

  it('brand_data objet JS (JSONB natif) → parsé correctement', () => {
    const brandData = { companyName: 'Test SARL', color: '#123456', logo: 'data:image/png;base64,abc' }
    const result = parse(brandData)
    expect(result.companyName).toBe('Test SARL')
    expect(result.color).toBe('#123456')
  })

  it('brand_data null → retourne {}', () => {
    expect(parse(null)).toEqual({})
  })

  it('brand_data undefined → retourne {}', () => {
    expect(parse(undefined)).toEqual({})
  })

  it('brand_data string JSON (anciens enregistrements) → parsé', () => {
    const result = parse('{"companyName":"Old Format","color":"#aabbcc"}')
    expect(result.companyName).toBe('Old Format')
    expect(result.color).toBe('#aabbcc')
  })

  it('brand_data string invalide → retourne {}', () => {
    expect(parse('pas-du-json')).toEqual({})
  })

  it('brand_data objet vide {} → retourne {}', () => {
    expect(parse({})).toEqual({})
  })
})
