// Endpoints RGPD en libre-service — routage par méthode HTTP :
//   GET  /api/account  → export portabilité (art. 20)
//   POST /api/account  → suppression de compte (art. 17)

import { createClient } from '@supabase/supabase-js'
import { cors } from "./_cors.js"

export default async function handler(req, res) {
  cors(req, res, { methods: "GET, POST, OPTIONS" })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey)
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurée' })

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

  // ── GET : export portabilité ─────────────────────────────────────────
  if (req.method === 'GET') {
    const owner_id = user.id

    const [
      profileR,
      clientsR,
      devisR,
      lignesDevisR,
      invoicesR,
      lignesInvoicesR,
      iaConvR,
      iaErrR,
      iaNegR,
      activityR,
    ] = await Promise.all([
      admin.from('profiles').select('*').eq('id', owner_id).maybeSingle(),
      admin.from('clients').select('*').eq('owner_id', owner_id),
      admin.from('devis').select('*').eq('owner_id', owner_id),
      admin.from('lignes_devis').select('*').eq('owner_id', owner_id),
      admin.from('invoices').select('*').eq('owner_id', owner_id),
      admin.from('lignes_invoices').select('*').eq('owner_id', owner_id),
      admin.from('ia_conversations').select('*').eq('owner_id', owner_id),
      admin.from('ia_error_logs').select('*').eq('owner_id', owner_id),
      admin.from('ia_negative_logs').select('*').eq('owner_id', owner_id),
      admin.from('activity_log').select('*').eq('owner_id', owner_id).order('created_at', { ascending: false }).limit(5000),
    ])

    let pdfFiles = []
    try {
      const { data: files } = await admin.storage.from('devis-pdfs').list(owner_id, { limit: 1000 })
      pdfFiles = (files || []).map(f => ({ name: f.name, size: f.metadata?.size, updated_at: f.updated_at }))
    } catch (e) {
      console.warn('[account/export] pdf list:', e?.message)
    }

    const archive = {
      rgpd: {
        regulation:       "Règlement (UE) 2016/679 (RGPD), articles 15 (accès) et 20 (portabilité)",
        generated_at:     new Date().toISOString(),
        generated_for:    { id: user.id, email: user.email, created_at: user.created_at },
        retention_notice: "Les factures émises sont conservées 10 ans côté Zenbat (LPF art. L102 B) même après suppression de votre compte. Cette archive constitue votre copie personnelle.",
        help:             "Pour toute question : Zenbat76@gmail.com",
      },
      profile:          profileR.data || null,
      clients:          clientsR.data || [],
      devis:            devisR.data || [],
      lignes_devis:     lignesDevisR.data || [],
      invoices:         invoicesR.data || [],
      lignes_invoices:  lignesInvoicesR.data || [],
      ia_conversations: iaConvR.data || [],
      ia_error_logs:    iaErrR.data || [],
      ia_negative_logs: iaNegR.data || [],
      activity_log:     activityR.data || [],
      pdf_files:        pdfFiles,
    }

    const filename = `zenbat-export-${owner_id}-${new Date().toISOString().slice(0,10)}.json`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(JSON.stringify(archive, null, 2))
  }

  // ── POST : suppression de compte ─────────────────────────────────────
  try {
    const { confirmEmail } = req.body || {}
    if (!confirmEmail || typeof confirmEmail !== 'string')
      return res.status(400).json({ error: "Confirmation par email obligatoire" })
    if (confirmEmail.trim().toLowerCase() !== (user.email || '').toLowerCase())
      return res.status(400).json({ error: "L'email de confirmation ne correspond pas à votre compte" })

    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail && (user.email || '').toLowerCase() === adminEmail.toLowerCase())
      return res.status(400).json({
        error: "Le compte administrateur ne peut pas être supprimé en libre-service. Contactez l'équipe Zenbat.",
      })

    const purgeTables = ['ia_conversations', 'ia_error_logs', 'ia_negative_logs', 'activity_log']
    for (const t of purgeTables) {
      try {
        await admin.from(t).delete().eq('owner_id', user.id)
      } catch (e) {
        console.warn(`[account/delete] purge ${t}:`, e?.message)
      }
    }

    try {
      const { data: files } = await admin.storage.from('devis-pdfs').list(user.id, { limit: 1000 })
      if (files?.length) {
        const paths = files.map(f => `${user.id}/${f.name}`)
        await admin.storage.from('devis-pdfs').remove(paths)
      }
    } catch (e) {
      console.warn('[account/delete] storage cleanup:', e?.message)
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) {
      console.error('[account/delete] deleteUser failed:', delErr)
      return res.status(500).json({
        error: delErr.message || 'Échec suppression compte',
        code:  delErr.code || delErr.status || null,
      })
    }

    return res.status(200).json({ ok: true, deleted_at: new Date().toISOString() })
  } catch (err) {
    console.error('[account/delete] unhandled:', err)
    return res.status(500).json({ error: err?.message || String(err) || 'Erreur interne inconnue' })
  }
}
