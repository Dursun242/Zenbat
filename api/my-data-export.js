// Export RGPD en libre-service (RGPD art. 20 — droit à la portabilité).
// Renvoie un JSON unique contenant toutes les données associées au compte
// authentifié. L'utilisateur déclenche depuis Mon profil → Vos données.
//
// Note : on ne joint PAS les PDF (trop lourd en JSON, et déjà téléchargeables
// individuellement depuis chaque devis/facture). Si besoin, ajouter une
// version ZIP plus tard via JSZip côté client.

import { createClient } from '@supabase/supabase-js'
import { cors } from "./_cors.js"

export default async function handler(req, res) {
  cors(req, res, { methods: "GET, OPTIONS" })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

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

  const owner_id = user.id

  // Récupère l'ensemble des données personnelles + métier de l'utilisateur.
  // Les requêtes sont indépendantes → Promise.all en parallèle.
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

  // Liste des PDFs stockés (pas le contenu — juste l'inventaire)
  let pdfFiles = []
  try {
    const { data: files } = await admin.storage.from('devis-pdfs').list(owner_id, { limit: 1000 })
    pdfFiles = (files || []).map(f => ({ name: f.name, size: f.metadata?.size, updated_at: f.updated_at }))
  } catch (e) {
    console.warn('[my-data-export] pdf list:', e?.message)
  }

  const archive = {
    rgpd: {
      regulation:        "Règlement (UE) 2016/679 (RGPD), articles 15 (accès) et 20 (portabilité)",
      generated_at:      new Date().toISOString(),
      generated_for:     { id: user.id, email: user.email, created_at: user.created_at },
      retention_notice:  "Les factures émises sont conservées 10 ans côté Zenbat (LPF art. L102 B) même après suppression de votre compte. Cette archive constitue votre copie personnelle.",
      help:              "Pour toute question : Zenbat76@gmail.com",
    },
    profile:           profileR.data || null,
    clients:           clientsR.data || [],
    devis:             devisR.data || [],
    lignes_devis:      lignesDevisR.data || [],
    invoices:          invoicesR.data || [],
    lignes_invoices:   lignesInvoicesR.data || [],
    ia_conversations:  iaConvR.data || [],
    ia_error_logs:     iaErrR.data || [],
    ia_negative_logs:  iaNegR.data || [],
    activity_log:      activityR.data || [],
    pdf_files:         pdfFiles,
  }

  const filename = `zenbat-export-${owner_id}-${new Date().toISOString().slice(0,10)}.json`
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  return res.status(200).send(JSON.stringify(archive, null, 2))
}
