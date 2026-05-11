// Rate limiter in-memory par IP.
//
// Limite : par-instance uniquement. Vercel garde les fonctions « warm »
// pour quelques minutes, donc dans la pratique le même attaquant tombera
// la plupart du temps sur la même instance et sera bloqué. Pour une
// protection distribuée (Vercel KV, Supabase), prévoir une bascule.

const buckets = new Map()

function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

export function rateLimit(req, { windowMs, max, prefix }) {
  // Désactivé en tests pour ne pas brouiller les suites qui appellent
  // le même handler N fois.
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return { ok: true, retryAfterSec: 0 }
  }

  const key = `${prefix}:${clientIp(req)}`
  const now = Date.now()

  if (Math.random() < 0.01) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k)
  }

  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSec: 0 }
  }
  if (b.count >= max) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) }
  }
  b.count++
  return { ok: true, retryAfterSec: 0 }
}

export function sendRateLimited(res, retryAfterSec) {
  res.setHeader('Retry-After', String(retryAfterSec))
  return res.status(429).json({
    error: `Trop de requêtes. Réessayez dans ${Math.ceil(retryAfterSec / 60)} min.`,
  })
}
