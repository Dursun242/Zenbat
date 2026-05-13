import { createClient } from '@supabase/supabase-js'
import { cors } from './_cors.js'
import { rateLimit, sendRateLimited } from './_rateLimit.js'

// RFC 5322 simplifié : local@domain.tld, min 2 chars TLD, longueur max 254
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
const EMAIL_MAX_LENGTH = 254

export default async function handler(req, res) {
  cors(req, res, { methods: 'POST, OPTIONS', auth: false })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const rl = rateLimit(req, { windowMs: 60 * 60_000, max: 5, prefix: 'newsletter' })
  if (!rl.ok) return sendRateLimited(res, rl.retryAfterSec)

  const { email } = req.body ?? {}
  const emailStr = typeof email === 'string' ? email.trim() : ''
  if (!emailStr || emailStr.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(emailStr))
    return res.status(400).json({ error: 'Email invalide' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey)
    return res.status(500).json({ error: 'Configuration serveur manquante' })

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email: email.toLowerCase().trim() })

  if (error) {
    if (error.code === '23505') return res.status(200).json({ ok: true, already: true })
    return res.status(500).json({ error: 'Erreur serveur' })
  }

  // Notification email via Brevo (optionnel — si BREVO_API_KEY est défini)
  // Fire-and-forget volontaire (on ne veut pas bloquer la réponse au client
  // si Brevo est lent), mais avec un timeout 5s pour ne pas laisser des
  // requêtes en suspens occuper la fonction Vercel jusqu'à la limite plateforme.
  const brevoKey = process.env.BREVO_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL
  if (brevoKey && adminEmail) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 5000)
    fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender:      { name: 'Zenbat', email: adminEmail },
        to:          [{ email: adminEmail }],
        subject:     '📩 Nouvel abonné newsletter Zenbat',
        htmlContent: `<p>Nouveau compte inscrit à la newsletter :</p><p><strong>${email.toLowerCase().trim()}</strong></p><p>Source : landing page</p>`,
      }),
      signal: ac.signal,
    })
      .catch(() => {}) // silencieux si Brevo échoue (timeout inclus)
      .finally(() => clearTimeout(timer))
  }

  return res.status(200).json({ ok: true })
}
