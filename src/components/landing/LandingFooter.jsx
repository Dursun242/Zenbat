import { useState } from 'react'

const C = {
  terra:      '#C97B5C',
  terradark:  '#A55F44',
  cream:      '#FAF7F2',
  creamlight: '#FFFCF7',
  ink:        '#1A1612',
  muted:      '#6B6358',
  border:     '#E8E2D8',
}

const FOOTER_COLUMNS = [
  {
    heading: 'Produit',
    links: [
      { label: 'Fonctionnalités', href: '#features' },
      { label: 'Tarifs',          href: '#pricing'  },
      { label: 'FAQ',             href: '#faq'      },
    ],
  },
  {
    heading: 'Entreprise',
    links: [
      { label: 'À propos', href: '#about'   },
      { label: 'Blog',     href: '#blog'    },
      { label: 'Contact',  href: '#contact' },
    ],
  },
  {
    heading: 'Légal',
    links: [
      { label: 'CGU',              href: '#cgu'      },
      { label: 'CGV',              href: '#cgv'      },
      { label: 'RGPD',             href: '#rgpd'     },
      { label: 'Mentions légales', href: '#mentions' },
    ],
  },
  {
    heading: 'Contact',
    links: [
      { label: 'Zenbat76@gmail.com', href: 'mailto:Zenbat76@gmail.com' },
    ],
  },
]

function FooterLink({ href, children }) {
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        'block',
        color:          hovered ? '#9A9088' : '#4A4642',
        fontSize:       13,
        textDecoration: 'none',
        lineHeight:     1.6,
        transition:     'color 0.16s',
      }}
    >
      {children}
    </a>
  )
}

export default function LandingFooter({ onSignup }) {
  const [ctaHovered, setCtaHovered] = useState(false)

  return (
    <footer>
      {/* ── Part 1 — CTA Banner ── */}
      <div
        style={{
          background: C.terra,
          padding:    '72px 24px',
          textAlign:  'center',
        }}
      >
        <h2
          style={{
            fontFamily:  "'Syne', sans-serif",
            fontSize:    48,
            fontWeight:  700,
            color:       C.creamlight,
            lineHeight:  1.15,
            letterSpacing: "-1px",
            margin:      0,
            maxWidth:    720,
            marginLeft:  'auto',
            marginRight: 'auto',
          }}
        >
          Reprenez la main sur votre temps. Et sur votre cash.
        </h2>

        <p
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize:   16,
            color:      'rgba(255,252,247,.75)',
            marginTop:  14,
            marginBottom: 0,
          }}
        >
          30 jours pour tester Zenbat sans engagement, sans CB, sans risque.
        </p>

        <button
          onClick={onSignup}
          onMouseEnter={() => setCtaHovered(true)}
          onMouseLeave={() => setCtaHovered(false)}
          style={{
            display:     'inline-block',
            marginTop:   32,
            background:  ctaHovered ? 'white' : C.creamlight,
            color:       C.terra,
            fontFamily:  "'DM Sans', system-ui, sans-serif",
            fontWeight:  700,
            fontSize:    15,
            padding:     '13px 32px',
            borderRadius: 10,
            border:      'none',
            cursor:      'pointer',
            transform:   ctaHovered ? 'scale(1.02)' : 'scale(1)',
            transition:  'background 0.18s, transform 0.18s',
          }}
        >
          Démarrer maintenant
        </button>
      </div>

      {/* ── Part 2 — Classic footer ── */}
      <div
        style={{
          background: C.ink,
          padding:    '48px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin:   '0 auto',
          }}
        >
          {/* Logo + tagline */}
          <div style={{ marginBottom: 36 }}>
            <div
              style={{
                fontFamily:    "'Syne', sans-serif",
                fontSize:      22,
                fontWeight:    700,
                letterSpacing: '-.3px',
                lineHeight:    1,
                marginBottom:  10,
              }}
            >
              <span style={{ color: C.terra }}>Zen</span>
              <span style={{ color: 'white' }}>bat</span>
            </div>
            <p
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize:   13,
                color:      '#5A5550',
                margin:     0,
                lineHeight: 1.5,
                maxWidth:   340,
              }}
            >
              L'assistant commercial vocal pour artisans, consultants et freelances.
            </p>
          </div>

          {/* 4 columns */}
          <div
            style={{
              display:   'flex',
              flexWrap:  'wrap',
              gap:       40,
              marginBottom: 0,
            }}
          >
            {FOOTER_COLUMNS.map(col => (
              <div key={col.heading} style={{ minWidth: 120 }}>
                <p
                  style={{
                    fontFamily:   "'DM Sans', system-ui, sans-serif",
                    fontSize:     11,
                    fontWeight:   700,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    color:        '#6A6460',
                    margin:       0,
                    marginBottom: 12,
                  }}
                >
                  {col.heading}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.links.map(link => (
                    <FooterLink key={link.label} href={link.href}>
                      {link.label}
                    </FooterLink>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom line */}
          <div
            style={{
              borderTop:   '1px solid #2A2622',
              paddingTop:  24,
              marginTop:   40,
            }}
          >
            <p
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize:   12,
                color:      '#3A3632',
                margin:     0,
              }}
            >
              © 2026 Zenbat. Édité par ID Maîtrise · Le Havre, France.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
