// Script de prérendu pour vite-prerender-plugin.
// Génère le HTML statique des pages SEO /villes et /villes/:slug au build.
// N'est jamais exécuté côté navigateur — uniquement par le plugin en SSR.
import { renderToString } from 'react-dom/server'
import { HelmetProvider } from 'react-helmet-async'
import VillesIndex from './pages/VillesIndex.jsx'
import VillePage from './pages/VillePage.jsx'
import { VILLES, ALL_SLUGS, getVille } from './data/villes.js'

const SITE_URL = 'https://zenbat.vercel.app'

function metaForUrl(url) {
  if (url === '/') {
    return {
      title: "Zenbat — L'assistant commercial vocal des TPE",
      description: "Zenbat — Dictez vos devis, encaissez vos factures. L'assistant commercial vocal pour artisans, consultants et freelances.",
      canonical: `${SITE_URL}/`,
    }
  }
  if (url === '/villes' || url === '/villes/') {
    return {
      title: 'Zenbat dans votre ville — devis et facturation pour artisans en France',
      description: `Zenbat accompagne les artisans, TPE et indépendants dans ${VILLES.length} villes françaises. Trouvez votre bassin et découvrez comment dicter vos devis et facturer en Factur-X.`,
      canonical: `${SITE_URL}/villes`,
    }
  }
  if (url.startsWith('/villes/')) {
    const slug = url.slice('/villes/'.length).replace(/\/$/, '')
    const ville = getVille(slug)
    if (!ville) return null
    return {
      title: `Devis et facturation pour artisans à ${ville.nom} (${ville.departement}) — Zenbat`,
      description: `Logiciel de devis et facturation pour artisans à ${ville.nom}. Création de devis avec IA, signature électronique, factures Factur-X 2026. Plan gratuit à vie, sans engagement.`,
      canonical: `${SITE_URL}/villes/${ville.slug}`,
      ville,
    }
  }
  return null
}

export async function prerender({ url }) {
  const meta = metaForUrl(url)
  if (!meta) return { html: '' }

  let element = null
  if (url === '/villes' || url === '/villes/') {
    element = <VillesIndex />
  } else if (url.startsWith('/villes/')) {
    const slug = url.slice('/villes/'.length).replace(/\/$/, '')
    element = <VillePage slug={slug} />
  }
  // url === '/' : on garde l'app shell vide, on injecte juste les meta SEO.

  const helmetContext = {}
  let html = ''
  if (element) {
    try {
      html = renderToString(
        <HelmetProvider context={helmetContext}>{element}</HelmetProvider>
      )
    } catch (err) {
      console.warn(`[prerender] ${url}: ${err.message}`)
    }
  }

  // Lien de découverte : depuis /villes, on demande au plugin de découvrir
  // toutes les pages villes (au cas où parseLinks ne les détecterait pas).
  const links =
    url === '/villes' || url === '/villes/'
      ? new Set(ALL_SLUGS.map(s => `/villes/${s}`))
      : new Set()

  const elements = new Set([
    { type: 'meta', props: { name: 'description', content: meta.description } },
    { type: 'link', props: { rel: 'canonical', href: meta.canonical } },
    { type: 'link', props: { rel: 'alternate', hrefLang: 'fr-FR', href: meta.canonical } },
    { type: 'meta', props: { property: 'og:title', content: meta.title } },
    { type: 'meta', props: { property: 'og:description', content: meta.description } },
    { type: 'meta', props: { property: 'og:url', content: meta.canonical } },
    { type: 'meta', props: { property: 'og:type', content: 'website' } },
    { type: 'meta', props: { property: 'og:locale', content: 'fr_FR' } },
    { type: 'meta', props: { property: 'og:site_name', content: 'Zenbat' } },
    { type: 'meta', props: { name: 'twitter:card', content: 'summary_large_image' } },
    { type: 'meta', props: { name: 'twitter:title', content: meta.title } },
    { type: 'meta', props: { name: 'twitter:description', content: meta.description } },
  ])

  // Meta géolocalisation pour les pages ville (utile pour SEO local).
  if (meta.ville) {
    elements.add({ type: 'meta', props: { name: 'geo.region', content: `FR-${meta.ville.departement}` } })
    elements.add({ type: 'meta', props: { name: 'geo.placename', content: meta.ville.nom } })
    if (meta.ville.lat && meta.ville.lon) {
      elements.add({ type: 'meta', props: { name: 'geo.position', content: `${meta.ville.lat};${meta.ville.lon}` } })
      elements.add({ type: 'meta', props: { name: 'ICBM', content: `${meta.ville.lat}, ${meta.ville.lon}` } })
    }
  }

  return {
    html,
    links,
    head: {
      lang: 'fr',
      title: meta.title,
      elements,
    },
  }
}
