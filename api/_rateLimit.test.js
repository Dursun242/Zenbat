// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimit, sendRateLimited } from './_rateLimit.js'

// Le limiteur est désactivé sous Vitest (VITEST / NODE_ENV=test) : on retire
// ces variables le temps de chaque test pour exercer le vrai comportement.
let snap
let seq = 0
let prefix
beforeEach(() => {
  snap = { VITEST: process.env.VITEST, NODE_ENV: process.env.NODE_ENV }
  delete process.env.VITEST
  delete process.env.NODE_ENV
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T10:00:00Z'))
  // Les compteurs vivent au niveau du module : un préfixe par test les isole.
  prefix = `t${++seq}`
})
afterEach(() => {
  for (const [k, v] of Object.entries(snap)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const reqFrom = (ip, extra = {}) => ({ headers: { 'x-forwarded-for': ip }, ...extra })

describe('rateLimit', () => {
  it('laisse passer jusqu’à max puis refuse avec le délai restant', () => {
    const opts = { windowMs: 60_000, max: 3, prefix }
    expect([1, 2, 3].map(() => rateLimit(reqFrom('1.1.1.1'), opts).ok)).toEqual([true, true, true])
    vi.advanceTimersByTime(15_000)
    expect(rateLimit(reqFrom('1.1.1.1'), opts)).toEqual({ ok: false, retryAfterSec: 45 })
  })

  it('nouvelle fenêtre après windowMs → compteur remis à zéro', () => {
    const opts = { windowMs: 10_000, max: 1, prefix }
    expect(rateLimit(reqFrom('2.2.2.2'), opts).ok).toBe(true)
    expect(rateLimit(reqFrom('2.2.2.2'), opts).ok).toBe(false)
    vi.advanceTimersByTime(9_999)
    expect(rateLimit(reqFrom('2.2.2.2'), opts).ok).toBe(false)
    vi.advanceTimersByTime(1)
    expect(rateLimit(reqFrom('2.2.2.2'), opts).ok).toBe(true)
  })

  it('les refus ne prolongent pas la fenêtre', () => {
    const opts = { windowMs: 10_000, max: 1, prefix }
    rateLimit(reqFrom('3.3.3.3'), opts)
    for (let i = 0; i < 5; i++) { vi.advanceTimersByTime(1_000); rateLimit(reqFrom('3.3.3.3'), opts) }
    vi.advanceTimersByTime(5_000)
    expect(rateLimit(reqFrom('3.3.3.3'), opts).ok).toBe(true)
  })

  it('compteurs séparés par IP et par préfixe', () => {
    const opts = { windowMs: 60_000, max: 1, prefix }
    expect(rateLimit(reqFrom('4.4.4.4'), opts).ok).toBe(true)
    expect(rateLimit(reqFrom('4.4.4.4'), opts).ok).toBe(false)
    expect(rateLimit(reqFrom('5.5.5.5'), opts).ok).toBe(true)
    expect(rateLimit(reqFrom('4.4.4.4'), { ...opts, prefix: `${prefix}-autre` }).ok).toBe(true)
  })

  it('x-forwarded-for : seule la 1ʳᵉ adresse (client) compte', () => {
    const opts = { windowMs: 60_000, max: 1, prefix }
    expect(rateLimit(reqFrom('6.6.6.6, 10.0.0.1'), opts).ok).toBe(true)
    expect(rateLimit(reqFrom(' 6.6.6.6 , 10.0.0.2'), opts).ok).toBe(false)
  })

  it('sans x-forwarded-for → adresse de la socket, sinon « unknown »', () => {
    const opts = { windowMs: 60_000, max: 1, prefix }
    expect(rateLimit({ headers: {}, socket: { remoteAddress: '7.7.7.7' } }, opts).ok).toBe(true)
    expect(rateLimit({ headers: {}, socket: { remoteAddress: '7.7.7.7' } }, opts).ok).toBe(false)
    expect(rateLimit({}, opts).ok).toBe(true)
    expect(rateLimit({ headers: {} }, opts).ok).toBe(false) // même seau « unknown »
  })

  it('nettoyage occasionnel des seaux expirés sans perturber les seaux actifs', () => {
    const opts = { windowMs: 1_000, max: 1, prefix }
    rateLimit(reqFrom('8.8.8.8'), opts)
    rateLimit(reqFrom('9.9.9.9'), { ...opts, windowMs: 60_000 })
    vi.advanceTimersByTime(2_000)
    vi.spyOn(Math, 'random').mockReturnValue(0) // force le passage de nettoyage
    expect(rateLimit(reqFrom('8.8.8.8'), opts).ok).toBe(true)
    expect(rateLimit(reqFrom('9.9.9.9'), { ...opts, windowMs: 60_000 }).ok).toBe(false)
  })

  it('désactivé sous Vitest / NODE_ENV=test', () => {
    const opts = { windowMs: 60_000, max: 1, prefix }
    process.env.NODE_ENV = 'test'
    for (let i = 0; i < 5; i++) expect(rateLimit(reqFrom('1.2.3.4'), opts).ok).toBe(true)
    delete process.env.NODE_ENV
    process.env.VITEST = 'true'
    expect(rateLimit(reqFrom('1.2.3.4'), opts).ok).toBe(true)
  })
})

describe('sendRateLimited', () => {
  it('429 + en-tête Retry-After + délai en minutes arrondi au-dessus', () => {
    const res = { headers: {}, statusCode: 0, body: null }
    res.setHeader = (k, v) => { res.headers[k] = v }
    res.status = c => { res.statusCode = c; return res }
    res.json = b => { res.body = b; return res }
    sendRateLimited(res, 61)
    expect(res.statusCode).toBe(429)
    expect(res.headers['Retry-After']).toBe('61')
    expect(res.body.error).toMatch(/2 min/)
  })
})
