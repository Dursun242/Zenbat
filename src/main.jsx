import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import { AuthProvider } from './lib/auth.jsx'
import Root from './Root.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { isChunkLoadError, tryReloadOnce } from './lib/chunkRecovery.js'

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
// le navigateur lève "'text/html' is not a valid JavaScript MIME type" ou
// "Failed to fetch dynamically imported module". On recharge alors la page
// une seule fois pour récupérer le nouveau main bundle. Les échecs de
// React.lazy() sont eux jetés dans Suspense et captés par l'ErrorBoundary,
// qui appelle la même logique (cf. components/ErrorBoundary.jsx).
window.addEventListener('error', (e) => {
  if (isChunkLoadError(e) || isChunkLoadError(e?.error)) tryReloadOnce()
})
window.addEventListener('unhandledrejection', (e) => {
  if (isChunkLoadError(e?.reason)) tryReloadOnce()
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
