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

// Remplace admin-ia-conversations.js, admin-ia-logs.js, admin-ia-negatives.js
// Paramètre requis : ?type=conversations | logs | negatives
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

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })
  const norm = (s) => String(s || '').trim().toLowerCase()
  if (!adminEmail || norm(user.email) !== norm(adminEmail))
    return res.status(403).json({ error: "Accès réservé à l'administrateur" })

  const type = (req.query.type || '').toString().trim()
  const tableMap = {
    conversations: { table: 'ia_conversations', limit: 500, key: 'conversations' },
    logs:          { table: 'ia_error_logs',    limit: 200, key: 'logs' },
    negatives:     { table: 'ia_negative_logs', limit: 200, key: 'logs' },
  }
  const cfg = tableMap[type]
  if (!cfg) return res.status(400).json({ error: "Paramètre 'type' invalide (conversations | logs | negatives)" })

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
