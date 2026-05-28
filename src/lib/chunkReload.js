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

const CHUNK_RELOAD_FLAG    = 'zenbat_chunk_reload_at'
const CHUNK_RELOAD_DEEP_AT = 'zenbat_chunk_reload_deep_at'

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
// Patterns détectés :
// - "The string did not match the expected pattern" : ancien atob() iOS
//   Safari, supprimé en 9f06754. Plus présent dans le code courant.
// - "i.metadata.Unicode.widths" / similaire : jsPDF qui crashe parce que
//   les TTF sont arrivés en HTML d'erreur via fetch sans r.ok check. La
//   validation TTF a été ajoutée — si on revoit cette stack, c'est que
//   le client tourne une version antérieure à ce fix.
export function isLegacyCacheError(msg) {
  if (!msg) return false
  const s = String(msg.message || msg)
  return /The string did not match the expected pattern|metadata\.Unicode\.widths|metadata\.Unicode is undefined/i.test(s)
}

// Désinscrit les Service Workers et vide les caches Cache API. Brutal,
// mais c'est ce qui casse une boucle de chunk-error quand le SW
// resserre obstinément un ancien index.html. L'utilisateur perd son
// cache offline — acceptable comparé au blocage complet de l'app.
async function nukeCachesAndSW() {
  try {
    if (navigator.serviceWorker?.getRegistrations) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister().catch(() => {})))
    }
  } catch {}
  try {
    if (typeof caches !== 'undefined' && caches.keys) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k).catch(() => {})))
    }
  } catch {}
}

// Stratégie en 2 niveaux :
//   - 1er chunk-error → reload simple (rapide, cache offline préservé).
//   - 2e chunk-error dans les 30s → nettoyage radical : désinscription
//     SW + purge Cache API + reload. C'est ce qui casse les boucles
//     vécues par les utilisateurs où le SW resservait l'ancien
//     index.html à chaque reload.
//   - 3e dans la minute (= même le nuke n'a pas suffi) → on arrête,
//     l'ErrorBoundary affiche l'écran crash, l'utilisateur clique
//     manuellement « Recharger l'application ».
export function tryReloadOnce() {
  try {
    const now      = Date.now()
    const last     = Number(localStorage.getItem(CHUNK_RELOAD_FLAG) || 0)
    const lastDeep = Number(localStorage.getItem(CHUNK_RELOAD_DEEP_AT) || 0)

    if (now - last < 30000) {
      // Le reload simple précédent n'a pas suffi → mode nuke.
      if (now - lastDeep < 60000) return false
      try { localStorage.setItem(CHUNK_RELOAD_DEEP_AT, String(now)) } catch {}
      nukeCachesAndSW().finally(() => {
        try { window.location.reload() } catch {}
      })
      return true
    }

    try { localStorage.setItem(CHUNK_RELOAD_FLAG, String(now)) } catch {}
    // Demande au SW de se mettre à jour en arrière-plan — best-effort,
    // le reload immédiat suit sans attendre.
    if (navigator.serviceWorker?.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.update().catch(() => {}))
      }).catch(() => {})
    }
    window.location.reload()
    return true
  } catch { return false }
}
