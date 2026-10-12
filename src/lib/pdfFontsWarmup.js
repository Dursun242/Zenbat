// Met en cache les polices du PDF (DejaVu, Caveat) au démarrage de
// l'application, quand le navigateur est libre.
//
// Elles ne sont plus dans le précache du Service Worker (qui est téléchargé
// aussi par les visiteurs de la vitrine) : la règle runtime CacheFirst
// « zenbat-pdf-fonts » de vite.config.js les garde après le premier fetch.
// Ce préchauffage donne aux artisans la même garantie qu'avant : la première
// génération de PDF (aperçu, émission, y compris hors ligne) lit les polices
// depuis le cache local au lieu d'attendre ~1,7 Mo sur le réseau mobile.
//
// Premier lancement : on attend que le Service Worker prenne la main
// (clientsClaim, une fois son installation finie). Sans Service Worker, on
// ne fait rien : le cache HTTP ne garderait pas ces fichiers.

export const PDF_FONT_URLS = [
  '/fonts/DejaVuSans.ttf',
  '/fonts/DejaVuSans-Bold.ttf',
  '/fonts/Caveat-Regular.ttf',
]
export const PDF_FONTS_CACHE = 'zenbat-pdf-fonts'

export async function warmPdfFonts() {
  try {
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null
    if (!sw || typeof caches === 'undefined') return
    if (!sw.controller) {
      await new Promise(resolve => {
        sw.addEventListener('controllerchange', resolve, { once: true })
        setTimeout(resolve, 60_000)
      })
      if (!sw.controller) return
    }
    if (navigator.onLine === false) return
    const cache = await caches.open(PDF_FONTS_CACHE)
    for (const url of PDF_FONT_URLS) {
      if (await cache.match(url)) continue
      // Le SW met la réponse en cache (CacheFirst) ; on lit le corps pour
      // que le téléchargement aille à son terme.
      const r = await fetch(url)
      if (r.ok) await r.arrayBuffer()
    }
  } catch { /* best-effort : pdfBuilder refera le fetch au besoin */ }
}

export function scheduleWarmPdfFonts() {
  if (typeof window === 'undefined') return () => {}
  if (window.requestIdleCallback) {
    const id = window.requestIdleCallback(() => { warmPdfFonts() }, { timeout: 10_000 })
    return () => window.cancelIdleCallback?.(id)
  }
  const t = setTimeout(() => { warmPdfFonts() }, 3000)
  return () => clearTimeout(t)
}
