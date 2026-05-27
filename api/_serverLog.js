// Logger serveur — insère un événement dans public.app_logs (table de
// l'AppLogger client, migration 0017) via le service_role. Les fonctions
// Vercel n'ont accès qu'à `console.error/warn` par défaut, dont la
// rétention sur le plan Hobby est d'une semaine. Ce helper bridge donc
// les incidents serveur (webhook Stripe en échec, envoi email raté,
// Factur-X qui plante…) vers la même section « Erreurs application »
// du panel admin que le code client.
//
// Best-effort : ne lève jamais. Le logger ne doit JAMAIS faire planter
// le handler qui l'appelle.

import { createClient } from "@supabase/supabase-js"

let cachedAdmin

function getAdmin() {
  if (cachedAdmin) return cachedAdmin
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  cachedAdmin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return cachedAdmin
}

export async function serverLog(level, message, context = {}) {
  try {
    const admin = getAdmin()
    if (!admin) return
    const { stack, ...ctx } = context || {}
    await admin.from("app_logs").insert({
      level,
      message: String(message).slice(0, 2000),
      stack: stack ? String(stack).slice(0, 5000) : null,
      context: { source: "server", ...ctx },
    })
  } catch (_) { /* never throw from logger */ }
}

// Raccourcis sémantiques. `err` peut être l'objet Error ; on en extrait
// stack/code/message pour les coller dans le contexte.
export function logServerError(area, err, extra = {}) {
  return serverLog("error", `${area}: ${err?.message || String(err) || "unknown"}`, {
    area,
    stack: err?.stack || null,
    code:  err?.code  || null,
    ...extra,
  })
}

export function logServerWarn(area, message, extra = {}) {
  return serverLog("warn", `${area}: ${message}`, { area, ...extra })
}
