import { Helmet } from 'react-helmet-async'
import { getVille } from '../data/villes.js'
import '../styles/villes.css'

const SITE_URL = 'https://zenbat.vercel.app'

function buildFaq(ville) {
  return [
    {
      q: `Comment créer un devis à ${ville.nom} avec Zenbat ?`,
      a: `Vous décrivez votre prestation à l'oral ou par écrit, l'Agent IA Zenbat structure le devis (postes, quantités, TVA, conditions de paiement). Vous le relisez en quelques secondes, puis l'envoyez par lien à votre client à ${ville.nom} qui le signe en ligne avec un code OTP reçu par email.`
    },
    {
      q: `Zenbat est-il adapté aux artisans de ${ville.nom} et du ${ville.departement} ?`,
      a: `Oui. Zenbat couvre l'ensemble du territoire français et s'adresse en priorité aux TPE, auto-entrepreneurs et artisans, dont ceux installés à ${ville.nom} et en ${ville.region}. Les devis et factures émis respectent la réglementation française (TVA, mentions légales, Factur-X pour 2026).`
    },
    {
      q: `Quels métiers du bâtiment sont les plus actifs à ${ville.nom} ?`,
      a: `Sur ${ville.nom}, les métiers les plus sollicités côté Zenbat sont notamment : ${ville.metiers.slice(0, 5).join(', ')}. La plateforme couvre plus de 80 métiers (BTP, artisanat, services, tech) — voir la liste dans l'application.`
    },
    {
      q: `Combien coûte Zenbat pour un artisan à ${ville.nom} ?`,
      a: `Zenbat propose un plan Gratuit à vie, sans carte bancaire, qui couvre les besoins essentiels (devis, factures, Agent IA). Le plan Pro est facturé 19 € TTC/mois, sans engagement, et débloque la signature électronique, l'export Factur-X et les statistiques détaillées.`
    },
    {
      q: `Mes factures émises à ${ville.nom} sont-elles conformes Factur-X 2026 ?`,
      a: `Oui. Zenbat génère des factures PDF/A-3 avec XML Factur-X embarqué, conformes à l'obligation de facturation électronique entre entreprises qui s'applique en France. Aucune configuration n'est nécessaire — c'est intégré au plan Pro.`
    }
  ]
}

// JSON-LD doit rester du JSON brut. Si on passait les données via {children}
// React HTML-encoderait les guillemets ("&quot;") au rendu SSR, ce que Google
// rejette. dangerouslySetInnerHTML est l'usage standard pour les script
// type="application/ld+json".
function jsonLd(data) {
  // Échappement minimal pour empêcher tout </script> dans une valeur de fermer
  // le tag prématurément.
  const str = JSON.stringify(data).replace(/</g, '\\u003c')
  return { __html: str }
}

function FaqJsonLd({ ville, faq }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a }
    }))
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(data)} />
}

function LocalBusinessJsonLd({ ville }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `Zenbat à ${ville.nom}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: `Solution de devis et facturation pour artisans à ${ville.nom} (${ville.region}). Création de devis assistée par IA, signature électronique, factures Factur-X.`,
    url: `${SITE_URL}/villes/${ville.slug}`,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      description: 'Plan Gratuit à vie. Plan Pro à 19 € TTC/mois.'
    },
    areaServed: {
      '@type': 'City',
      name: ville.nom,
      addressRegion: ville.region,
      addressCountry: 'FR'
    }
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(data)} />
}

export default function VillePage({ slug }) {
  const ville = getVille(slug)

  if (!ville) {
    if (typeof window !== 'undefined') {
      window.location.replace('/villes')
    }
    return null
  }

  const faq = buildFaq(ville)
  const title = `Devis et facturation pour artisans à ${ville.nom} — Zenbat`
  const description = `Zenbat aide les artisans, TPE et indépendants de ${ville.nom} (${ville.departement}) à créer leurs devis avec l'IA, signer en ligne et facturer en Factur-X. Plan gratuit à vie.`
  const canonical = `${SITE_URL}/villes/${ville.slug}`

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
      <FaqJsonLd ville={ville} faq={faq} />
      <LocalBusinessJsonLd ville={ville} />

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
          <a href="/villes">Villes</a>
          <span className="vp-breadcrumb-sep">›</span>
          <span>{ville.nom}</span>
        </div>

        <span className="vp-eyebrow">{ville.region} · {ville.departement}</span>
        <h1 className="vp-h1">
          Devis et facturation pour artisans à <span className="vp-h1-accent">{ville.nom}</span>
        </h1>
        <p className="vp-lead">{ville.intro}</p>

        <section className="vp-section">
          <h2>Pourquoi Zenbat à {ville.nom} ?</h2>
          <p>{ville.contexte}</p>
          <p>
            Zenbat est conçu pour les TPE et indépendants : pas de formation, pas de paramétrage complexe.
            Vous dictez vos devis, l'IA les structure, vous les envoyez en quelques clics. Le client signe
            en ligne, vous facturez dans la foulée. Tout reste accessible depuis un téléphone, même sur un chantier.
          </p>
        </section>

        <section className="vp-section">
          <h2>Métiers les plus actifs à {ville.nom}</h2>
          <div className="vp-card-grid">
            {ville.metiers.map(m => (
              <div key={m} className="vp-card">{m}</div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--vp-muted)' }}>
            Zenbat couvre plus de 80 métiers : artisanat, BTP, services, tech, santé, beauté.
          </p>
        </section>

        <section className="vp-section">
          <h2>Comment ça marche ?</h2>
          <p>
            <strong>1. Vous décrivez le chantier</strong> à l'oral ou par écrit (ex. « Rénovation salle de bain
            8 m² à {ville.nom}, dépose carrelage, plomberie, faïence murale, peinture »).
          </p>
          <p>
            <strong>2. L'Agent IA Zenbat structure le devis</strong> avec les postes, quantités, prix unitaires,
            TVA appliquée et conditions de paiement. Vous relisez et ajustez si besoin.
          </p>
          <p>
            <strong>3. Vous envoyez le devis par lien</strong> à votre client. Il le signe en ligne avec un code OTP
            reçu par email. Vous êtes notifié, et la facture peut suivre immédiatement.
          </p>
        </section>

        <section className="vp-section">
          <h2>Questions fréquentes à {ville.nom}</h2>
          <div className="vp-faq">
            {faq.map((item, i) => (
              <details key={i}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="vp-cta-block">
          <h3>Prêt à tester Zenbat à {ville.nom} ?</h3>
          <p>Plan gratuit à vie, sans carte bancaire, sans engagement.</p>
          <a href="/">Démarrer maintenant</a>
        </div>

        <div className="vp-breadcrumb" style={{ marginTop: 40 }}>
          <a href="/villes">← Toutes les villes</a>
        </div>
      </main>
    </div>
  )
}
