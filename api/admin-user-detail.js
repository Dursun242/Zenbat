// Détail complet d'un utilisateur pour l'espace admin :
// profil, clients, devis + lignes, factures + lignes, conversations IA,
// erreurs IA, réponses négatives, compteurs agrégés.
//
// Auth : bearer token de l'admin (ADMIN_EMAIL). Paramètre : userId (query
// string ou body). Charge en parallèle via service_role key.

import { createClient } from '@supabase/supabase-js'

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean)

function cors(req, res) {
  const origin = req.headers.origin || ''
  const isProd  = process.env.VERCEL_ENV === 'production'
  const allowed = isProd
    ? (ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || ''))
    : origin
  if (allowed) res.setHeader('Access-Control-Allow-Origin', allowed)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

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

  // Vérifie l'identité de l'appelant + droit admin
  const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !caller) return res.status(401).json({ error: 'Token invalide' })
  const norm = (s) => String(s || '').trim().toLowerCase()
  if (!adminEmail || norm(caller.email) !== norm(adminEmail))
    return res.status(403).json({ error: "Accès réservé à l'administrateur" })

  const userId = (req.query.userId || req.query.id || '').toString().trim()
  if (!userId) return res.status(400).json({ error: 'userId manquant' })

  // Auth user cible
  const { data: targetRes, error: targetErr } = await admin.auth.admin.getUserById(userId)
  if (targetErr || !targetRes?.user)
    return res.status(404).json({ error: 'Utilisateur introuvable' })
  const target = targetRes.user

  // Chargement parallèle de toutes les données liées au user
  const [
    profileR,
    clientsR,
    devisR,
    lignesDevisR,
    invoicesR,
    lignesInvoicesR,
    convR,
    errR,
    negR,
    activityR,
  ] = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
    admin.from('clients').select('*').eq('owner_id', userId).order('created_at', { ascending: false }),
    admin.from('devis').select('*').eq('owner_id', userId).is('deleted_at', null).order('created_at', { ascending: false }),
    admin.from('lignes_devis').select('*').eq('owner_id', userId).order('position'),
    admin.from('invoices').select('*').eq('owner_id', userId).is('deleted_at', null).order('created_at', { ascending: false }),
    admin.from('lignes_invoices').select('*').eq('owner_id', userId).order('position'),
    admin.from('ia_conversations').select('*').eq('owner_id', userId).order('created_at', { ascending: true }).limit(500),
    admin.from('ia_error_logs').select('*').eq('owner_id', userId).order('created_at', { ascending: false }).limit(100),
    admin.from('ia_negative_logs').select('*').eq('owner_id', userId).order('created_at', { ascending: false }).limit(100),
    admin.from('activity_log').select('*').eq('owner_id', userId).order('created_at', { ascending: false }).limit(200),
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
    generatedAt:   new Date().toISOString(),
  })
}
