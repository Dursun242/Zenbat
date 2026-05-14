import { Helmet } from 'react-helmet-async'
import { VILLES, REGIONS_ORDER, getVillesByRegion } from '../data/villes.js'
import '../styles/villes.css'

const SITE_URL = 'https://zenbat.vercel.app'

function jsonLd(data) {
  const str = JSON.stringify(data).replace(/</g, '\\u003c')
  return { __html: str }
}

function JsonLdScript({ data }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(data)} />
}

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
  return <JsonLdScript data={data} />
}

function CollectionPageJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Zenbat dans votre ville',
    description: `Pages locales Zenbat pour ${VILLES.length} villes françaises réparties dans ${REGIONS_ORDER.length} régions.`,
    url: `${SITE_URL}/villes`,
    inLanguage: 'fr-FR',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Zenbat',
      url: SITE_URL
    }
  }
  return <JsonLdScript data={data} />
}

function BreadcrumbJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Villes', item: `${SITE_URL}/villes` },
    ]
  }
  return <JsonLdScript data={data} />
}

export default function VillesIndex() {
  const byRegion = getVillesByRegion()
  const regionCount = byRegion.length
  const title = "Zenbat dans votre ville — devis et facturation pour artisans en France"
  const description = `Zenbat accompagne les artisans, TPE et indépendants dans ${VILLES.length} villes françaises réparties sur ${regionCount} régions. Devis assistés par IA, signature électronique, factures Factur-X 2026.`
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
      <CollectionPageJsonLd />
      <BreadcrumbJsonLd />

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
        <nav aria-label="Fil d'Ariane" className="vp-breadcrumb">
          <a href="/">Accueil</a>
          <span className="vp-breadcrumb-sep">›</span>
          <span>Villes</span>
        </nav>

        <span className="vp-eyebrow">Présence locale · {VILLES.length} villes · {regionCount} régions</span>
        <h1 className="vp-h1">
          Zenbat dans <span className="vp-h1-accent">votre ville</span>
        </h1>
        <p className="vp-lead">
          Zenbat accompagne les artisans, TPE et indépendants partout en France métropolitaine et
          outre-mer. Sélectionnez votre ville pour découvrir comment notre solution répond aux
          contraintes locales : types de chantiers, métiers actifs, aides régionales mobilisables,
          quartiers desservis.
        </p>

        <section className="vp-section" id="introduction">
          <h2>Un logiciel de devis et facturation pensé pour les artisans français</h2>
          <p>
            Zenbat est conçu pour les TPE, auto-entrepreneurs et indépendants — pas pour les grands
            comptes. Que vous interveniez à Paris, Lyon, Marseille, Le Havre ou Fort-de-France, vous
            disposez d'un outil unique pour <strong>créer vos devis avec un Agent IA</strong>, les
            <strong> faire signer en ligne</strong> par vos clients (via code OTP 8 chiffres), puis
            <strong> émettre des factures conformes Factur-X 2026</strong> en un clic.
          </p>
          <p>
            Pas de paramétrage long, pas de comptable à appeler à chaque facture : la plateforme
            applique les bonnes règles de TVA, les mentions légales obligatoires et le formalisme
            attendu par l'administration française.
          </p>
        </section>

        <section className="vp-section" id="villes-par-region">
          <h2>Toutes les villes desservies, par région</h2>
          {byRegion.map(([region, villes]) => (
            <div key={region} className="vp-region-block">
              <h3>{region} <span style={{ fontSize: 13, color: 'var(--vp-muted)', fontWeight: 400 }}>· {villes.length} {villes.length > 1 ? 'villes' : 'ville'}</span></h3>
              <div className="vp-ville-grid">
                {villes.map(v => (
                  <a key={v.slug} href={`/villes/${v.slug}`} className="vp-ville-link" title={`Zenbat à ${v.nom} (${v.departement})`}>
                    <span style={{ fontWeight: 600 }}>{v.nom}</span>
                    <span>{v.departement}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="vp-section" id="faq-index">
          <h2>Questions fréquentes sur Zenbat</h2>
          <div className="vp-faq">
            <details>
              <summary>Ma ville n'apparaît pas dans la liste — puis-je quand même utiliser Zenbat ?</summary>
              <p>
                Oui, absolument. Zenbat fonctionne partout en France et dans les départements d'outre-mer.
                Les pages dédiées ci-dessus servent uniquement à présenter les contraintes locales spécifiques.
                Que vous soyez à Limoges, Avignon, Mulhouse ou ailleurs, vous bénéficiez exactement des mêmes
                fonctionnalités : Agent IA, signature électronique, Factur-X.
              </p>
            </details>
            <details>
              <summary>Combien coûte Zenbat ?</summary>
              <p>
                Le plan Gratuit (à vie, sans carte bancaire) couvre les besoins essentiels : devis, factures,
                Agent IA, signature OTP. Le plan Pro à 19 €/mois sans engagement ajoute l'export Factur-X
                PDF/A-3, la signature électronique avancée et les statistiques détaillées.
              </p>
            </details>
            <details>
              <summary>Mes données sont-elles hébergées en France ?</summary>
              <p>
                Oui. Zenbat utilise Supabase (région UE-Ouest, hébergement Amazon Web Services Frankfurt et
                Paris). Aucune donnée n'est transférée hors UE. Vous pouvez à tout moment exporter ou
                supprimer vos données depuis votre profil (conformité RGPD).
              </p>
            </details>
            <details>
              <summary>Zenbat est-il conforme à l'obligation Factur-X 2026 ?</summary>
              <p>
                Oui. Toutes les factures émises avec le plan Pro sont au format PDF/A-3 avec XML CII
                embarqué, conforme à la norme Factur-X (BASIC, EN16931) imposée par l'État français pour
                la facturation entre entreprises.
              </p>
            </details>
          </div>
        </section>

        <div className="vp-cta-block">
          <h3>Votre ville n'est pas listée ?</h3>
          <p>Zenbat fonctionne partout en France. Créez votre compte et commencez gratuitement.</p>
          <a href="/">Démarrer gratuitement</a>
        </div>
      </main>
    </div>
  )
}
