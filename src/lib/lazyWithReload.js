import { lazy } from 'react'
import { isChunkLoadError, tryReloadOnce } from './chunkReload.js'

// React.lazy qui encaisse les erreurs de chunk périmé (« Failed to fetch
// dynamically imported module » après un redéploiement Vercel, cache PWA
// obsolète). Si c'est bien un chunk error, on déclenche le reload via
// tryReloadOnce (debounce 30 s + escalade nuke gérés là-bas) et on renvoie
// une promesse pendante : le fallback Suspense reste affiché pendant que la
// page recharge le nouvel index.html. Si tryReloadOnce a déjà abandonné
// (false), on relance l'erreur pour laisser l'ErrorBoundary proposer le
// reload manuel.
export function lazyWithReload(factory) {
  return lazy(() => factory().catch(err => {
    if (isChunkLoadError(err) && tryReloadOnce()) return new Promise(() => {})
    throw err
  }))
}
