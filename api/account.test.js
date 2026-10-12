// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────
let adminMock
const USER = { id: 'user-1', email: 'Artisan@Test.fr', created_at: '2026-01-01T00:00:00Z' }
let currentUser

vi.mock('./_cors.js', () => ({ cors: () => {} }))
vi.mock('./_withAuth.js', () => ({
  authenticate: vi.fn(async () => ({ user: currentUser, admin: adminMock })),
  notifyTelegram: vi.fn(async () => {}),
}))
vi.mock('./_email.js', async (importOriginal) => ({
  ...(await importOriginal()),
  sendEmail: vi.fn(async () => ({ provider: 'gmail' })),
}))
// _quota.js reste le vrai : on vérifie l'appel RPC daily_quota_consume.

import handler from './account.js'
import { authenticate, notifyTelegram } from './_withAuth.js'
import { sendEmail } from './_email.js'

// ── Faux client service_role : enregistre chaque requête ───────────────────
function makeAdmin(resolver = () => ({ data: null, error: null })) {
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
    return chain
  })
  const bucket = {
    list:     vi.fn(async () => ({ data: [], error: null })),
    remove:   vi.fn(async () => ({ data: null, error: null })),
    download: vi.fn(async () => ({ data: null, error: { message: 'not found' } })),
  }
  return {
    calls, from, bucket,
    storage: { from: vi.fn(() => bucket) },
    auth: { admin: { deleteUser: vi.fn(async () => ({ error: null })) } },
    rpc: vi.fn(async () => ({ data: 1, error: null })),
  }
}
const has = (ops, ...op) => ops.some(o => o.length === op.length && o.every((v, i) => v === op[i]))

function req(method, body) {
  return { method, body, headers: { authorization: 'Bearer t' } }
}
function makeRes() {
  const r = { statusCode: 0, body: null, raw: null, headers: {} }
  r.status    = c => { r.statusCode = c; return r }
  r.json      = b => { r.body = b; return r }
  r.send      = s => { r.raw = s; return r }
  r.end       = () => r
  r.setHeader = (k, v) => { r.headers[k] = v }
  return r
}

let snapAdminEmail
beforeEach(() => {
  snapAdminEmail = process.env.ADMIN_EMAIL
  process.env.ADMIN_EMAIL = 'admin@zenbat.fr'
  currentUser = { ...USER }
  adminMock = makeAdmin()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  if (snapAdminEmail === undefined) delete process.env.ADMIN_EMAIL
  else process.env.ADMIN_EMAIL = snapAdminEmail
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

// ── Routage ────────────────────────────────────────────────────────────────
describe('routage', () => {
  it('OPTIONS → 204, PUT → 405 (sans authentification)', async () => {
    const r1 = makeRes(); await handler(req('OPTIONS'), r1)
    const r2 = makeRes(); await handler(req('PUT'), r2)
    expect(r1.statusCode).toBe(204)
    expect(r2.statusCode).toBe(405)
    expect(authenticate).not.toHaveBeenCalled()
  })

  it('non authentifié → la réponse d’authenticate est conservée, aucune requête', async () => {
    authenticate.mockImplementationOnce(async (_req, res) => { res.status(401).json({ error: 'Non authentifié' }); return null })
    const r = makeRes()
    await handler(req('GET'), r)
    expect(r.statusCode).toBe(401)
    expect(adminMock.from).not.toHaveBeenCalled()
  })

  it('whoami : admin reconnu sans tenir compte de la casse', async () => {
    currentUser = { ...USER, email: ' ADMIN@zenbat.fr ' }
    const r = makeRes()
    await handler(req('POST', { action: 'whoami' }), r)
    expect(r.body).toEqual({ is_admin: true })
  })
})

// ── GET : export RGPD ──────────────────────────────────────────────────────
describe('GET — export portabilité', () => {
  it('ne lit que les données du demandeur (filtre owner_id / id sur chaque table)', async () => {
    adminMock = makeAdmin((table) => {
      if (table === 'profiles') return { data: { id: 'user-1', plan: 'pro' }, error: null }
      if (table === 'invoices') return { data: [{ id: 'inv-1', owner_id: 'user-1' }], error: null }
      return { data: [], error: null }
    })
    adminMock.bucket.list.mockResolvedValueOnce({ data: [{ name: 'd1.pdf', metadata: { size: 42 }, updated_at: 'x' }] })
    const r = makeRes()
    await handler(req('GET'), r)

    expect(r.statusCode).toBe(200)
    const tables = adminMock.calls.map(c => c.table).sort()
    expect(tables).toEqual([
      'activity_log', 'clients', 'devis', 'ia_conversations', 'ia_error_logs',
      'ia_negative_logs', 'invoices', 'lignes_devis', 'lignes_invoices', 'profiles',
    ])
    for (const c of adminMock.calls) {
      const col = c.table === 'profiles' ? 'id' : 'owner_id'
      expect(has(c.ops, 'eq', col, 'user-1'), `${c.table} filtré sur ${col}`).toBe(true)
      // aucun autre filtre eq ne vise un autre utilisateur
      expect(c.ops.filter(o => o[0] === 'eq').every(o => o[2] === 'user-1')).toBe(true)
    }
    // Storage : seulement le dossier du demandeur
    expect(adminMock.bucket.list).toHaveBeenCalledWith('user-1', { limit: 1000 })

    const archive = JSON.parse(r.raw)
    expect(archive.profile).toEqual({ id: 'user-1', plan: 'pro' })
    expect(archive.invoices).toEqual([{ id: 'inv-1', owner_id: 'user-1' }])
    expect(archive.pdf_files).toEqual([{ name: 'd1.pdf', size: 42, updated_at: 'x' }])
    expect(archive.rgpd.generated_for).toEqual({ id: 'user-1', email: USER.email, created_at: USER.created_at })
    expect(r.headers['Content-Disposition']).toMatch(/attachment; filename="zenbat-export-user-1-\d{4}-\d{2}-\d{2}\.json"/)
  })

  it('table absente (42P01) ou en erreur → export partiel plutôt que 500', async () => {
    adminMock = makeAdmin((table) => {
      if (table === 'ia_negative_logs') return { data: null, error: { code: '42P01', message: 'relation does not exist' } }
      if (table === 'clients') return { data: null, error: { code: 'XX000', message: 'boom' } }
      if (table === 'devis') throw new Error('réseau')
      return { data: [{ ok: true }], error: null }
    })
    adminMock.storage.from = vi.fn(() => { throw new Error('storage down') })
    const r = makeRes()
    await handler(req('GET'), r)
    expect(r.statusCode).toBe(200)
    const archive = JSON.parse(r.raw)
    expect(archive.ia_negative_logs).toEqual([])
    expect(archive.clients).toEqual([])
    expect(archive.devis).toEqual([])
    expect(archive.invoices).toEqual([{ ok: true }])
    expect(archive.pdf_files).toEqual([])
  })
})

// ── POST : suppression de compte ───────────────────────────────────────────
describe('POST — suppression de compte', () => {
  it('sans email de confirmation → 400', async () => {
    const r = makeRes()
    await handler(req('POST', {}), r)
    expect(r.statusCode).toBe(400)
    expect(adminMock.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it('email de confirmation incorrect → 400, rien n’est purgé', async () => {
    const r = makeRes()
    await handler(req('POST', { confirmEmail: 'autre@test.fr' }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/ne correspond pas/)
    expect(adminMock.from).not.toHaveBeenCalled()
    expect(adminMock.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it('compte administrateur → refusé, aucune suppression', async () => {
    currentUser = { ...USER, email: 'Admin@Zenbat.fr' }
    const r = makeRes()
    await handler(req('POST', { confirmEmail: 'admin@zenbat.fr' }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/administrateur/)
    expect(adminMock.from).not.toHaveBeenCalled()
    expect(adminMock.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it('email confirmé (casse/espaces ignorés) → purge des tables IA + journal, PDF supprimés, deleteUser appelé', async () => {
    adminMock = makeAdmin((table, ops) => table === 'profiles' ? { data: { plan: 'pro' }, error: null } : { error: null })
    adminMock.bucket.list.mockResolvedValueOnce({ data: [{ name: 'a.pdf' }, { name: 'b.pdf' }] })
    const r = makeRes()
    await handler(req('POST', { confirmEmail: '  artisan@test.FR ' }), r)

    expect(r.statusCode).toBe(200)
    expect(r.body.ok).toBe(true)
    const purged = adminMock.calls.filter(c => c.ops[0][0] === 'delete')
    expect(purged.map(c => c.table)).toEqual(['ia_conversations', 'ia_error_logs', 'ia_negative_logs', 'activity_log'])
    for (const c of purged) expect(has(c.ops, 'eq', 'owner_id', 'user-1')).toBe(true)
    expect(adminMock.bucket.remove).toHaveBeenCalledWith(['user-1/a.pdf', 'user-1/b.pdf'])
    expect(adminMock.auth.admin.deleteUser).toHaveBeenCalledWith('user-1')
    expect(notifyTelegram).toHaveBeenCalledWith('account_deleted', { email: USER.email, plan: 'pro', by: 'self' })
  })

  it('purge partiellement en échec → la suppression du compte continue', async () => {
    adminMock = makeAdmin((table) => { if (table === 'ia_error_logs') throw new Error('boom'); return { error: null } })
    const r = makeRes()
    await handler(req('POST', { confirmEmail: USER.email }), r)
    expect(r.statusCode).toBe(200)
    expect(adminMock.auth.admin.deleteUser).toHaveBeenCalledWith('user-1')
  })

  it('deleteUser en erreur → 500 avec le message, pas de notification', async () => {
    adminMock.auth.admin.deleteUser.mockResolvedValueOnce({ error: { message: 'FK violation', status: 500 } })
    const r = makeRes()
    await handler(req('POST', { confirmEmail: USER.email }), r)
    expect(r.statusCode).toBe(500)
    expect(r.body).toEqual({ error: 'FK violation', code: 500 })
    expect(notifyTelegram).not.toHaveBeenCalled()
  })
})

// ── POST send-comptable ────────────────────────────────────────────────────
describe('POST — envoi au comptable', () => {
  const INVOICES = [
    { id: 'inv-1', numero: 'FAC-2026-001', date_emission: '2026-09-02', client_id: 'c1', statut: 'envoyee', montant_ht: 100, montant_tva: 20, montant_ttc: 120, locked: true },
    { id: 'inv-2', numero: 'FAC-2026-002', date_emission: '2026-09-20', client_id: 'c1', statut: 'payee',   montant_ht: 50,  montant_tva: 10, montant_ttc: 60,  locked: true },
  ]
  function comptableAdmin({ profile = { comptable_email: 'compta@cabinet.fr', company_name: 'ACME' }, invoices = INVOICES } = {}) {
    return makeAdmin((table, ops) => {
      if (table === 'profiles' && ops[0][0] === 'select') return { data: profile, error: null }
      if (table === 'invoices') return { data: invoices, error: null }
      if (table === 'clients') return { data: [{ id: 'c1', raison_sociale: 'Client SA' }], error: null }
      if (table === 'lignes_invoices') return { data: [{ invoice_id: 'inv-1', type_ligne: 'ouvrage', designation: 'Pose', quantite: 1, prix_unitaire: 100, tva_rate: 20 }], error: null }
      return { data: null, error: null }
    })
  }
  const send = (body) => req('POST', { action: 'send-comptable', ...body })
  const invoicesQuery = () => adminMock.calls.find(c => c.table === 'invoices')

  it.each([
    ['vide', { email: '' }, { comptable_email: null }],
    ['sans domaine', { email: 'compta@' }, {}],
    ['avec espace', { email: 'com pta@cabinet.fr' }, {}],
    ['trop long', { email: `${'a'.repeat(250)}@x.fr` }, {}],
  ])('email du comptable invalide (%s) → 400, rien n’est envoyé', async (_l, body, profile) => {
    adminMock = comptableAdmin({ profile })
    const r = makeRes()
    await handler(send(body), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/Email du comptable invalide/)
    expect(sendEmail).not.toHaveBeenCalled()
    expect(adminMock.rpc).not.toHaveBeenCalled()
  })

  it('seules les factures émises (locked=true) du demandeur partent ; quota email consommé', async () => {
    adminMock = comptableAdmin()
    const r = makeRes()
    await handler(send({ period: 'all' }), r)

    expect(r.statusCode).toBe(200)
    const q = invoicesQuery()
    expect(has(q.ops, 'eq', 'owner_id', 'user-1')).toBe(true)
    expect(has(q.ops, 'eq', 'locked', true)).toBe(true)
    // Lignes : seulement celles des factures retenues, hors lignes supprimées
    const lq = adminMock.calls.find(c => c.table === 'lignes_invoices')
    expect(lq.ops.find(o => o[0] === 'in')).toEqual(['in', 'invoice_id', ['inv-1', 'inv-2']])
    expect(has(lq.ops, 'is', 'deleted_at', null)).toBe(true)

    expect(adminMock.rpc).toHaveBeenCalledWith('daily_quota_consume', { p_user: 'user-1', p_kind: 'email', p_limit: 60 })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const mail = sendEmail.mock.calls[0][0]
    expect(mail.to).toBe('compta@cabinet.fr')
    expect(mail.fromName).toBe('ACME')
    const csv = Buffer.from(mail.attachments[0].content, 'base64').toString('utf8')
    expect(csv).toContain('FAC-2026-001;2026-09-02')
    expect(csv).toContain('Client SA')
    expect(csv.split('\n')).toHaveLength(3) // en-tête + 2 factures
    expect(r.body).toMatchObject({ ok: true, count: 2, total_ht: 150, total_tva: 30, total_ttc: 180 })
  })

  it('période personnalisée → bornes date_emission appliquées', async () => {
    adminMock = comptableAdmin()
    const r = makeRes()
    await handler(send({ period: 'custom', from: '2026-09-01', to: '2026-09-30' }), r)
    expect(r.statusCode).toBe(200)
    const q = invoicesQuery()
    expect(has(q.ops, 'gte', 'date_emission', '2026-09-01')).toBe(true)
    expect(has(q.ops, 'lte', 'date_emission', '2026-09-30')).toBe(true)
  })

  it('nouvel email fourni → enregistré sur le profil du demandeur', async () => {
    adminMock = comptableAdmin()
    const r = makeRes()
    await handler(send({ period: 'all', email: ' nouveau@cabinet.fr ' }), r)
    expect(r.statusCode).toBe(200)
    const up = adminMock.calls.find(c => c.table === 'profiles' && c.ops[0][0] === 'update')
    expect(up.ops[0][1]).toEqual({ comptable_email: 'nouveau@cabinet.fr' })
    expect(has(up.ops, 'eq', 'id', 'user-1')).toBe(true)
    expect(sendEmail.mock.calls[0][0].to).toBe('nouveau@cabinet.fr')
  })

  it('aucune facture émise sur la période → 400, ni quota ni email', async () => {
    adminMock = comptableAdmin({ invoices: [] })
    const r = makeRes()
    await handler(send({ period: 'last_month' }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toMatch(/Aucune facture/)
    expect(adminMock.rpc).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('quota email atteint → 429, email non envoyé', async () => {
    adminMock = comptableAdmin()
    adminMock.rpc.mockResolvedValueOnce({ data: null, error: null })
    const r = makeRes()
    await handler(send({ period: 'all' }), r)
    expect(r.statusCode).toBe(429)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('échec d’envoi → 500 et unité de quota rendue', async () => {
    adminMock = comptableAdmin()
    sendEmail.mockRejectedValueOnce(new Error('SMTP down'))
    const r = makeRes()
    await handler(send({ period: 'all' }), r)
    expect(r.statusCode).toBe(500)
    await vi.waitFor(() => expect(adminMock.rpc).toHaveBeenCalledWith('daily_quota_refund', { p_user: 'user-1', p_kind: 'email' }))
  })

  it('PDF archivés joints, lus dans le dossier du demandeur uniquement', async () => {
    adminMock = comptableAdmin()
    adminMock.bucket.download.mockImplementation(async (path) => path === 'user-1/invoices/FAC-2026-001.pdf'
      ? { data: new Blob([Buffer.from('%PDF-1.7')]), error: null }
      : { data: null, error: { message: 'not found' } })
    const r = makeRes()
    await handler(send({ period: 'all' }), r)
    expect(r.statusCode).toBe(200)
    expect(adminMock.bucket.download.mock.calls.map(c => c[0])).toEqual([
      'user-1/invoices/FAC-2026-001.pdf', 'user-1/invoices/FAC-2026-002.pdf',
    ])
    const pdfs = sendEmail.mock.calls[0][0].attachments.filter(a => a.contentType === 'application/pdf')
    expect(pdfs).toEqual([{ filename: 'FAC-2026-001.pdf', content: Buffer.from('%PDF-1.7').toString('base64'), contentType: 'application/pdf' }])
    expect(r.body.pdfs).toBe(1)
  })
})
