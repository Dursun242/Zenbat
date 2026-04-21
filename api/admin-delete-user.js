import { createClient } from '@supabase/supabase-js'

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean)

function cors(req, res) {
  const origin = req.headers.origin || ''
  const allowed = process.env.VERCEL_ENV !== 'production'
    ? (origin || '*')
    : ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || '')
  if (allowed) res.setHeader('Access-Control-Allow-Origin', allowed)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminEmail  = process.env.ADMIN_EMAIL

  if (!supabaseUrl || !serviceKey)
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurée' })

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Vérification identité admin
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })
  if (!adminEmail || user.email !== adminEmail)
    return res.status(403).json({ error: "Accès réservé à l'administrateur" })

  // Validation payload
  const { userId, confirmEmail } = req.body || {}
  if (!userId || typeof userId !== 'string')
    return res.status(400).json({ error: 'userId manquant ou invalide' })
  if (userId === user.id)
    return res.status(400).json({ error: 'Un administrateur ne peut pas supprimer son propre compte' })

  // Récupère la cible pour double-vérification par email
  const { data: targetData, error: targetErr } = await admin.auth.admin.getUserById(userId)
  if (targetErr || !targetData?.user)
    return res.status(404).json({ error: 'Utilisateur introuvable' })
  const target = targetData.user

  if (confirmEmail && target.email && confirmEmail.trim().toLowerCase() !== target.email.toLowerCase())
    return res.status(400).json({ error: "L'email de confirmation ne correspond pas" })

  // Nettoyage des PDF dans le bucket (best-effort, non bloquant)
  try {
    const { data: files } = await admin.storage.from('devis-pdfs').list(userId, { limit: 1000 })
    if (files?.length) {
      const paths = files.map(f => `${userId}/${f.name}`)
      await admin.storage.from('devis-pdfs').remove(paths)
    }
  } catch (e) {
    console.warn('[admin-delete-user] storage cleanup:', e?.message)
  }

  // Suppression du compte — cascade sur profiles → clients, devis, lignes_devis
  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) return res.status(500).json({ error: delErr.message })

  return res.status(200).json({
    ok: true,
    deleted: { id: userId, email: target.email },
  })
}
