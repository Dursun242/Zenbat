import { createClient } from '@supabase/supabase-js'
import { cors } from './_cors.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req, res) {
  cors(req, res, { methods: 'POST, OPTIONS', auth: false })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email } = req.body ?? {}
  if (!email || !EMAIL_RE.test(email))
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

  return res.status(200).json({ ok: true })
}
