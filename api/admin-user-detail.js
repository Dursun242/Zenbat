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
  cors(req, res, { methods: "GET, POST, OPTIONS" })
  if (req.method === 'OPTIONS') return res.status(204).end()

  // ── POST : actions admin sur un utilisateur (override plan, etc.) ───
  // Convention multi-routes : champ `action` dans le body (cf. CLAUDE.md
  // "Convention de fusion" pour rester sous la limite 12 slots Vercel).
  if (req.method === 'POST') {
    const auth = await authenticate(req, res, { adminOnly: true })
    if (!auth) return
    const { admin } = auth

    const body   = req.body || {}
    const action = body.action
    const userId = (body.userId || '').toString().trim()
    if (!userId) return res.status(400).json({ error: 'userId manquant' })

    if (action === 'set_plan') {
      const plan = body.plan
      if (plan !== 'free' && plan !== 'pro')
        return res.status(400).json({ error: "plan doit valoir 'free' ou 'pro'" })

      // pro_until: null → un override manuel de plan est permanent, pas un
      // essai daté. On efface donc tout minuteur d'essai en cours.
      let { data, error } = await admin
        .from('profiles')
        .update({ plan, pro_until: null })
        .eq('id', userId)
        .select('id, plan')
        .maybeSingle()
      // Fallback si la migration 0053 n'est pas appliquée : retente sans pro_until.
      if (error?.code === '42703') {
        ({ data, error } = await admin
          .from('profiles')
          .update({ plan })
          .eq('id', userId)
          .select('id, plan')
          .maybeSingle())
      }
      if (error)  return res.status(500).json({ error: error.message || String(error) })
      if (!data)  return res.status(404).json({ error: 'Profil introuvable' })

      console.log(`[admin-user-detail] set_plan: user ${userId} → ${plan} (by admin ${auth.user.email})`)
      return res.status(200).json({ ok: true, plan: data.plan })
    }

    // Offre un essai Pro daté : plan='pro' + pro_until = now + N jours
    // (défaut 30). Le job pg_cron expire_pro_trials (migration 0053)
    // repasse le compte en 'free' à l'échéance, sans intervention.
    if (action === 'grant_pro_trial') {
      const rawDays = Number(body.days)
      const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(365, Math.floor(rawDays)) : 30
      const until = new Date(Date.now() + days * 86400000).toISOString()

      const { data, error } = await admin
        .from('profiles')
        .update({ plan: 'pro', pro_until: until })
        .eq('id', userId)
        .select('id, plan, pro_until')
        .maybeSingle()
      if (error) {
        if (error.code === '42703')
          return res.status(400).json({ error: "Colonne pro_until absente — appliquez la migration 0053 dans Supabase." })
        return res.status(500).json({ error: error.message || String(error) })
      }
      if (!data) return res.status(404).json({ error: 'Profil introuvable' })

      console.log(`[admin-user-detail] grant_pro_trial: user ${userId} → pro until ${until} (${days}j, by admin ${auth.user.email})`)
      return res.status(200).json({ ok: true, plan: data.plan, pro_until: data.pro_until })
    }

    // Correction admin de la fiche profil (brand_data) — utile quand un
    // utilisateur a mal renseigné son email/téléphone/adresse au moment de
    // l'onboarding. Aucune notification n'est envoyée à l'utilisateur :
    // c'est un coup de tampon silencieux, comme set_plan.
    if (action === 'update_brand_data') {
      const patch = body.patch
      if (!patch || typeof patch !== 'object' || Array.isArray(patch))
        return res.status(400).json({ error: 'patch invalide' })

      // Whitelist des champs éditables. On exclut logo / color / fontStyle
      // (besoin d'UI dédiée) et trades (array, format à part). Les valeurs
      // booléennes et numériques sont autorisées pour devisGratuit /
      // validityDays.
      const ALLOWED = new Set([
        'companyName', 'siret', 'tva', 'vatNumber', 'vatRegime',
        'firstName', 'lastName',
        'address', 'postalCode', 'city', 'phone', 'email', 'website',
        'paymentTerms', 'validityDays', 'rib', 'iban', 'bic',
        'mentionsLegales', 'btpMention', 'rgpdMention',
        'devisGratuit', 'devisTarif', 'travelFees',
        'legalForm', 'rcs', 'capital',
        'paymentPenalties', 'escompte',
      ])
      const cleanPatch = {}
      for (const [k, v] of Object.entries(patch)) {
        if (!ALLOWED.has(k)) continue
        if (k === 'email' && typeof v === 'string') {
          // Sanitize : retire tous les caractères blancs (autocap iOS).
          cleanPatch[k] = v.replace(/\s+/g, '')
        } else {
          cleanPatch[k] = typeof v === 'string' ? v.trim() : v
        }
      }
      if (Object.keys(cleanPatch).length === 0)
        return res.status(400).json({ error: 'aucun champ valide à mettre à jour' })

      // Validation email — défense en profondeur, le front bloque déjà
      // mais on garde-fou pour qu'aucune saisie cassée ne descende en DB.
      // Email vide accepté (l'admin peut vouloir l'effacer).
      if (cleanPatch.email && cleanPatch.email.length > 0) {
        const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
        if (cleanPatch.email.length > 254 || !EMAIL_RE.test(cleanPatch.email))
          return res.status(400).json({ error: 'Email invalide' })
      }

      const { data: current, error: readErr } = await admin
        .from('profiles')
        .select('brand_data')
        .eq('id', userId)
        .maybeSingle()
      if (readErr) return res.status(500).json({ error: readErr.message || String(readErr) })
      if (!current) return res.status(404).json({ error: 'Profil introuvable' })

      const newBrandData = { ...(current.brand_data || {}), ...cleanPatch }

      const { data, error } = await admin
        .from('profiles')
        .update({ brand_data: newBrandData })
        .eq('id', userId)
        .select('id, brand_data')
        .maybeSingle()
      if (error) return res.status(500).json({ error: error.message || String(error) })
      if (!data) return res.status(404).json({ error: 'Profil introuvable' })

      console.log(`[admin-user-detail] update_brand_data: user ${userId} (by admin ${auth.user.email}, fields: ${Object.keys(cleanPatch).join(', ')})`)
      return res.status(200).json({ ok: true, brand_data: data.brand_data })
    }

    return res.status(400).json({ error: `action inconnue: ${action}` })
  }

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
