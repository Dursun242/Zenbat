import { createClient } from '@supabase/supabase-js'
import { cors } from "./_cors.js"

export default async function handler(req, res) {
  cors(req, res, { methods: "POST, OPTIONS" })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Non authentifié' })

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
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
    const norm = (s) => String(s || '').trim().toLowerCase()
    if (!adminEmail || norm(user.email) !== norm(adminEmail))
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

    // Purge ciblée des tables qui référencent auth.users sans ON DELETE CASCADE
    // (ia_* / activity_log ont on delete set null, mais on veut effacer
    // aussi leur contenu pour une vraie suppression RGPD — SET NULL laisserait
    // les messages de l'utilisateur visibles côté admin après suppression).
    const purgeTables = [
      'ia_conversations',
      'ia_error_logs',
      'ia_negative_logs',
      'activity_log',
    ]
    for (const t of purgeTables) {
      try {
        await admin.from(t).delete().eq('owner_id', userId)
      } catch (e) {
        console.warn(`[admin-delete-user] purge ${t}:`, e?.message)
      }
    }

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
    if (delErr) {
      console.error('[admin-delete-user] deleteUser failed:', delErr)
      return res.status(500).json({
        error: delErr.message || 'Échec suppression compte auth',
        code:  delErr.code || delErr.status || null,
      })
    }

    return res.status(200).json({
      ok: true,
      deleted: { id: userId, email: target.email },
    })
  } catch (err) {
    // Filet de sécurité : toute exception non gérée remonte un message
    // exploitable côté client au lieu d'un 500 muet.
    console.error('[admin-delete-user] unhandled:', err)
    return res.status(500).json({
      error: err?.message || String(err) || 'Erreur interne inconnue',
      stack: process.env.VERCEL_ENV === 'production' ? undefined : (err?.stack || null),
    })
  }
}
