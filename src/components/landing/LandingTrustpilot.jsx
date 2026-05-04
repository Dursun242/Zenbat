import { useEffect, useRef } from 'react'

const C = {
  terra:      '#C97B5C',
  cream:      '#FAF7F2',
  ink:        '#1A1612',
  muted:      '#6B6358',
  border:     '#E8E2D8',
}

// Configuration via variables d'env Vercel.
// VITE_TRUSTPILOT_BUSINESS_UNIT_ID : identifiant TrustBox (Business Unit ID)
//   trouvable dans Trustpilot Business → Integrations → TrustBox.
// VITE_TRUSTPILOT_REVIEW_URL : URL publique de la fiche Trustpilot (par défaut zenbat.fr).
const BUSINESS_UNIT_ID = import.meta.env.VITE_TRUSTPILOT_BUSINESS_UNIT_ID || ''
const REVIEW_URL       = import.meta.env.VITE_TRUSTPILOT_REVIEW_URL || 'https://fr.trustpilot.com/review/zenbat.fr'

// Template "Carousel" multi-avis (largeur pleine, hauteur 240px).
// Réf. : https://support.trustpilot.com/hc/en-us/articles/115011421468
const TEMPLATE_ID = '53aa8912dec7e10d38f59f36'

export default function LandingTrustpilot() {
  const widgetRef = useRef(null)

  useEffect(() => {
    // Le bootstrap Trustpilot est chargé en async dans index.html.
    // On déclenche le rendu du widget dès qu'il est disponible.
    if (!BUSINESS_UNIT_ID || !widgetRef.current) return
    if (window.Trustpilot) {
      window.Trustpilot.loadFromElement(widgetRef.current, true)
      return
    }
    const id = setInterval(() => {
      if (window.Trustpilot && widgetRef.current) {
        window.Trustpilot.loadFromElement(widgetRef.current, true)
        clearInterval(id)
      }
    }, 250)
    // Stop polling après 10s si le script n'a pas chargé.
    const timeout = setTimeout(() => clearInterval(id), 10000)
    return () => { clearInterval(id); clearTimeout(timeout) }
  }, [])

  return (
    <section
      id="trustpilot"
      style={{
        background:    C.cream,
        borderTop:     `1px solid ${C.border}`,
        padding:       '72px 24px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <p
          style={{
            fontFamily:    "'DM Sans', system-ui, sans-serif",
            fontSize:      11,
            fontWeight:    700,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color:         C.terra,
            marginBottom:  12,
          }}
        >
          Avis clients
        </p>

        <h2
          style={{
            fontFamily:  "'Syne', sans-serif",
            fontSize:    32,
            fontWeight:  400,
            color:       C.ink,
            lineHeight:  1.2,
            margin:      '0 0 12px',
          }}
        >
          Ils utilisent Zenbat au quotidien
        </h2>

        <p
          style={{
            fontFamily:   "'DM Sans', system-ui, sans-serif",
            fontSize:     15,
            color:        C.muted,
            marginBottom: 32,
            lineHeight:   1.6,
          }}
        >
          Découvrez les retours de nos artisans et indépendants sur Trustpilot.
        </p>

        {BUSINESS_UNIT_ID ? (
          <div
            ref={widgetRef}
            className="trustpilot-widget"
            data-locale="fr-FR"
            data-template-id={TEMPLATE_ID}
            data-businessunit-id={BUSINESS_UNIT_ID}
            data-style-height="240px"
            data-style-width="100%"
            data-theme="light"
            data-stars="4,5"
            data-review-languages="fr"
          >
            <a href={REVIEW_URL} target="_blank" rel="noopener noreferrer">
              Voir nos avis sur Trustpilot
            </a>
          </div>
        ) : (
          <a
            href={REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            10,
              padding:        '14px 24px',
              borderRadius:   12,
              background:     'white',
              border:         `1px solid ${C.border}`,
              color:          C.ink,
              fontFamily:     "'DM Sans', system-ui, sans-serif",
              fontSize:       15,
              fontWeight:     600,
              textDecoration: 'none',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#00B67A" aria-hidden="true">
              <path d="M12 2l2.6 7.5h7.9l-6.4 4.6 2.4 7.4L12 17l-6.5 4.5 2.4-7.4-6.4-4.6h7.9z"/>
            </svg>
            Voir nos avis sur Trustpilot
          </a>
        )}
      </div>
    </section>
  )
}
