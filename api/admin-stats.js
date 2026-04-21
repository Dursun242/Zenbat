import { createClient } from '@supabase/supabase-js'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // Vérification token
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminEmail  = process.env.ADMIN_EMAIL

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurée' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Vérification identité
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })
  if (adminEmail && user.email !== adminEmail) {
    return res.status(403).json({ error: 'Accès réservé à l\'administrateur' })
  }

  // Récupération des données
  const [
    { data: profiles,  error: pe },
    { data: allDevis,  error: de },
    { data: allLignes, error: le },
  ] = await Promise.all([
    admin.from('profiles').select('id, company_name, full_name, plan, ai_used, created_at'),
    admin.from('devis').select('id, owner_id, statut, montant_ht, created_at'),
    admin.from('lignes_devis').select('id, devis_id', { count: 'exact', head: false }),
  ])

  if (pe) return res.status(500).json({ error: pe.message })
  if (de) return res.status(500).json({ error: de.message })

  const now          = new Date()
  const startMonth   = new Date(now.getFullYear(), now.getMonth(), 1)
  const startLast    = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const start7days   = new Date(now - 7 * 86400000)

  // ── Utilisateurs ────────────────────────────────────────
  const totalUsers     = profiles?.length || 0
  const proUsers       = profiles?.filter(p => p.plan === 'pro').length || 0
  const freeUsers      = totalUsers - proUsers
  const newThisMonth   = profiles?.filter(p => new Date(p.created_at) >= startMonth).length || 0
  const newLastMonth   = profiles?.filter(p => {
    const d = new Date(p.created_at); return d >= startLast && d < startMonth
  }).length || 0
  const newLast7       = profiles?.filter(p => new Date(p.created_at) >= start7days).length || 0
  const totalAiUsed    = profiles?.reduce((s, p) => s + (p.ai_used || 0), 0) || 0

  // ── Devis ────────────────────────────────────────────────
  const totalDevis   = allDevis?.length || 0
  const byStatut     = {
    brouillon:    allDevis?.filter(d => d.statut === 'brouillon').length    || 0,
    envoye:       allDevis?.filter(d => d.statut === 'envoye').length       || 0,
    en_signature: allDevis?.filter(d => d.statut === 'en_signature').length || 0,
    accepte:      allDevis?.filter(d => d.statut === 'accepte').length      || 0,
    refuse:       allDevis?.filter(d => d.statut === 'refuse').length       || 0,
  }
  const caAccepte    = allDevis?.filter(d => d.statut === 'accepte')
    .reduce((s, d) => s + Number(d.montant_ht || 0), 0) || 0
  const caEnCours    = allDevis?.filter(d => ['envoye', 'en_signature'].includes(d.statut))
    .reduce((s, d) => s + Number(d.montant_ht || 0), 0) || 0
  const devisMonth   = allDevis?.filter(d => new Date(d.created_at) >= startMonth).length || 0
  const txConversion = totalDevis ? Math.round((byStatut.accepte / totalDevis) * 100) : 0

  // ── Top utilisateurs (par nb devis) ─────────────────────
  const devByOwner = (allDevis || []).reduce((acc, d) => {
    acc[d.owner_id] = (acc[d.owner_id] || 0) + 1; return acc
  }, {})
  const topUsers = Object.entries(devByOwner)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([owner_id, count]) => {
      const p = profiles?.find(x => x.id === owner_id) || {}
      return { name: p.company_name || p.full_name || '—', plan: p.plan || 'free', ai_used: p.ai_used || 0, devis: count }
    })

  // ── Inscriptions récentes ────────────────────────────────
  const recentUsers = [...(profiles || [])]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8)
    .map(p => ({
      name: p.company_name || p.full_name || '—',
      plan: p.plan || 'free',
      ai_used: p.ai_used || 0,
      joined: p.created_at,
    }))

  return res.status(200).json({
    users:    { total: totalUsers, pro: proUsers, free: freeUsers, newThisMonth, newLastMonth, newLast7, totalAiUsed },
    devis:    { total: totalDevis, byStatut, caAccepte, caEnCours, devisMonth, txConversion },
    topUsers,
    recentUsers,
    generatedAt: new Date().toISOString(),
  })
}
