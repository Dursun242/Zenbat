// Détection + reload "une fois" pour les erreurs de chunk après redéploiement.
//
// Quand Vercel publie une nouvelle version, les chunks JS changent de hash.
// L'app en cache (ancien index.html servi par le SW) référence des chunks par
// leurs anciens noms → `import()` lève une erreur :
//   - Chrome/Edge : "Failed to fetch dynamically imported module"
//   - Safari      : "Importing a module script failed"
//   - Firefox     : "Loading chunk … failed" / MIME type
// On veut alors recharger la page une seule fois pour récupérer le nouveau
// index.html (avec les nouveaux hashs). Un flag localStorage évite la boucle
// infinie si le rechargement ne résout pas le problème.
//
// Pourquoi ce helper plutôt que se reposer uniquement sur les listeners
// globaux dans main.jsx : quand un handler React (ex. handleFacturX) attrape
// l'erreur dans son propre try/catch pour afficher un message à l'utilisateur,
// l'`unhandledrejection` n'est jamais émis. Le handler doit donc déclencher
// le reload explicitement depuis son catch.

const CHUNK_RELOAD_FLAG = 'zenbat_chunk_reload_at'

export function isChunkLoadError(msg) {
  if (!msg) return false
  const s = String(msg.message || msg)
  return /Failed to fetch dynamically imported module|is not a valid JavaScript MIME type|Loading chunk .* failed|Importing a module script failed/i.test(s)
}

// Heuristique "vieux cache" : ces erreurs n'apparaissent jamais dans le
// code en cours mais ont été émises par d'anciennes versions du bundle
// que des utilisateurs gardent en cache PWA. Quand on les voit côté
// client, c'est presque toujours un signe que le SW sert du JS périmé
// → on tente le reload via tryReloadOnce (debounce 30s incluse).
//
// "The string did not match the expected pattern" était le message
// renvoyé par atob() de WebKit (iOS Safari) sur l'ancien décodage
// base64 du PDF Factur-X — corrigé en 9f06754 par fetch(data:URL).
// Si un user voit encore ce message, son app n'a pas le fix → reload.
export function isLegacyCacheError(msg) {
  if (!msg) return false
  const s = String(msg.message || msg)
  return /The string did not match the expected pattern/i.test(s)
}

export function tryReloadOnce() {
  try {
    const last = Number(localStorage.getItem(CHUNK_RELOAD_FLAG) || 0)
    // Ne recharge qu'une fois par tranche de 30s (évite la boucle)
    if (Date.now() - last < 30000) return false
    localStorage.setItem(CHUNK_RELOAD_FLAG, String(Date.now()))
    // Force le SW à reprendre la main puis reload hard
    if (navigator.serviceWorker?.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.update().catch(() => {}))
      }).catch(() => {})
    }
    window.location.reload()
    return true
  } catch { return false }
}
