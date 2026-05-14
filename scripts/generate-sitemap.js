// Génération du sitemap.xml pour le SEO Zenbat.
// Exécuté automatiquement après `vite build` (voir package.json).
// Couvre : page d'accueil, pages publiques statiques, index villes, pages villes.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')
const PUBLIC    = join(ROOT, 'public')
const DIST      = join(ROOT, 'dist')

const SITE_URL = process.env.SITE_URL || 'https://zenbat.vercel.app'

// Import dynamique du fichier de données villes (ES module).
const villesModule = await import(join('file://', ROOT, 'src', 'data', 'villes.js'))
const { VILLES } = villesModule

const today = new Date().toISOString().slice(0, 10)

const STATIC_URLS = [
  { loc: '/',         changefreq: 'weekly',  priority: '1.0' },
  { loc: '/villes',   changefreq: 'monthly', priority: '0.8' },
  { loc: '/cgu',      changefreq: 'yearly',  priority: '0.3' },
  { loc: '/contact',  changefreq: 'yearly',  priority: '0.4' },
]

const villesUrls = VILLES.map(v => ({
  loc: `/villes/${v.slug}`,
  changefreq: 'monthly',
  priority: '0.7'
}))

const allUrls = [...STATIC_URLS, ...villesUrls]

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  allUrls.map(u =>
    `  <url>\n` +
    `    <loc>${SITE_URL}${u.loc}</loc>\n` +
    `    <lastmod>${today}</lastmod>\n` +
    `    <changefreq>${u.changefreq}</changefreq>\n` +
    `    <priority>${u.priority}</priority>\n` +
    `  </url>`
  ).join('\n') +
  `\n</urlset>\n`

if (!existsSync(PUBLIC)) mkdirSync(PUBLIC, { recursive: true })
const publicTarget = join(PUBLIC, 'sitemap.xml')
writeFileSync(publicTarget, xml, 'utf8')

const outputs = ['public/sitemap.xml']

// On écrit AUSSI dans dist/ si présent. Sans ça, le sitemap déployé par
// Vercel correspond à la version git de public/sitemap.xml (copiée par
// vite build) et pas à celle régénérée par ce script après le build.
if (existsSync(DIST)) {
  writeFileSync(join(DIST, 'sitemap.xml'), xml, 'utf8')
  outputs.push('dist/sitemap.xml')
}

console.log(`[sitemap] ${allUrls.length} URLs → ${outputs.join(' + ')}`)
