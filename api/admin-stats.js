// Stats tableau de bord admin + données IA — routage par ?type= :
const parseBrand = b => { if (!b) return {}; if (typeof b === 'string') { try { return JSON.parse(b) } catch { return {} } } return b }

//   (aucun type)              → dashboard stats global
//   ?type=conversations       → logs ia_conversations
//   ?type=logs                → logs ia_error_logs
//   ?type=negatives           → logs ia_negative_logs
//   ?type=newsletter          → abonnés newsletter
//   ?type=coherence           → validations cohérence
//   ?type=feedback            → feedbacks 👍/👎
//   ?type=tokens              → tokens consommés + coûts par modèle
//   ?type=retention           → dormants + cohortes (depuis activity_log)
//   ?type=stripe_health       → past_due + canceled (depuis Stripe API live)

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
      const trades = r.trades || parseBrand(p?.brand_data)?.trades || []
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

  if (type === 'quotes_sent') {
    const { data: rows, error: re } = await admin.from('devis_audit_log')
      .select('id, devis_id, meta, created_at, devis:devis_id(numero, objet, montant_ht, owner_id)')
      .eq('event', 'sent')
      .order('created_at', { ascending: false })
      .limit(200)
    if (re) return res.status(500).json({ error: re.message })
    const ownerIds = [...new Set((rows || []).map(r => r.devis?.owner_id).filter(Boolean))]
    const [{ data: profiles }, { data: authUsers }] = await Promise.all([
      admin.from('profiles').select('id, company_name, full_name').in('id', ownerIds.length ? ownerIds : ['00000000-0000-0000-0000-000000000000']),
      admin.auth.admin.listUsers({ perPage: 1000 }).then(r => ({ data: r.data?.users || [], error: r.error })),
    ])
    const profById = new Map((profiles || []).map(p => [p.id, p]))
    const authById = new Map((authUsers || []).map(u => [u.id, u]))
    const enriched = (rows || []).map(r => {
      const ownerId = r.devis?.owner_id
      const p = profById.get(ownerId)
      const a = authById.get(ownerId)
      return {
        id: r.id, devis_id: r.devis_id,
        numero: r.devis?.numero, objet: r.devis?.objet, montant_ht: r.devis?.montant_ht,
        to: r.meta?.to, created_at: r.created_at,
        artisan_email: a?.email || null,
        artisan_name: p?.company_name || p?.full_name || a?.email || '—',
      }
    })
    return res.status(200).json({ quotes_sent: enriched, generatedAt: new Date().toISOString() })
  }

  // ── Rétention : dormants + cohortes ─────────────────────────────────
  // Pourquoi : on voyait les inscriptions mais pas qui s'éteint. La RPC
  // 0051 (admin_last_activity_per_owner) nous donne la dernière vraie
  // activité par owner. On en dérive 3 vues :
  //   - dormants : users qui ont déjà créé un devis mais sans activité
  //     depuis ≥ 14 jours (vrais churns silencieux à relancer, pas les
  //     comptes test jamais ouverts).
  //   - cohorte mensuelle : par mois d'inscription, quel % est encore
  //     actif (au moins 1 entrée activity_log dans les 30 derniers jours).
  //   - distribution d'âge des comptes dormants.
  if (type === 'retention') {
    const DORMANT_DAYS_THRESHOLD = 14
    const ACTIVE_WINDOW_DAYS     = 30
    const now      = Date.now()
    const dormantCutoff = now - DORMANT_DAYS_THRESHOLD * 86400000
    const activeCutoff  = now - ACTIVE_WINDOW_DAYS     * 86400000

    const [
      { data: profiles },
      { data: authUsers },
      { data: devisCounts },
    ] = await Promise.all([
      admin.from('profiles').select('id, company_name, full_name, plan, created_at'),
      admin.auth.admin.listUsers({ perPage: 1000 }).then(r => ({ data: r.data?.users || [] })),
      admin.from('devis').select('owner_id').is('deleted_at', null),
    ])

    // Map last activity (RPC 0051). Fallback graceful si migration absente.
    const lastActByOwner = new Map()
    try {
      const { data: actRows, error: actErr } = await admin.rpc('admin_last_activity_per_owner')
      if (!actErr) for (const r of actRows || []) lastActByOwner.set(r.owner_id, r.last_activity_at)
    } catch {}

    const authById  = new Map((authUsers || []).map(u => [u.id, u]))
    const devisByOwner = new Map()
    for (const d of devisCounts || []) devisByOwner.set(d.owner_id, (devisByOwner.get(d.owner_id) || 0) + 1)

    // ── Liste des dormants ──────────────────────────────────────────────
    const dormants = []
    for (const p of profiles || []) {
      const devisCount = devisByOwner.get(p.id) || 0
      if (devisCount === 0) continue // on filtre les comptes jamais utilisés (tests, faux comptes)
      const lastActStr = lastActByOwner.get(p.id) || authById.get(p.id)?.last_sign_in_at
      const lastActTs  = lastActStr ? new Date(lastActStr).getTime() : 0
      if (lastActTs >= dormantCutoff) continue
      const a = authById.get(p.id)
      dormants.push({
        id:           p.id,
        name:         p.company_name || p.full_name || a?.email || '—',
        email:        a?.email || '—',
        plan:         p.plan || 'free',
        joinedAt:     a?.created_at || p.created_at,
        lastActivity: lastActStr || null,
        daysSince:    lastActTs ? Math.floor((now - lastActTs) / 86400000) : null,
        devisTotal:   devisCount,
      })
    }
    dormants.sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity))

    // ── Cohortes d'inscription (12 derniers mois) ───────────────────────
    const cohortByMonth = new Map() // 'YYYY-MM' → { signups: [], stillActive: 0 }
    for (const p of profiles || []) {
      const created = p.created_at?.slice(0, 7)
      if (!created) continue
      if (!cohortByMonth.has(created)) cohortByMonth.set(created, { signups: 0, stillActive: 0 })
      const c = cohortByMonth.get(created)
      c.signups++
      const lastActStr = lastActByOwner.get(p.id) || authById.get(p.id)?.last_sign_in_at
      if (lastActStr && new Date(lastActStr).getTime() >= activeCutoff) c.stillActive++
    }
    const cohorts = [...cohortByMonth.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12)
      .map(([month, v]) => ({
        month,
        signups:      v.signups,
        stillActive:  v.stillActive,
        retentionPct: v.signups ? Math.round((v.stillActive / v.signups) * 100) : 0,
      }))

    return res.status(200).json({
      dormants,
      cohorts,
      meta: {
        dormantThresholdDays: DORMANT_DAYS_THRESHOLD,
        activeWindowDays:     ACTIVE_WINDOW_DAYS,
        rpcMissing:           lastActByOwner.size === 0,
      },
      generatedAt: new Date().toISOString(),
    })
  }

  // ── Santé revenue Stripe (live API) ─────────────────────────────────
  // On interroge Stripe directement plutôt qu'une table DB : signal
  // toujours frais même si un webhook a raté, et pas de migration à
  // appliquer côté Supabase. Trade-off : 1 à 2 secondes de latence
  // (acceptable pour un panel admin chargé sur demande).
  if (type === 'stripe_health') {
    const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim()
    if (!stripeKey) return res.status(503).json({ error: 'STRIPE_SECRET_KEY non configurée' })

    let stripe
    try {
      const Stripe = (await import('stripe')).default
      stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
    } catch (e) {
      return res.status(500).json({ error: `Init Stripe échouée : ${e.message || e}` })
    }

    // Pagination Stripe : on remonte tout (un SaaS B2B early-stage tient
    // largement dans 200 subs). Limite stricte si ça explose.
    async function listAll(status) {
      const out = []
      let starting_after
      for (let i = 0; i < 5; i++) {
        const page = await stripe.subscriptions.list({ status, limit: 100, starting_after })
        out.push(...page.data)
        if (!page.has_more) break
        starting_after = page.data[page.data.length - 1].id
      }
      return out
    }

    let allActive, allPastDue, allCanceled
    try {
      ;[allActive, allPastDue, allCanceled] = await Promise.all([
        listAll('active'),
        listAll('past_due'),
        // 'canceled' inclut TOUT l'historique → on filtre ensuite sur 90 jours
        listAll('canceled'),
      ])
    } catch (e) {
      return res.status(502).json({ error: `Stripe API échoue : ${e.message || e}` })
    }

    // Hydrate avec les profils Zenbat (lien via stripe_customer_id)
    const customerIds = [...new Set([
      ...allActive,   ...allPastDue, ...allCanceled,
    ].map(s => typeof s.customer === 'string' ? s.customer : s.customer?.id).filter(Boolean))]

    const [{ data: profiles }, { data: authUsers }] = customerIds.length === 0
      ? [{ data: [] }, { data: [] }]
      : await Promise.all([
        admin.from('profiles').select('id, company_name, full_name, stripe_customer_id').in('stripe_customer_id', customerIds),
        admin.auth.admin.listUsers({ perPage: 1000 }).then(r => ({ data: r.data?.users || [] })),
      ])
    const profByCustomer = new Map((profiles || []).map(p => [p.stripe_customer_id, p]))
    const authById       = new Map((authUsers || []).map(u => [u.id, u]))

    const enrich = (sub) => {
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
      const p = profByCustomer.get(customerId)
      const a = p ? authById.get(p.id) : null
      const amount = sub.items?.data?.[0]?.price?.unit_amount
      return {
        id:                sub.id,
        status:            sub.status,
        cancel_at_period_end: !!sub.cancel_at_period_end,
        current_period_end:sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        canceled_at:       sub.canceled_at        ? new Date(sub.canceled_at * 1000).toISOString()        : null,
        amount_monthly:    typeof amount === 'number' ? amount / 100 : null,
        interval:          sub.items?.data?.[0]?.price?.recurring?.interval || null,
        profile_id:        p?.id || null,
        name:              p?.company_name || p?.full_name || a?.email || '—',
        email:             a?.email || sub.customer_email || null,
        zenbat_link:       !!p,
      }
    }

    // Bucket "à churner bientôt" = actifs avec cancel_at_period_end
    const cancelingActive = allActive.filter(s => s.cancel_at_period_end).map(enrich)
    const pastDue         = allPastDue.map(enrich)
    const ninetyDaysAgo   = Date.now() - 90 * 86400000
    const recentlyCanceled = allCanceled
      .filter(s => (s.canceled_at || 0) * 1000 >= ninetyDaysAgo)
      .map(enrich)
      .sort((a, b) => (b.canceled_at || '').localeCompare(a.canceled_at || ''))

    // MRR live = sum des subs 'active' (hors past_due hors canceled).
    // Plus précis que `pro × 19€` de admin-stats global (qui ne distingue
    // pas les Pro temporairement en past_due).
    const mrrCents = allActive.reduce((s, sub) => {
      const amount = sub.items?.data?.[0]?.price?.unit_amount || 0
      const interval = sub.items?.data?.[0]?.price?.recurring?.interval
      // Ramène biannual à mensuel
      return s + (interval === 'year' ? amount / 12 : amount)
    }, 0)

    // Churn ce mois = subs canceled dont canceled_at >= début du mois courant.
    const nowDate = new Date()
    const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime() / 1000
    const churnThisMonth = allCanceled.filter(s => (s.canceled_at || 0) >= monthStart).length

    return res.status(200).json({
      summary: {
        activeCount:        allActive.length,
        pastDueCount:       pastDue.length,
        cancelingCount:     cancelingActive.length,
        recentlyCanceled90d:recentlyCanceled.length,
        churnThisMonth,
        mrrEur:             Math.round(mrrCents / 100),
      },
      pastDue,
      cancelingActive,
      recentlyCanceled,
      generatedAt: new Date().toISOString(),
    })
  }

  if (type) return res.status(400).json({ error: "Paramètre 'type' invalide (conversations | logs | negatives | newsletter | coherence | feedback | tokens | quotes_sent | retention | stripe_health)" })

  // ── Récupération des données ─────────────────────────────────────────
  const [
    { data: profiles,  error: pe },
    { data: allDevis,  error: de },
    { data: authUsers, error: ae },
  ] = await Promise.all([
    admin.from('profiles').select('id, company_name, full_name, plan, ai_used, created_at, updated_at'),
    // deleted_at IS NULL : sinon comptes / CA / byStatut sont gonflés
    // par des devis supprimés (RGPD ou erreurs utilisateur).
    admin.from('devis').select('id, owner_id, statut, montant_ht, created_at').is('deleted_at', null),
    admin.auth.admin.listUsers({ perPage: 1000 }).then(r => ({ data: r.data?.users || [], error: r.error })),
  ])

  if (pe) return res.status(500).json({ error: pe.message })
  if (de) return res.status(500).json({ error: de.message })
  if (ae) return res.status(500).json({ error: ae.message })

  // Dernière activité réelle par owner (cf. migration 0051). Si la
  // migration n'est pas appliquée, la RPC renvoie 42883 → on log et on
  // continue sans cette donnée (l'UI tombe sur lastSignIn).
  const lastActivityByOwner = new Map()
  try {
    const { data: actRows, error: actErr } = await admin.rpc('admin_last_activity_per_owner')
    if (actErr) {
      if (actErr.code !== '42883') console.warn('[admin-stats] rpc last_activity:', actErr.message)
    } else {
      for (const r of actRows || []) lastActivityByOwner.set(r.owner_id, r.last_activity_at)
    }
  } catch (e) {
    console.warn('[admin-stats] rpc last_activity exception:', e?.message || e)
  }

  const now         = new Date()
  const startMonth  = new Date(now.getFullYear(), now.getMonth(), 1)
  const startLast   = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const start7      = new Date(now - 7  * 86400000)
  const start14     = new Date(now - 14 * 86400000)

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

  // Freemium au plafond : utilisateurs free qui ont créé >= 5 devis cette
  // semaine (proches du paywall — cible prioritaire de relance commerciale).
  const isoWeekStartMs = (() => {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    const day = d.getUTCDay() || 7
    if (day > 1) d.setUTCDate(d.getUTCDate() - (day - 1))
    return d.getTime()
  })()
  const freemiumAtCap = (profiles || []).filter(p => {
    if (p.plan === 'pro') return false
    const s = statsByOwner[p.id]
    if (!s?.lastDevis) return false
    // Approximation : devis du owner dont la création est >= début de semaine ISO.
    const recent = (allDevis || []).filter(d => d.owner_id === p.id && new Date(d.created_at).getTime() >= isoWeekStartMs).length
    return recent >= 5
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
      const metaFull = (auth?.user_metadata?.full_name || '').trim()
      const fullName = (p.full_name || metaFull || '').trim()
      // lastActivity = signal réel d'usage (max activity_log). Fallback
      // sur last_sign_in_at puis lastDevis si la RPC est indispo.
      const lastActivity = lastActivityByOwner.get(p.id)
        || auth?.last_sign_in_at
        || stats.lastDevis
        || null
      return {
        id:           p.id,
        name:         p.company_name || fullName || '—',
        fullName,
        email:        auth?.email || '—',
        plan:         p.plan || 'free',
        ai_used:      p.ai_used || 0,
        joined:       auth?.created_at || p.created_at,
        lastSignIn:   auth?.last_sign_in_at || null,
        lastActivity,
        lastDevis:    stats.lastDevis,
        devisTotal:   stats.total,
        devisAccepte: stats.accepte,
        caTotal:      stats.ca,
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
      activeUsers, mrr, freemiumAtCap,
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
