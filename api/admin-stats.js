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

  // Vérification identité
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })
  if (adminEmail && user.email !== adminEmail)
    return res.status(403).json({ error: "Accès réservé à l'administrateur" })

  // ── Récupération des données ─────────────────────────────────────────
  const [
    { data: profiles,  error: pe },
    { data: allDevis,  error: de },
    { data: authUsers, error: ae },
  ] = await Promise.all([
    admin.from('profiles').select('id, company_name, full_name, plan, ai_used, created_at, updated_at'),
    admin.from('devis').select('id, owner_id, statut, montant_ht, created_at'),
    admin.auth.admin.listUsers({ perPage: 1000 }).then(r => ({ data: r.data?.users || [], error: r.error })),
  ])

  if (pe) return res.status(500).json({ error: pe.message })
  if (de) return res.status(500).json({ error: de.message })

  const now         = new Date()
  const startMonth  = new Date(now.getFullYear(), now.getMonth(), 1)
  const startLast   = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const start7      = new Date(now - 7  * 86400000)
  const start14     = new Date(now - 14 * 86400000)
  const TRIAL_DAYS  = 30

  // ── Index rapides ────────────────────────────────────────────────────
  const authByProfileId = new Map((authUsers || []).map(u => [u.id, u]))

  // Par propriétaire : stats devis
  const statsByOwner = {}
  for (const d of allDevis || []) {
    if (!statsByOwner[d.owner_id]) {
      statsByOwner[d.owner_id] = { total: 0, brouillon: 0, envoye: 0, en_signature: 0, accepte: 0, refuse: 0, ca: 0, lastDevis: null }
    }
    const s = statsByOwner[d.owner_id]
    s.total++
    s[d.statut] = (s[d.statut] || 0) + 1
    if (d.statut === 'accepte') s.ca += Number(d.montant_ht || 0)
    if (!s.lastDevis || d.created_at > s.lastDevis) s.lastDevis = d.created_at
  }

  // ── Utilisateurs : stats globales ────────────────────────────────────
  const totalUsers    = profiles?.length || 0
  const proUsers      = profiles?.filter(p => p.plan === 'pro').length || 0
  const newThisMonth  = profiles?.filter(p => new Date(p.created_at) >= startMonth).length || 0
  const newLastMonth  = profiles?.filter(p => { const d = new Date(p.created_at); return d >= startLast && d < startMonth }).length || 0
  const newLast7      = profiles?.filter(p => new Date(p.created_at) >= start7).length || 0
  const totalAiUsed   = profiles?.reduce((s, p) => s + (p.ai_used || 0), 0) || 0
  const activeUsers   = Object.keys(statsByOwner).length  // au moins 1 devis
  const mrr           = proUsers * 15  // 15€/mois

  // Trial : utilisateurs dont l'essai se termine dans 7 jours
  const trialEndingSoon = (profiles || []).filter(p => {
    if (p.plan === 'pro') return false
    const auth = authByProfileId.get(p.id)
    const created = new Date(auth?.created_at || p.created_at)
    const daysLeft = TRIAL_DAYS - Math.floor((now - created) / 86400000)
    return daysLeft >= 0 && daysLeft <= 7
  }).length

  // ── Devis : stats globales ───────────────────────────────────────────
  const totalDevis    = allDevis?.length || 0
  const byStatut      = { brouillon: 0, envoye: 0, en_signature: 0, accepte: 0, refuse: 0 }
  for (const d of allDevis || []) if (d.statut in byStatut) byStatut[d.statut]++

  const caAccepte     = (allDevis || []).filter(d => d.statut === 'accepte').reduce((s, d) => s + Number(d.montant_ht || 0), 0)
  const caEnCours     = (allDevis || []).filter(d => ['envoye', 'en_signature'].includes(d.statut)).reduce((s, d) => s + Number(d.montant_ht || 0), 0)
  const avgDevisValue = totalDevis ? Math.round(caAccepte / (byStatut.accepte || 1)) : 0
  const txConversion  = totalDevis ? Math.round((byStatut.accepte / totalDevis) * 100) : 0
  const devisMonth    = (allDevis || []).filter(d => new Date(d.created_at) >= startMonth).length
  const devisLast7    = (allDevis || []).filter(d => new Date(d.created_at) >= start7).length
  const devisPrev7    = (allDevis || []).filter(d => { const t = new Date(d.created_at); return t >= start14 && t < start7 }).length
  const trendDevis    = devisPrev7 ? Math.round(((devisLast7 - devisPrev7) / devisPrev7) * 100) : null

  // ── Entonnoir de conversion ──────────────────────────────────────────
  const funnel = {
    inscrits:    totalUsers,
    avecDevis:   Object.keys(statsByOwner).length,
    devisEnvoye: Object.values(statsByOwner).filter(s => s.envoye + s.en_signature + s.accepte > 0).length,
    devisAccepte:Object.values(statsByOwner).filter(s => s.accepte > 0).length,
  }

  // ── Tableau utilisateurs détaillé ───────────────────────────────────
  const usersDetail = (profiles || [])
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(p => {
      const auth    = authByProfileId.get(p.id)
      const stats   = statsByOwner[p.id] || { total: 0, accepte: 0, ca: 0, lastDevis: null }
      const created = new Date(auth?.created_at || p.created_at)
      const daysLeft = Math.max(0, TRIAL_DAYS - Math.floor((now - created) / 86400000))
      return {
        id:           p.id,
        name:         p.company_name || p.full_name || '—',
        email:        auth?.email || '—',
        plan:         p.plan || 'free',
        ai_used:      p.ai_used || 0,
        joined:       auth?.created_at || p.created_at,
        lastSignIn:   auth?.last_sign_in_at || null,
        lastDevis:    stats.lastDevis,
        devisTotal:   stats.total,
        devisAccepte: stats.accepte,
        caTotal:      stats.ca,
        daysLeft:     p.plan === 'pro' ? null : daysLeft,
        txConv:       stats.total ? Math.round((stats.accepte / stats.total) * 100) : 0,
        byStatut: {
          brouillon:    stats.brouillon    || 0,
          envoye:       stats.envoye       || 0,
          en_signature: stats.en_signature || 0,
          accepte:      stats.accepte      || 0,
          refuse:       stats.refuse       || 0,
        },
      }
    })

  return res.status(200).json({
    users: {
      total: totalUsers, pro: proUsers, free: totalUsers - proUsers,
      newThisMonth, newLastMonth, newLast7, totalAiUsed,
      activeUsers, mrr, trialEndingSoon,
    },
    devis: {
      total: totalDevis, byStatut, caAccepte, caEnCours,
      avgDevisValue, txConversion, devisMonth, devisLast7, devisPrev7, trendDevis,
    },
    funnel,
    usersDetail,
    generatedAt: new Date().toISOString(),
  })
}
