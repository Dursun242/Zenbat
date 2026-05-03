import { createClient } from '@supabase/supabase-js'

function makeAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * Extracts and verifies the Bearer token from the request.
 * Returns { user, admin } on success, or sends the error response and returns null.
 * Pass { adminOnly: true } to restrict access to ADMIN_EMAIL.
 */
export async function authenticate(req, res, { adminOnly = false } = {}) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Non authentifié' }); return null }

  const admin = makeAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase non configuré' }); return null }

  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) { res.status(401).json({ error: 'Token invalide' }); return null }

  if (adminOnly) {
    const adminEmail = process.env.ADMIN_EMAIL
    const norm = s => String(s || '').trim().toLowerCase()
    if (!adminEmail || norm(user.email) !== norm(adminEmail)) {
      res.status(403).json({ error: "Accès réservé à l'administrateur" }); return null
    }
  }

  return { user, admin }
}

/** Fire-and-forget Telegram notification via the notify-telegram Edge Function. */
export async function notifyTelegram(kind, payload) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  try {
    await fetch(`${url}/functions/v1/notify-telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ kind, payload }),
    })
  } catch (err) {
    console.error('[notifyTelegram] failed:', err.message)
  }
}
