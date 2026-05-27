import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import { AuthProvider } from './lib/auth.jsx'
import Root from './Root.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// onNeedRefresh fourni : on supprime le reload silencieux mid-session de
// vite-plugin-pwa en mode 'autoUpdate'. Sans ce callback, le plugin
// déclenche window.location.reload() dès qu'un nouveau SW est prêt, et
// l'utilisateur perd ce qu'il était en train de faire.
//
// À la place, on émet un custom event 'zenbat:sw-needs-refresh' qu'un
// composant React (UpdateAvailableToast) capte pour afficher un toast non
// intrusif avec un bouton "Actualiser". L'utilisateur décide quand
// appliquer la mise à jour.
//
// On stocke updateSW sur window pour que le toast puisse l'appeler avec
// l'argument true (skipWaiting + reload propre via le plugin lui-même).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.__zenbatSWUpdateReady__ = true
    window.dispatchEvent(new CustomEvent('zenbat:sw-needs-refresh'))
  },
  onOfflineReady() { /* no-op */ },
})
window.__zenbatSWUpdate__ = updateSW

// Récupération auto après un redéploiement Vercel : quand le bundle principal
// en cache référence un chunk qui n'existe plus (nouveaux hashes après build),
// le navigateur lève une erreur de chargement dynamique (libellé variant
// selon le moteur, cf. chunkReload.js). Les listeners ci-dessous gèrent les
// erreurs non attrapées ; pour les erreurs avalées par un try/catch côté
// composant, le handler doit importer { isChunkLoadError, tryReloadOnce }
// et déclencher le reload depuis son catch.
//
// On déclenche aussi le reload sur isLegacyCacheError : ce sont des messages
// d'erreur qui n'apparaissent que dans d'anciennes versions du bundle (ex.
// atob() strict d'iOS Safari, corrigé en 9f06754) — leur présence chez un
// user signifie quasi-certainement un cache PWA périmé.
import { isChunkLoadError, isLegacyCacheError, tryReloadOnce } from './lib/chunkReload.js'
// Trace l'incident en app_logs AVANT de tenter le reload — sinon
// l'admin ne saurait jamais qu'un utilisateur a vécu ce reload (le
// listener AppLogger d'index.html capture l'erreur originale mais sans
// le contexte « chunk error / reload auto » qui aide au diagnostic).
const logChunkErr = (msg, source) => {
  try { window.AppLogger?.logError(`chunk reload: ${msg}`.slice(0, 200), null, { area: "chunk-reload", source }); } catch {}
}
window.addEventListener('error', (e) => {
  const msg = e?.message || e?.error?.message
  if (isChunkLoadError(msg) || isLegacyCacheError(msg)) {
    logChunkErr(msg, "error")
    tryReloadOnce()
  }
})
window.addEventListener('unhandledrejection', (e) => {
  const r = e?.reason
  const m = r?.message || r
  if (isChunkLoadError(m) || isLegacyCacheError(m)) {
    logChunkErr(m, "unhandledrejection")
    tryReloadOnce()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
)
