// Stats tableau de bord admin + données IA — routage par ?type= :
//   (aucun type)              → dashboard stats global
//   ?type=conversations       → logs ia_conversations
//   ?type=logs                → logs ia_error_logs
//   ?type=negatives           → logs ia_negative_logs
//   ?type=newsletter          → abonnés newsletter
//   ?type=coherence           → validations cohérence
//   ?type=feedback            → feedbacks 👍/👎
//   ?type=tokens              → tokens consommés + coûts par modèle

// Prix USD par million de tokens (Anthropic, mai 2026)
const MODEL_PRICING = {
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4.00 },
  "claude-sonnet-4-6":         { input: 3.00, output: 15.00 },
  "claude-sonnet-4-5":         { input: 3.00, output: 15.00 },
}

import { cors } from "./_cors.js"
import { authenticate } from "./_withAuth.js"

export default async function handler(req, res) {
  cors(req, res, { methods: "GET, OPTIONS" })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await authenticate(req, res, { adminOnly: true })
  if (!auth) return
  const { admin } = auth

  // ── Données IA : routage par ?type= ─────────────────────────────────
  const type = (req.query.type || '').toString().trim()

  if (type === 'newsletter') {
    const { data: rows, error: re } = await admin
      .from('newsletter_subscribers')
      .select('id, email, source, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (re) return res.status(500).json({ error: re.message })
    return res.status(200).json({ subscribers: rows || [], generatedAt: new Date().toISOString() })
  }

  if (type === 'coherence') {
    const { data: rows, error: re } = await admin
      .from('coherence_validations')
      .select('id, typology_id, overall_status, iteration_count, created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    if (re) return res.status(500).json({ error: re.message })
    return res.status(200).json({ validations: rows || [], generatedAt: new Date().toISOString() })
  }

  if (type === 'feedback') {
    const [
      { data: rows,     error: re },
      { data: profiles, error: pe },
      { data: authUsers, error: ae },
    ] = await Promise.all([
      admin.from('ia_feedback').select('*').order('created_at', { ascending: false }).limit(500),
      admin.from('profiles').select('id, company_name, full_name, brand_data'),
      admin.auth.admin.listUsers({ perPage: 1000 }).then(r => ({ data: r.data?.users || [], error: r.error })),
    ])
    if (re) return res.status(500).json({ error: re.message })
    const profById2 = new Map((profiles || []).map(p => [p.id, p]))
    const authById2 = new Map((authUsers || []).map(u => [u.id, u]))
    const enriched2 = (rows || []).map(r => {
      const p = profById2.get(r.user_id)
      const a = authById2.get(r.user_id)
      const trades = r.trades || JSON.parse(p?.brand_data || '{}')?.trades || []
      return { ...r, email: a?.email || null, name: p?.company_name || p?.full_name || a?.email || '—', trades }
    })
    return res.status(200).json({ feedback: enriched2, generatedAt: new Date().toISOString() })
  }

  if (type === 'tokens') {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
    const startMonth    = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [
      { data: allLogs,    error: le },
      { data: recent,     error: re },
      { data: profiles,   error: pro },
      { data: authUsers,  error: ae },
    ] = await Promise.all([
      admin.from('claude_api_logs').select('model, input_tokens, output_tokens, created_at, user_id').eq('status_code', 200),
      admin.from('claude_api_logs').select('model, input_tokens, output_tokens, created_at, user_id').eq('status_code', 200).gte('created_at', thirtyDaysAgo),
      admin.from('profiles').select('id, company_name, full_name'),
      admin.auth.admin.listUsers({ perPage: 1000 }).then(r => ({ data: r.data?.users || [], error: r.error })),
    ])
    if (le) return res.status(500).json({ error: le.message })

    const calcCost = (model, inputTk, outputTk) => {
      const p = MODEL_PRICING[model] || { input: 3.00, output: 15.00 }
      return (inputTk / 1_000_000) * p.input + (outputTk / 1_000_000) * p.output
    }

    // ── Totaux globaux ──────────────────────────────────────────────────
    let totalInput = 0, totalOutput = 0, totalCost = 0
    let monthInput = 0, monthOutput = 0, monthCost = 0
    const byModel = {}
    for (const r of allLogs || []) {
      const inp = r.input_tokens  || 0
      const out = r.output_tokens || 0
      const cost = calcCost(r.model, inp, out)
      totalInput  += inp; totalOutput += out; totalCost += cost
      const m = r.model || 'unknown'
      if (!byModel[m]) byModel[m] = { input: 0, output: 0, cost: 0, calls: 0 }
      byModel[m].input  += inp
      byModel[m].output += out
      byModel[m].cost   += cost
      byModel[m].calls  += 1
    }
    for (const r of allLogs || []) {
      if (r.created_at >= startMonth) {
        monthInput  += r.input_tokens  || 0
        monthOutput += r.output_tokens || 0
        monthCost   += calcCost(r.model, r.input_tokens || 0, r.output_tokens || 0)
      }
    }

    // ── Aujourd'hui & cette semaine (depuis recent déjà chargé) ────────
    const todayStr      = new Date().toISOString().slice(0, 10)
    const sevenDaysAgo  = new Date(Date.now() - 7 * 86400000).toISOString()
    let todayInput = 0, todayOutput = 0, todayCost = 0, todayCalls = 0
    let weekInput  = 0, weekOutput  = 0, weekCost  = 0, weekCalls  = 0
    for (const r of recent || []) {
      const inp  = r.input_tokens  || 0
      const out  = r.output_tokens || 0
      const cost = calcCost(r.model, inp, out)
      if (r.created_at >= sevenDaysAgo) {
        weekInput += inp; weekOutput += out; weekCost += cost; weekCalls++
      }
      if (r.created_at.slice(0, 10) === todayStr) {
        todayInput += inp; todayOutput += out; todayCost += cost; todayCalls++
      }
    }

    // ── Tendance journalière (30 derniers jours) ────────────────────────
    const daily = {}
    for (const r of recent || []) {
      const day = r.created_at.slice(0, 10)
      if (!daily[day]) daily[day] = { input: 0, output: 0, cost: 0, calls: 0 }
      const inp = r.input_tokens  || 0
      const out = r.output_tokens || 0
      daily[day].input  += inp
      daily[day].output += out
      daily[day].cost   += calcCost(r.model, inp, out)
      daily[day].calls  += 1
    }
    const dailyTrend = Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }))

    // ── Top utilisateurs ────────────────────────────────────────────────
    const profById  = new Map((profiles  || []).map(p => [p.id, p]))
    const authById  = new Map((authUsers || []).map(u => [u.id, u]))
    const perUser = {}
    for (const r of allLogs || []) {
      if (!r.user_id) continue
      const inp  = r.input_tokens  || 0
      const out  = r.output_tokens || 0
      const cost = calcCost(r.model, inp, out)
      if (!perUser[r.user_id]) perUser[r.user_id] = { input: 0, output: 0, cost: 0, calls: 0 }
      perUser[r.user_id].input  += inp
      perUser[r.user_id].output += out
      perUser[r.user_id].cost   += cost
      perUser[r.user_id].calls  += 1
    }
    const topUsers = Object.entries(perUser)
      .map(([id, v]) => {
        const p = profById.get(id)
        const a = authById.get(id)
        return { id, name: p?.company_name || p?.full_name || a?.email || '—', email: a?.email || '—', ...v }
      })
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 20)

    return res.status(200).json({
      total:  { input: totalInput, output: totalOutput, cost: totalCost, calls: (allLogs || []).length },
      month:  { input: monthInput, output: monthOutput, cost: monthCost },
      week:   { input: weekInput,  output: weekOutput,  cost: weekCost,  calls: weekCalls  },
      today:  { input: todayInput, output: todayOutput, cost: todayCost, calls: todayCalls },
      byModel: Object.entries(byModel).map(([model, v]) => ({ model, ...v })).sort((a, b) => b.cost - a.cost),
      dailyTrend,
      topUsers,
      generatedAt: new Date().toISOString(),
    })
  }

  if (type === 'conversations' || type === 'logs' || type === 'negatives') {
    const tableMap = {
      conversations: { table: 'ia_conversations', limit: 500, key: 'conversations' },
      logs:          { table: 'ia_error_logs',    limit: 200, key: 'logs' },
      negatives:     { table: 'ia_negative_logs', limit: 200, key: 'logs' },
    }
    const cfg = tableMap[type]
    const [
      { data: rows,      error: re },
      { data: profiles,  error: pe },
      { data: authUsers, error: ae },
    ] = await Promise.all([
      admin.from(cfg.table).select('*').order('created_at', { ascending: false }).limit(cfg.limit),
      admin.from('profiles').select('id, company_name, full_name'),
      admin.auth.admin.listUsers({ perPage: 1000 }).then(r => ({ data: r.data?.users || [], error: r.error })),
    ])
    if (re) return res.status(500).json({ error: re.message })
    if (pe) return res.status(500).json({ error: pe.message })
    if (ae) return res.status(500).json({ error: ae.message })
    const profById = new Map((profiles || []).map(p => [p.id, p]))
    const authById = new Map((authUsers || []).map(u => [u.id, u]))
    const enriched = (rows || []).map(r => {
      const p = profById.get(r.owner_id)
      const a = authById.get(r.owner_id)
      return { ...r, email: a?.email || null, name: p?.company_name || p?.full_name || a?.email || '—' }
    })
    return res.status(200).json({ [cfg.key]: enriched, generatedAt: new Date().toISOString() })
  }

  if (type) return res.status(400).json({ error: "Paramètre 'type' invalide (conversations | logs | negatives | newsletter | coherence | feedback | tokens)" })

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
  if (ae) return res.status(500).json({ error: ae.message })

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
  const mrr           = proUsers * 19  // 19€/mois HT

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
      const metaFull = (auth?.user_metadata?.full_name || '').trim()
      const fullName = (p.full_name || metaFull || '').trim()
      return {
        id:           p.id,
        name:         p.company_name || fullName || '—',
        fullName,
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
