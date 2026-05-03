// Détail complet d'un utilisateur pour l'espace admin :
// profil, clients, devis + lignes, factures + lignes, conversations IA,
// erreurs IA, réponses négatives, compteurs agrégés.
//
// Auth : bearer token de l'admin (ADMIN_EMAIL). Paramètre : userId (query
// string ou body). Charge en parallèle via service_role key.

import { cors } from "./_cors.js"
import { authenticate } from "./_withAuth.js"

// Exécute une requête Supabase en tolérant l'absence de table (ex: migration
// 0012 non appliquée sur l'env courant). Renvoie { data: [], error } au lieu
// de faire crasher tout l'endpoint.
async function safe(q) {
  try {
    const r = await q
    if (r.error) return { data: null, error: r.error.message || String(r.error) }
    return { data: r.data, error: null }
  } catch (e) {
    return { data: null, error: e?.message || String(e) }
  }
}

export default async function handler(req, res) {
  cors(req, res, { methods: "GET, OPTIONS" })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await authenticate(req, res, { adminOnly: true })
    if (!auth) return
    const { admin } = auth

    const userId = (req.query.userId || req.query.id || '').toString().trim()
    if (!userId) return res.status(400).json({ error: 'userId manquant' })

    // Auth user cible
    const { data: targetRes, error: targetErr } = await admin.auth.admin.getUserById(userId)
    if (targetErr || !targetRes?.user)
      return res.status(404).json({ error: 'Utilisateur introuvable' })
    const target = targetRes.user

    // Chargement parallèle — chaque requête est isolée pour qu'un table
    // manquante / erreur unitaire ne plombe pas l'ensemble.
    const [
      profileR, clientsR, devisR, lignesDevisR,
      invoicesR, lignesInvoicesR, convR, errR, negR, activityR,
    ] = await Promise.all([
      safe(admin.from('profiles').select('*').eq('id', userId).maybeSingle()),
      safe(admin.from('clients').select('*').eq('owner_id', userId).order('created_at', { ascending: false })),
      safe(admin.from('devis').select('*').eq('owner_id', userId).is('deleted_at', null).order('created_at', { ascending: false })),
      safe(admin.from('lignes_devis').select('*').eq('owner_id', userId).order('position')),
      safe(admin.from('invoices').select('*').eq('owner_id', userId).is('deleted_at', null).order('created_at', { ascending: false })),
      safe(admin.from('lignes_invoices').select('*').eq('owner_id', userId).order('position')),
      safe(admin.from('ia_conversations').select('*').eq('owner_id', userId).order('created_at', { ascending: true }).limit(500)),
      safe(admin.from('ia_error_logs').select('*').eq('owner_id', userId).order('created_at', { ascending: false }).limit(100)),
      safe(admin.from('ia_negative_logs').select('*').eq('owner_id', userId).order('created_at', { ascending: false }).limit(100)),
      safe(admin.from('activity_log').select('*').eq('owner_id', userId).order('created_at', { ascending: false }).limit(200)),
    ])

  const devis    = devisR.data    || []
  const invoices = invoicesR.data || []
  const clients  = clientsR.data  || []

  // Attache les lignes à chaque devis / facture
  const byDevisId = new Map()
  for (const l of (lignesDevisR.data || [])) {
    if (!byDevisId.has(l.devis_id)) byDevisId.set(l.devis_id, [])
    byDevisId.get(l.devis_id).push(l)
  }
  const byInvoiceId = new Map()
  for (const l of (lignesInvoicesR.data || [])) {
    if (!byInvoiceId.has(l.invoice_id)) byInvoiceId.set(l.invoice_id, [])
    byInvoiceId.get(l.invoice_id).push(l)
  }
  const devisWithLines    = devis.map(d => ({ ...d, lignes: byDevisId.get(d.id) || [] }))
  const invoicesWithLines = invoices.map(i => ({ ...i, lignes: byInvoiceId.get(i.id) || [] }))

  // Stats rapides
  const stats = {
    devisTotal:     devis.length,
    clientsTotal:   clients.length,
    invoicesTotal:  invoices.length,
    caAccepte:      devis.filter(d => d.statut === 'accepte').reduce((s, d) => s + (Number(d.montant_ht) || 0), 0),
    caEnCours:      devis.filter(d => ['envoye','en_signature'].includes(d.statut)).reduce((s, d) => s + (Number(d.montant_ht) || 0), 0),
    invoicesHT:     invoices.reduce((s, i) => s + (Number(i.montant_ht) || 0), 0),
    byStatut:       devis.reduce((acc, d) => { acc[d.statut] = (acc[d.statut] || 0) + 1; return acc }, {}),
    conversations:  (convR.data || []).length,
    errors:         (errR.data  || []).length,
    negatives:      (negR.data  || []).length,
    aiUsed:         profileR.data?.ai_used || 0,
  }

  return res.status(200).json({
    user: {
      id:             target.id,
      email:          target.email,
      created_at:     target.created_at,
      last_sign_in_at:target.last_sign_in_at,
      confirmed_at:   target.email_confirmed_at,
      user_metadata:  target.user_metadata,
    },
    profile:       profileR.data || null,
    stats,
    clients,
    devis:         devisWithLines,
    invoices:      invoicesWithLines,
    conversations: convR.data  || [],
    errors:        errR.data   || [],
      negatives:     negR.data   || [],
      activity:      activityR.data || [],
      warnings:      [profileR, clientsR, devisR, lignesDevisR, invoicesR, lignesInvoicesR, convR, errR, negR, activityR]
                       .filter(r => r.error).map(r => r.error),
      generatedAt:   new Date().toISOString(),
    })
  } catch (err) {
    console.error('[admin-user-detail] unhandled:', err)
    return res.status(500).json({
      error: err?.message || String(err) || 'Erreur interne inconnue',
    })
  }
}
