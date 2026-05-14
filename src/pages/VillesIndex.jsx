import { Helmet } from 'react-helmet-async'
import { VILLES, getVillesByRegion } from '../data/villes.js'
import '../styles/villes.css'

const SITE_URL = 'https://zenbat.vercel.app'

function ItemListJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Zenbat — villes desservies en France',
    numberOfItems: VILLES.length,
    itemListElement: VILLES.map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/villes/${v.slug}`,
      name: v.nom
    }))
  }
  const str = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: str }} />
}

export default function VillesIndex() {
  const byRegion = getVillesByRegion()
  const title = "Zenbat dans votre ville — devis et facturation pour artisans en France"
  const description = `Zenbat accompagne les artisans, TPE et indépendants dans ${VILLES.length} villes françaises. Trouvez votre bassin et découvrez comment dicter vos devis et facturer en Factur-X.`
  const canonical = `${SITE_URL}/villes`

  return (
    <div className="vp-root">
      <Helmet>
        <html lang="fr" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:site_name" content="Zenbat" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Helmet>
      <ItemListJsonLd />

      <nav className="vp-nav" aria-label="Navigation principale">
        <div className="vp-nav-inner">
          <a href="/" className="vp-logo" aria-label="Zenbat — accueil">
            <span className="vp-logo-terra">Zen</span>
            <span className="vp-logo-ink">bat</span>
          </a>
          <a href="/" className="vp-nav-cta">Tester gratuitement</a>
        </div>
      </nav>

      <main className="vp-container">
        <div className="vp-breadcrumb">
          <a href="/">Accueil</a>
          <span className="vp-breadcrumb-sep">›</span>
          <span>Villes</span>
        </div>

        <span className="vp-eyebrow">Présence locale</span>
        <h1 className="vp-h1">
          Zenbat dans <span className="vp-h1-accent">votre ville</span>
        </h1>
        <p className="vp-lead">
          Zenbat accompagne les artisans, TPE et indépendants partout en France.
          Sélectionnez votre ville pour découvrir comment notre solution répond aux contraintes locales :
          types de chantiers, métiers actifs, exigences réglementaires.
        </p>

        {byRegion.map(([region, villes]) => (
          <section key={region} className="vp-region-block">
            <h2>{region}</h2>
            <div className="vp-ville-grid">
              {villes.map(v => (
                <a key={v.slug} href={`/villes/${v.slug}`} className="vp-ville-link">
                  <span style={{ fontWeight: 600 }}>{v.nom}</span>
                  <span>{v.departement}</span>
                </a>
              ))}
            </div>
          </section>
        ))}

        <div className="vp-cta-block">
          <h3>Votre ville n'est pas listée ?</h3>
          <p>Zenbat fonctionne partout en France. Créez votre compte et commencez gratuitement.</p>
          <a href="/">Démarrer gratuitement</a>
        </div>
      </main>
    </div>
  )
}
