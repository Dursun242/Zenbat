import { createClient } from '@supabase/supabase-js'
import { cors } from "./_cors.js"

// Remplace admin-ia-conversations.js, admin-ia-logs.js, admin-ia-negatives.js
// Paramètre requis : ?type=conversations | logs | negatives
export default async function handler(req, res) {
  cors(req, res, { methods: "GET, OPTIONS" })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminEmail  = process.env.ADMIN_EMAIL

  if (!supabaseUrl || !serviceKey)
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurée' })

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })
  const norm = (s) => String(s || '').trim().toLowerCase()
  if (!adminEmail || norm(user.email) !== norm(adminEmail))
    return res.status(403).json({ error: "Accès réservé à l'administrateur" })

  const type = (req.query.type || '').toString().trim()

  // Cas spécial : newsletter (pas de jointure profil/auth)
  if (type === 'newsletter') {
    const { data: rows, error: re } = await admin
      .from('newsletter_subscribers')
      .select('id, email, source, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (re) return res.status(500).json({ error: re.message })
    return res.status(200).json({ subscribers: rows || [], generatedAt: new Date().toISOString() })
  }

  // Statistiques moteur de cohérence (table créée par migration 0024)
  if (type === 'coherence') {
    const { data: rows, error: re } = await admin
      .from('coherence_validations')
      .select('id, typology_id, overall_status, iteration_count, created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    if (re) return res.status(500).json({ error: re.message })
    return res.status(200).json({ validations: rows || [], generatedAt: new Date().toISOString() })
  }

  const tableMap = {
    conversations: { table: 'ia_conversations', limit: 500, key: 'conversations' },
    logs:          { table: 'ia_error_logs',    limit: 200, key: 'logs' },
    negatives:     { table: 'ia_negative_logs', limit: 200, key: 'logs' },
  }
  const cfg = tableMap[type]
  if (!cfg) return res.status(400).json({ error: "Paramètre 'type' invalide (conversations | logs | negatives | newsletter | coherence)" })

  const [
    { data: rows,     error: re },
    { data: profiles, error: pe },
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
