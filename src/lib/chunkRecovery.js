// Détecte les erreurs de chargement d'un chunk JS lazy après un redéploiement
// Vercel (les hashes ont changé) et tente un reload one-shot pour récupérer
// le nouveau main bundle.
//
// Utilisé à deux endroits :
//  - main.jsx : listeners globaux 'error' et 'unhandledrejection'
//  - ErrorBoundary : les échecs de React.lazy() sont jetés dans Suspense
//    et avalés par componentDidCatch avant d'atteindre les listeners window.

const CHUNK_RELOAD_FLAG = 'zenbat_chunk_reload_at'
const RELOAD_COOLDOWN_MS = 30_000

const CHUNK_ERROR_RE = /Failed to fetch dynamically imported module|is not a valid JavaScript MIME type|Loading chunk .* failed|Importing a module script failed/i

export function isChunkLoadError(err) {
  if (!err) return false
  const msg = typeof err === 'string' ? err : (err.message || err.reason?.message || err.reason)
  if (!msg) return false
  return CHUNK_ERROR_RE.test(String(msg))
}

// Renvoie true si un reload a été déclenché, false si on est en cooldown
// (évite la boucle infinie quand le cache est corrompu de manière persistante).
export function tryReloadOnce() {
  try {
    const last = Number(localStorage.getItem(CHUNK_RELOAD_FLAG) || 0)
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false
    localStorage.setItem(CHUNK_RELOAD_FLAG, String(Date.now()))
    if (navigator.serviceWorker?.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.update().catch(() => {}))
      }).catch(() => {})
    }
    window.location.reload()
    return true
  } catch {
    return false
  }
}
