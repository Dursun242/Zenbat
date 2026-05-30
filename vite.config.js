import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { vitePrerenderPlugin } from 'vite-prerender-plugin'
import { VILLES } from './src/data/villes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-pdf':      ['pdf-lib', '@pdf-lib/fontkit', 'jspdf'],
          'vendor-motion':   ['framer-motion'],
        },
      },
    },
    // Filtre du modulepreload injecté dans index.html :
    // Vite preload par défaut TOUS les vendors, y compris les chunks lazy
    // (vendor-pdf 788 kB / 296 kB gzippé, vendor-motion 136 kB / 45 kB). Sur
    // mobile 4G ça mange 300+ kB de bande passante au boot pour des modules
    // qui ne servent qu'à l'aperçu PDF ou aux animations différées.
    // On garde le preload des vendors vraiment nécessaires au boot
    // (vendor-react, vendor-supabase via auth.jsx).
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter(d => !d.includes('vendor-pdf') && !d.includes('vendor-motion')),
    },
  },
  plugins: [
    react(),
    // Prérendu statique des pages SEO villes au build.
    // Génère dist/villes/index.html et dist/villes/<slug>/index.html avec
    // <title>, <meta description>, og: et canonical baked-in pour les crawlers.
    // À l'exécution navigateur, React reprend la main et remplace le contenu
    // (pas d'hydratation — createRoot, pas hydrateRoot).
    vitePrerenderPlugin({
      renderTarget: '#root',
      prerenderScript: path.join(__dirname, 'src/prerender.jsx'),
      additionalPrerenderRoutes: [
        '/villes',
        ...VILLES.map(v => `/villes/${v.slug}`),
      ],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Zenbat — Devis BTP',
        short_name: 'Zenbat',
        description: 'Créez vos devis BTP en quelques secondes avec l\'IA.',
        lang: 'fr',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // ttf inclus : les fonts DejaVuSans + Caveat sont chargées via
        // fetch() par pdfBuilder.js pour embarquement dans jsPDF. Sans ce
        // precache, sur iOS Safari avec 4G lent ou si le SW intercepte
        // mal, fetch peut renvoyer un timeout / HTML d'erreur → jsPDF
        // plante avec "metadata.Unicode.widths undefined" à la 1re
        // émission. Precaché = servi depuis le cache local, instantané.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,ttf}'],
        // Pas de fallback SPA pour : /api/, /sitemap.xml, /robots.txt,
        // /google*.html (vérification GSC). Sans ça, le Service Worker
        // intercepte ces requêtes et renvoie /index.html, ce qui casse
        // Googlebot et la navigation directe vers ces fichiers.
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/sitemap\.xml$/,
          /^\/robots\.txt$/,
          /^\/google[a-z0-9]+\.html$/,
        ],
        // skipWaiting + clientsClaim ACTIVÉS : le nouveau SW prend la main
        // immédiatement après installation, au lieu d'attendre la fermeture
        // de tous les onglets (qui n'arrive jamais sur PWA mobile installée
        // → l'utilisateur gardait l'ancien SW + ancien index.html pendant
        // des jours/semaines, ce qui provoquait les chunk errors
        // « Importing a module script failed » à chaque navigation vers un
        // lazy import dont le hash a changé).
        //
        // Le trade-off historique (reload mid-session = perte de saisie)
        // est désormais couvert par :
        //   - autosave localStorage du devis (src/lib/devisDraft.js)
        //   - auth résiliente avec refreshSession retry (auth.jsx)
        //   - ErrorBoundary qui affiche « Mise à jour de l'application… »
        //     au lieu de l'écran crash quand un chunk error survient
        //   - mode nuke en 2e essai (chunkReload.js)
        //
        // Conclusion : on accepte le micro-reload pour supprimer 60 %+
        // du bruit du panel d'erreurs et améliorer l'expérience perçue.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
