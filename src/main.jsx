import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { AuthProvider } from './lib/auth.jsx'
import Root from './Root.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// ⚠ onNeedRefresh / onOfflineReady fournis = no-op : on supprime le reload
// silencieux mid-session de vite-plugin-pwa en mode 'autoUpdate'. Sans ce
// callback, le plugin déclenche window.location.reload() dès qu'un nouveau
// SW est prêt, et l'utilisateur perd ce qu'il était en train de faire.
// Avec un callback (même vide), on garde le contrôle : la MAJ est appliquée
// au prochain démarrage naturel de l'app (le SW "waiting" prend la main
// quand toutes les fenêtres sont fermées puis rouvertes).
registerSW({
  immediate: true,
  onNeedRefresh() { /* no-op : MAJ silencieuse au prochain démarrage */ },
  onOfflineReady() { /* no-op */ },
})

// Récupération auto après un redéploiement Vercel : quand le bundle principal
// en cache référence un chunk qui n'existe plus (nouveaux hashes après build),
// le navigateur lève "'text/html' is not a valid JavaScript MIME type" ou
// "Failed to fetch dynamically imported module". Dans ce cas, on recharge
// la page une seule fois pour récupérer le nouveau main bundle.
// Garde-fou : flag localStorage pour éviter une boucle infinie si le fix ne
// résout pas (cache corrompu).
const CHUNK_RELOAD_FLAG = 'zenbat_chunk_reload_at'
const shouldReloadForChunkError = (msg) => {
  if (!msg) return false
  const s = String(msg)
  return /Failed to fetch dynamically imported module|is not a valid JavaScript MIME type|Loading chunk .* failed|Importing a module script failed/i.test(s)
}
const tryReloadOnce = () => {
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
window.addEventListener('error', (e) => {
  if (shouldReloadForChunkError(e?.message) || shouldReloadForChunkError(e?.error?.message)) {
    tryReloadOnce()
  }
})
window.addEventListener('unhandledrejection', (e) => {
  if (shouldReloadForChunkError(e?.reason?.message) || shouldReloadForChunkError(e?.reason)) {
    tryReloadOnce()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
