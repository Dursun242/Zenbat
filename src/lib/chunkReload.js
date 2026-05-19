// Récupération auto après un redéploiement quand le shell PWA en cache
// référence des chunks qui n'existent plus (hashes Vite changés).
//
// Pourquoi un module dédié plutôt que la logique inline dans main.jsx :
// les erreurs de `lazy(() => import(...))` sont rattrapées par React
// (Suspense → ErrorBoundary) et n'atteignent JAMAIS window.unhandledrejection.
// Sans cet helper appelé aussi depuis ErrorBoundary, l'utilisateur reste
// bloqué sur la fallback UI après chaque déploiement.

const CHUNK_RELOAD_FLAG = "zenbat_chunk_reload_at";
const WINDOW_MS = 30_000;

// Wording varie selon le navigateur :
// - Chrome :  "Failed to fetch dynamically imported module" / "Loading chunk N failed"
// - Safari :  "Importing a module script failed"
// - SW qui sert /index.html sur une URL JS : "'text/html' is not a valid JavaScript MIME type"
const PATTERN =
  /Failed to fetch dynamically imported module|is not a valid JavaScript MIME type|Loading chunk .* failed|Importing a module script failed/i;

export function isChunkLoadError(input) {
  if (!input) return false;
  const message =
    typeof input === "string"
      ? input
      : input.message || (input.reason && input.reason.message) || String(input);
  return PATTERN.test(message);
}

// Renvoie true si la récupération est armée (reload en cours), false si on a
// déjà essayé il y a moins de 30s (anti-boucle infinie en cas de cache cassé).
export function recoverFromChunkError() {
  try {
    const last = Number(localStorage.getItem(CHUNK_RELOAD_FLAG) || 0);
    if (Date.now() - last < WINDOW_MS) return false;
    localStorage.setItem(CHUNK_RELOAD_FLAG, String(Date.now()));
  } catch {
    // localStorage indisponible (Safari privé) : on tente le reload une fois,
    // sans anti-boucle. Mieux que rester bloqué.
  }

  // Safety net : si le nettoyage hang, on reload quand même au bout de 1.5s.
  const fallbackTimer = setTimeout(() => {
    try { window.location.reload(); } catch {}
  }, 1500);

  (async () => {
    // 1) Vide tous les caches Workbox (précache stale + runtime).
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}
    // 2) Désinscrit le(s) service worker(s) — la prochaine navigation
    //    ira directement au réseau et récupérera la dernière index.html.
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
      }
    } catch {}
    clearTimeout(fallbackTimer);
    try { window.location.reload(); } catch {}
  })();

  return true;
}
