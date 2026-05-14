import { Helmet } from 'react-helmet-async'
import { getVille, getVillesProches } from '../data/villes.js'
import '../styles/villes.css'

const SITE_URL = 'https://zenbat.vercel.app'

// JSON-LD doit rester du JSON brut. Si on passait les données via {children}
// React HTML-encoderait les guillemets ("&quot;") au rendu SSR, ce que Google
// rejette. dangerouslySetInnerHTML est l'usage standard pour les script
// type="application/ld+json".
function jsonLd(data) {
  const str = JSON.stringify(data).replace(/</g, '\\u003c')
  return { __html: str }
}

function JsonLdScript({ data }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(data)} />
}

function buildFaq(ville) {
  const cpDisplay = ville.cp.replace('-', ' à ')
  return [
    {
      q: `Comment créer un devis à ${ville.nom} avec Zenbat ?`,
      a: `Vous décrivez votre prestation à l'oral ou par écrit, l'Agent IA Zenbat structure le devis (postes, quantités, TVA, conditions de paiement). Vous le relisez en quelques secondes, puis l'envoyez par lien à votre client à ${ville.nom} qui le signe en ligne avec un code OTP reçu par email.`
    },
    {
      q: `Zenbat est-il adapté aux artisans de ${ville.nom} et du ${ville.departement} ?`,
      a: `Oui. Zenbat couvre l'ensemble du territoire français et s'adresse en priorité aux TPE, auto-entrepreneurs et artisans, dont ceux installés à ${ville.nom} (codes postaux ${cpDisplay}) et en ${ville.region}. Les devis et factures émis respectent la réglementation française (TVA, mentions légales, Factur-X pour 2026).`
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
    },
    {
      q: `Puis-je utiliser Zenbat hors connexion sur les chantiers à ${ville.nom} ?`,
      a: `Zenbat est une PWA (Progressive Web App) : une fois installée sur votre téléphone, elle reste accessible même sans réseau pour consulter vos devis et clients. La synchronisation s'effectue dès le retour de connexion. Pratique sur les chantiers de ${ville.nom} où la 4G peut être capricieuse (sous-sols, parkings, immeubles anciens).`
    },
    {
      q: `Comment obtenir une signature électronique de mon client à ${ville.nom} ?`,
      a: `Vous envoyez le devis par lien à votre client. Il reçoit le lien par email ou SMS, ouvre le devis dans son navigateur, saisit son code postal pour validation, puis reçoit un code OTP à 8 chiffres par email. Il signe en quelques secondes — pas besoin de déplacement, pas d'impression. Le PDF signé est généré, envoyé aux deux parties et stocké dans Zenbat.`
    }
  ]
}

function buildHowToSteps(ville) {
  return [
    {
      name: `Décrivez la prestation à réaliser à ${ville.nom}`,
      text: `Dictez ou tapez ce que vous allez faire (ex. « Rénovation salle de bain 8 m² à ${ville.nom}, dépose carrelage, plomberie, faïence murale, peinture »).`
    },
    {
      name: "L'Agent IA structure le devis",
      text: "Zenbat extrait les postes, calcule les quantités, applique la TVA et propose des conditions de paiement adaptées à votre métier."
    },
    {
      name: 'Vous relisez et ajustez',
      text: 'Modifiez les prix, ajoutez ou supprimez des lignes, choisissez le délai de paiement. Toutes les modifications sont enregistrées en temps réel.'
    },
    {
      name: 'Envoi par lien au client',
      text: `Cliquez sur "Envoyer" et votre client à ${ville.nom} reçoit un lien sécurisé par email. Il peut consulter le devis, négocier, et signer en ligne via un code OTP.`
    },
    {
      name: 'Facturation immédiate après signature',
      text: `Une fois le devis signé, vous générez la facture en un clic. Conforme Factur-X 2026, exportable en PDF/A-3 + XML CII.`
    }
  ]
}

function FaqJsonLd({ faq }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a }
    }))
  }
  return <JsonLdScript data={data} />
}

function HowToJsonLd({ ville, steps }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `Créer et envoyer un devis depuis ${ville.nom} avec Zenbat`,
    description: `Procédure pas-à-pas pour créer un devis professionnel à ${ville.nom}, le faire signer en ligne et facturer en Factur-X.`,
    totalTime: 'PT5M',
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text
    }))
  }
  return <JsonLdScript data={data} />
}

function BreadcrumbJsonLd({ ville }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Villes', item: `${SITE_URL}/villes` },
      { '@type': 'ListItem', position: 3, name: ville.nom, item: `${SITE_URL}/villes/${ville.slug}` },
    ]
  }
  return <JsonLdScript data={data} />
}

// SoftwareApplication : périmètre NATIONAL (areaServed = France).
// On ne déclare PAS d'établissement par ville pour éviter le signal "local
// SEO spam" : Zenbat est un SaaS, pas un commerce avec une agence dans
// chaque ville. Le seul vrai établissement est à Le Havre (cf footer
// "Édité par ID Maîtrise · Le Havre, France") — ce dernier est déclaré
// séparément via LocalBusinessLeHavreJsonLd, uniquement sur la page Le Havre.
function SoftwareAppJsonLd({ ville }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Zenbat',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Devis et facturation',
    operatingSystem: 'Web, iOS, Android (PWA)',
    description: "Solution nationale de devis et facturation pour artisans, TPE et indépendants en France. Création de devis assistée par IA, signature électronique par OTP, factures Factur-X conformes 2026.",
    url: `${SITE_URL}/villes/${ville.slug}`,
    inLanguage: 'fr-FR',
    offers: [
      {
        '@type': 'Offer',
        name: 'Gratuit',
        price: '0',
        priceCurrency: 'EUR',
        description: 'Plan Gratuit à vie : devis, factures, Agent IA, signature OTP.'
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '19',
        priceCurrency: 'EUR',
        description: 'Plan Pro 19 €/mois sans engagement : Factur-X, signature électronique, stats détaillées.',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '19',
          priceCurrency: 'EUR',
          unitText: 'MON'
        }
      }
    ],
    areaServed: {
      '@type': 'Country',
      name: 'France'
    }
  }
  return <JsonLdScript data={data} />
}

// LocalBusiness : UNIQUEMENT sur la page Le Havre (vrai siège social).
// Reproduit l'information du footer ("Édité par ID Maîtrise · Le Havre").
function LocalBusinessLeHavreJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Zenbat',
    legalName: 'ID Maîtrise',
    url: SITE_URL,
    description: "Éditeur de Zenbat, logiciel de devis et facturation pour artisans français.",
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Le Havre',
      postalCode: '76600',
      addressRegion: 'Normandie',
      addressCountry: 'FR'
    },
    areaServed: {
      '@type': 'Country',
      name: 'France'
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 49.4944,
      longitude: 0.1079
    }
  }
  return <JsonLdScript data={data} />
}

function ServiceJsonLd({ ville }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Logiciel de devis et facturation pour artisans',
    name: 'Zenbat — devis et facturation',
    provider: {
      '@type': 'Organization',
      name: 'Zenbat',
      url: SITE_URL,
      sameAs: ['https://zenbat.vercel.app']
    },
    areaServed: {
      '@type': 'Country',
      name: 'France'
    },
    audience: {
      '@type': 'BusinessAudience',
      audienceType: 'Artisans, TPE, auto-entrepreneurs, indépendants'
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Fonctionnalités Zenbat',
      itemListElement: [
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Création de devis assistée par IA' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Signature électronique par OTP' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Facturation Factur-X PDF/A-3' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Suivi clients et relances' } },
      ]
    }
  }
  return <JsonLdScript data={data} />
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
  const steps = buildHowToSteps(ville)
  const villesProches = getVillesProches(ville)
  const title = `Devis et facturation pour artisans à ${ville.nom} (${ville.departement}) — Zenbat`
  const description = `Logiciel de devis et facturation pour artisans à ${ville.nom}. Création de devis avec IA, signature électronique, factures Factur-X 2026. Plan gratuit à vie, sans engagement.`
  const canonical = `${SITE_URL}/villes/${ville.slug}`
  const cpDisplay = ville.cp.replace('-', ' à ')

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
        <meta name="geo.region" content={`FR-${ville.departement}`} />
        <meta name="geo.placename" content={ville.nom} />
        {ville.lat && ville.lon && (
          <meta name="geo.position" content={`${ville.lat};${ville.lon}`} />
        )}
        {ville.lat && ville.lon && (
          <meta name="ICBM" content={`${ville.lat}, ${ville.lon}`} />
        )}
      </Helmet>
      <FaqJsonLd faq={faq} />
      <HowToJsonLd ville={ville} steps={steps} />
      <BreadcrumbJsonLd ville={ville} />
      <SoftwareAppJsonLd ville={ville} />
      <ServiceJsonLd ville={ville} />
      {/* LocalBusiness : uniquement sur Le Havre (siège réel) — éviter
          le signal "local SEO spam" sur les autres villes. */}
      {ville.slug === 'le-havre' && <LocalBusinessLeHavreJsonLd />}

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
          <a href="/villes">Villes</a>
          <span className="vp-breadcrumb-sep">›</span>
          <span>{ville.nom}</span>
        </nav>

        <span className="vp-eyebrow">{ville.region} · {ville.departement} · {cpDisplay}</span>
        <h1 className="vp-h1">
          Devis et facturation pour artisans à <span className="vp-h1-accent">{ville.nom}</span>
        </h1>
        <p className="vp-lead">{ville.intro}</p>

        <section className="vp-section" id="contexte">
          <h2>Pourquoi un logiciel de devis à {ville.nom} ?</h2>
          <p>{ville.contexte}</p>
          <p>
            Zenbat est conçu pour les TPE et indépendants : pas de formation, pas de paramétrage complexe.
            Vous dictez vos devis, l'IA les structure, vous les envoyez en quelques clics. Le client signe
            en ligne, vous facturez dans la foulée. Tout reste accessible depuis un téléphone, même sur
            un chantier à {ville.nom}.
          </p>
        </section>

        <section className="vp-section" id="metiers">
          <h2>Métiers d'artisans actifs à {ville.nom}</h2>
          <p style={{ marginBottom: 16 }}>
            Zenbat est utilisé par plus de 80 métiers — voici les plus représentés à {ville.nom} :
          </p>
          <div className="vp-card-grid">
            {ville.metiers.map(m => (
              <div key={m} className="vp-card">{m}</div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--vp-muted)' }}>
            Couverture complète : BTP, artisanat alimentaire, beauté, santé, tech, mode, auto-moto, services.
          </p>
        </section>

        <section className="vp-section" id="comment-ca-marche">
          <h2>Comment créer un devis à {ville.nom} en 5 étapes ?</h2>
          <ol className="vp-steps">
            {steps.map((s, i) => (
              <li key={i}>
                <span className="vp-step-num">{i + 1}</span>
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {ville.quartiers?.length > 0 && (
          <section className="vp-section" id="quartiers">
            <h2>Quartiers et secteurs desservis à {ville.nom}</h2>
            <p style={{ marginBottom: 16 }}>
              Zenbat fonctionne partout — pas de zone d'intervention à configurer.
              Les artisans interviennent depuis Zenbat sur l'ensemble des quartiers de {ville.nom} :
            </p>
            <div className="vp-tags">
              {ville.quartiers.map(q => (
                <span key={q} className="vp-tag">{q}</span>
              ))}
            </div>
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--vp-muted)' }}>
              Codes postaux couverts : {cpDisplay}.
            </p>
          </section>
        )}

        <section className="vp-section" id="aides">
          <h2>Aides à la rénovation pour les chantiers à {ville.nom}</h2>
          <p>{ville.aide}</p>
          <p>
            Mentionner les aides éligibles directement dans le devis (montant estimatif, conditions
            d'éligibilité, démarches) raccourcit le cycle de décision : votre client à {ville.nom} voit
            tout de suite le coût net après aides. Zenbat permet d'ajouter ces informations dans la
            section « Conditions particulières » du devis.
          </p>
        </section>

        <section className="vp-section" id="tarifs">
          <h2>Comment bien chiffrer un devis à {ville.nom} ?</h2>
          <p>
            Les tarifs d'artisans varient fortement entre régions et selon les contraintes locales :
            difficulté d'accès, copropriété, normes patrimoniales, climat. À {ville.nom}, prenez le
            temps d'expliquer chaque poste dans le devis — c'est ce qui distingue un devis professionnel
            d'un devis approximatif que le client compare uniquement au prix.
          </p>
          <p>
            Avec Zenbat, vous pouvez sauvegarder vos prix unitaires (déplacement, m² posé, heure de main
            d'œuvre, fournitures) et les réutiliser à chaque devis : moins d'oublis, plus de cohérence,
            et un suivi de votre marge dans le dashboard.
          </p>
        </section>

        <section className="vp-section" id="faq">
          <h2>Questions fréquentes des artisans de {ville.nom}</h2>
          <div className="vp-faq">
            {faq.map((item, i) => (
              <details key={i}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {villesProches.length > 0 && (
          <section className="vp-section" id="villes-proches">
            <h2>Zenbat dans les villes proches de {ville.nom}</h2>
            <p style={{ marginBottom: 16 }}>
              Vous intervenez aussi dans les communes voisines ? Découvrez nos pages dédiées :
            </p>
            <div className="vp-ville-grid">
              {villesProches.map(v => (
                <a key={v.slug} href={`/villes/${v.slug}`} className="vp-ville-link">
                  <span style={{ fontWeight: 600 }}>{v.nom}</span>
                  <span>{v.departement}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="vp-cta-block">
          <h3>Prêt à tester Zenbat à {ville.nom} ?</h3>
          <p>Plan gratuit à vie, sans carte bancaire, sans engagement.</p>
          <a href="/">Démarrer maintenant</a>
        </div>

        <nav aria-label="Retour à la liste" className="vp-breadcrumb" style={{ marginTop: 40 }}>
          <a href="/villes">← Toutes les villes</a>
        </nav>
      </main>
    </div>
  )
}
