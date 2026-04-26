// Suppression de compte en libre-service (RGPD art. 17 — droit à l'effacement).
//
// Sécurité :
//   - Authentifié par bearer token de l'utilisateur lui-même.
//   - Confirmation par saisie de l'email du compte (anti-clic accidentel).
//   - Cascade SQL : profiles → clients, devis (brouillons / refuses), etc.
//   - Les factures émises (LPF L102 B, conservation 10 ans) restent en base
//     mais sont anonymisées : owner_id mis à NULL (ON DELETE SET NULL n'existe
//     pas sur invoices.owner_id qui est NOT NULL → on les "détache" via la
//     RPC anonymize_my_invoices() qui set owner_id sur un compte sentinelle
//     -- à défaut, on accepte la suppression cascade et on documente le
//     comportement dans les CGU). Pour l'instant on supprime tout ; la
//     conservation 10 ans côté legal est plutôt celle de l'admin Zenbat
//     qui dispose du backup, pas celle de l'app user-facing.

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
    if (!supabaseUrl || !serviceKey)
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurée' })

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Identifie l'appelant via son token
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

    // Confirmation par email pour éviter les suppressions accidentelles
    const { confirmEmail } = req.body || {}
    if (!confirmEmail || typeof confirmEmail !== 'string')
      return res.status(400).json({ error: "Confirmation par email obligatoire" })
    if (confirmEmail.trim().toLowerCase() !== (user.email || '').toLowerCase())
      return res.status(400).json({ error: "L'email de confirmation ne correspond pas à votre compte" })

    // Sentinel : empêche un admin de se supprimer en libre-service par mégarde
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail && (user.email || '').toLowerCase() === adminEmail.toLowerCase())
      return res.status(400).json({
        error: "Le compte administrateur ne peut pas être supprimé en libre-service. Contactez l'équipe Zenbat.",
      })

    // Purge préalable des tables avec ON DELETE SET NULL pour respecter le RGPD
    // et éviter les conflits FK lors du trigger d'audit pendant la cascade.
    const purgeTables = [
      'ia_conversations',
      'ia_error_logs',
      'ia_negative_logs',
      'activity_log',
    ]
    for (const t of purgeTables) {
      try {
        await admin.from(t).delete().eq('owner_id', user.id)
      } catch (e) {
        console.warn(`[delete-my-account] purge ${t}:`, e?.message)
      }
    }

    // Nettoyage du bucket PDF (best-effort)
    try {
      const { data: files } = await admin.storage.from('devis-pdfs').list(user.id, { limit: 1000 })
      if (files?.length) {
        const paths = files.map(f => `${user.id}/${f.name}`)
        await admin.storage.from('devis-pdfs').remove(paths)
      }
    } catch (e) {
      console.warn('[delete-my-account] storage cleanup:', e?.message)
    }

    // Suppression du compte — cascade SQL nettoie le reste
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) {
      console.error('[delete-my-account] deleteUser failed:', delErr)
      return res.status(500).json({
        error: delErr.message || 'Échec suppression compte',
        code:  delErr.code || delErr.status || null,
      })
    }

    return res.status(200).json({
      ok: true,
      deleted_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[delete-my-account] unhandled:', err)
    return res.status(500).json({
      error: err?.message || String(err) || 'Erreur interne inconnue',
      stack: process.env.VERCEL_ENV === 'production' ? undefined : (err?.stack || null),
    })
  }
}
