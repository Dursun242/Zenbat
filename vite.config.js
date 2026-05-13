import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
  },
  plugins: [
    react(),
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        // ⚠ skipWaiting + clientsClaim désactivés volontairement.
        // Avec ces deux flags + registerType:'autoUpdate', vite-plugin-pwa
        // déclenche un window.location.reload() mid-session dès qu'un
        // nouveau SW est déployé — l'utilisateur perd ce qu'il tape.
        // Sans eux, le nouveau SW reste en "waiting" et s'active naturellement
        // au prochain démarrage de l'app (fermeture/réouverture du PWA ou
        // refresh manuel). La MAJ est appliquée silencieusement, jamais
        // pendant qu'on est en train d'utiliser l'app.
        // clientsClaim: true,
        // skipWaiting: true,
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
