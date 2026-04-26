import { useState, useEffect, useRef } from 'react'

const FEATURES = [
  'Devis et factures illimités',
  'Dictée vocale 12 langues',
  'Signature électronique eIDAS',
  'Factur-X embarqué (prêt 2026)',
  'Multi-appareils (iOS, Android, Mac, Windows, web)',
  'Export comptable',
  'Support par email',
]

function CheckIcon() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 15 15" fill="none"
      style={{ flexShrink: 0, marginTop: 2 }}
      aria-hidden="true"
    >
      <circle cx="7.5" cy="7.5" r="6.5" fill="#C97B5C" fillOpacity="0.14" />
      <path
        d="M4.5 7.5L6.5 9.5L10.5 5.5"
        stroke="#C97B5C" strokeWidth="1.7"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

export default function PricingSection() {
  const [isTTC, setIsTTC]           = useState(true)
  const [isBiannual, setIsBiannual] = useState(false)
  const [priceChanging, setPriceChanging] = useState(false)
  const [visible, setVisible]       = useState(false)
  const ref = useRef(null)

  // Apparition au scroll
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  // Anime la sortie du prix, change la valeur, puis l'entrée
  function toggleTax() {
    setPriceChanging(true)
    setTimeout(() => {
      setIsTTC(v => !v)
      setPriceChanging(false)
    }, 150)
  }

  const tax = isTTC ? 'TTC' : 'HT'
  const prices = {
    monthly:       isTTC ? '19'   : '15,83',
    biannualPm:    isTTC ? '9,50' : '7,92',
    biannualTotal: isTTC ? '57'   : '47,50',
  }

  // Transition douce appliquée sur les spans de prix
  const priceAnim = {
    display:    'inline-block',
    opacity:    priceChanging ? 0 : 1,
    transform:  priceChanging ? 'translateY(-5px)' : 'translateY(0)',
    transition: 'opacity .14s ease, transform .14s ease',
  }

  return (
    <section
      id="pricing"
      ref={ref}
      style={{
        background:  '#FAF7F2',
        padding:     '96px 24px',
        fontFamily:  "'DM Sans', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes ps-up {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        /* Classes d'apparition avec délais échelonnés */
        .ps-v0 { animation: ps-up .62s cubic-bezier(.16,1,.3,1) both; }
        .ps-v1 { animation: ps-up .62s .10s cubic-bezier(.16,1,.3,1) both; }
        .ps-v2 { animation: ps-up .62s .20s cubic-bezier(.16,1,.3,1) both; }
        .ps-v3 { animation: ps-up .62s .30s cubic-bezier(.16,1,.3,1) both; }

        .ps-card { transition: transform .25s ease, box-shadow .25s ease !important; }
        .ps-card:hover { transform: translateY(-4px) !important; }
        .ps-card-plain:hover { box-shadow: 0 20px 48px rgba(10,10,10,.09) !important; }
        .ps-card-feat:hover  { box-shadow: 0 20px 48px rgba(201,123,92,.22) !important; }

        .ps-btn-o:hover {
          background: rgba(201,123,92,.07) !important;
          transform: translateY(-2px) !important;
        }
        .ps-btn-f:hover {
          background: #B86D4F !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 24px rgba(201,123,92,.38) !important;
        }

        @media (max-width: 680px) {
          /* Carte mise en avant en premier sur mobile */
          .ps-cards { flex-direction: column-reverse !important; }
          /* Toggle TTC centré sur mobile */
          .ps-ttc-row { justify-content: center !important; }
        }
      `}</style>

      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* ── Toggle TTC / HT (discret, coin haut droit) ── */}
        <div
          className={`ps-ttc-row ${visible ? 'ps-v0' : ''}`}
          style={{
            opacity:       visible ? undefined : 0,
            display:       'flex',
            justifyContent:'flex-end',
            marginBottom:  20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: !isTTC ? '#C97B5C' : '#B0A898',
              transition: 'color .2s',
            }}>
              HT
            </span>

            <button
              onClick={toggleTax}
              aria-pressed={isTTC}
              aria-label={`Afficher les prix ${isTTC ? 'hors taxe' : 'toutes taxes comprises'}`}
              style={{
                width: 38, height: 22, borderRadius: 11,
                border: 'none', padding: 0,
                background: isTTC ? '#C97B5C' : '#D5CEC7',
                cursor: 'pointer', position: 'relative',
                transition: 'background .25s',
              }}
            >
              <span style={{
                position: 'absolute', top: 3,
                left: isTTC ? 19 : 3,
                width: 16, height: 16,
                borderRadius: '50%', background: '#fff',
                transition: 'left .25s cubic-bezier(.4,0,.2,1)',
                boxShadow: '0 1px 3px rgba(0,0,0,.18)',
              }} />
            </button>

            <span style={{
              fontSize: 11, fontWeight: isTTC ? 600 : 500,
              color: isTTC ? '#C97B5C' : '#B0A898',
              transition: 'color .2s',
            }}>
              TTC
            </span>
          </div>
        </div>

        {/* ── En-tête ── */}
        <div
          className={visible ? 'ps-v1' : ''}
          style={{ opacity: visible ? undefined : 0, textAlign: 'center', marginBottom: 44 }}
        >
          <div style={{
            display: 'inline-block',
            background: 'rgba(201,123,92,.10)', color: '#C97B5C',
            fontSize: 11, fontWeight: 700,
            padding: '4px 14px', borderRadius: 20,
            letterSpacing: '.8px', textTransform: 'uppercase',
            marginBottom: 18,
          }}>
            Tarifs
          </div>

          <h2 style={{
            fontFamily:    "'Instrument Serif', Georgia, 'Times New Roman', serif",
            fontSize:      44,
            fontWeight:    700,
            color:         '#0A0A0A',
            letterSpacing: '-.5px',
            lineHeight:    1.18,
            marginBottom:  14,
          }}>
            Simple. Transparent.<br />
            <span style={{ color: '#C97B5C' }}>Sans surprise.</span>
          </h2>

          <p style={{
            fontSize: 15, color: '#6B6358',
            maxWidth: 420, margin: '0 auto', lineHeight: 1.7,
          }}>
            30 jours d'essai gratuit, sans carte bancaire.
            Engagez-vous seulement quand vous êtes convaincu.
          </p>
        </div>

        {/* ── Toggle Mensuel / 6 mois ── */}
        <div
          className={visible ? 'ps-v2' : ''}
          style={{
            opacity:        visible ? undefined : 0,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            10,
            marginBottom:   36,
          }}
        >
          {/* Pill selector */}
          <div style={{
            display:    'inline-flex',
            background: 'rgba(10,10,10,.055)',
            borderRadius: 12,
            padding:    3,
            position:   'relative',
          }}>
            {/* Indicateur glissant */}
            <div style={{
              position:   'absolute',
              top:        3,
              left:       isBiannual ? 'calc(50% + 1.5px)' : 3,
              width:      'calc(50% - 4.5px)',
              height:     'calc(100% - 6px)',
              background: '#fff',
              borderRadius: 9,
              transition: 'left .28s cubic-bezier(.4,0,.2,1)',
              boxShadow:  '0 1px 4px rgba(0,0,0,.10)',
            }} />

            {[
              { label: 'Mensuel', val: false },
              { label: '6 mois',  val: true  },
            ].map(({ label, val }) => (
              <button
                key={label}
                onClick={() => setIsBiannual(val)}
                style={{
                  position:   'relative', zIndex: 1,
                  padding:    '8px 24px',
                  border:     'none', background: 'transparent',
                  color:      isBiannual === val ? '#0A0A0A' : '#6B6358',
                  fontSize:   13,
                  fontWeight: isBiannual === val ? 600 : 500,
                  cursor:     'pointer',
                  transition: 'color .2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Badge "Économisez 50%" — apparaît quand 6 mois est actif */}
          <div style={{
            background:  '#C97B5C',
            color:       '#fff',
            fontSize:    11, fontWeight: 700,
            padding:     '4px 11px', borderRadius: 20,
            letterSpacing: '.2px',
            opacity:     isBiannual ? 1 : 0,
            transform:   isBiannual ? 'translateX(0) scale(1)' : 'translateX(-6px) scale(.88)',
            transition:  'opacity .22s, transform .22s',
            pointerEvents: 'none',
          }}>
            Économisez 50%
          </div>
        </div>

        {/* ── Cartes ── */}
        <div
          className={`ps-cards ${visible ? 'ps-v3' : ''}`}
          style={{
            opacity:     visible ? undefined : 0,
            display:     'flex',
            gap:         18,
            alignItems:  'stretch',
          }}
        >

          {/* ── Carte Mensuel ── */}
          <div
            className="ps-card ps-card-plain"
            style={{
              flex:        1,
              background:  '#fff',
              border:      '1.5px solid #E4DAD0',
              borderRadius: 24,
              padding:     '32px 28px',
              boxShadow:   '0 2px 12px rgba(10,10,10,.04)',
              display:     'flex', flexDirection: 'column',
            }}
          >
            <div style={{ marginBottom: 24 }}>
              <span style={{
                display:    'inline-block',
                background: 'rgba(107,99,88,.08)', color: '#6B6358',
                fontSize: 10.5, fontWeight: 700,
                padding: '3px 10px', borderRadius: 8,
                letterSpacing: '.6px', textTransform: 'uppercase',
                marginBottom: 16,
              }}>
                Testez librement
              </span>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  ...priceAnim,
                  fontFamily:    "'Instrument Serif', Georgia, serif",
                  fontSize:      52,
                  fontWeight:    700,
                  color:         '#0A0A0A',
                  letterSpacing: '-2px',
                  lineHeight:    1,
                }}>
                  {prices.monthly} €
                </span>
                <span style={{ fontSize: 13, color: '#9A9088' }}>/mois {tax}</span>
              </div>

              <div style={{ fontSize: 13, color: '#9A9088', marginTop: 7 }}>Sans engagement</div>
            </div>

            <ul style={{
              listStyle: 'none', flex: 1,
              display: 'flex', flexDirection: 'column', gap: 10,
              marginBottom: 28,
            }}>
              {FEATURES.map(f => (
                <li key={f} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 9,
                  fontSize: 13.5, color: '#3D3832', lineHeight: 1.5,
                }}>
                  <CheckIcon />{f}
                </li>
              ))}
            </ul>

            <div>
              <button
                className="ps-btn-o"
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 12,
                  border: '1.5px solid #C97B5C', background: 'transparent',
                  color: '#C97B5C', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', transition: 'all .2s', marginBottom: 8,
                }}
              >
                Essayer 30 jours gratuit
              </button>
              <p style={{ textAlign: 'center', fontSize: 11, color: '#B0A898', margin: 0 }}>
                Aucune carte bancaire requise
              </p>
            </div>
          </div>

          {/* ── Carte 6 mois — mise en avant ── */}
          <div
            className="ps-card ps-card-feat"
            style={{
              flex:        1,
              position:    'relative', overflow: 'hidden',
              background:  'linear-gradient(148deg, #FEF3EC 0%, #FAF7F2 100%)',
              border:      '2px solid #C97B5C',
              borderRadius: 24,
              padding:     '32px 28px',
              boxShadow:   '0 4px 24px rgba(201,123,92,.15)',
              display:     'flex', flexDirection: 'column',
            }}
          >
            {/* Halo décoratif coin haut-droit */}
            <div style={{
              position:     'absolute', top: -48, right: -48,
              width: 180,   height: 180, borderRadius: '50%',
              background:   'radial-gradient(circle, rgba(201,123,92,.18) 0%, transparent 65%)',
              pointerEvents:'none',
            }} />

            {/* Badge −50% */}
            <div style={{
              position:      'absolute', top: 20, right: 20,
              background:    '#C97B5C', color: '#fff',
              fontSize: 11,  fontWeight: 700,
              padding:       '3px 9px', borderRadius: 8,
              letterSpacing: '.3px',
            }}>
              −50%
            </div>

            <div style={{ marginBottom: 24, position: 'relative' }}>
              <span style={{
                display:    'inline-block',
                background: 'rgba(201,123,92,.12)', color: '#C97B5C',
                fontSize: 10.5, fontWeight: 700,
                padding: '3px 10px', borderRadius: 8,
                letterSpacing: '.6px', textTransform: 'uppercase',
                marginBottom: 16,
              }}>
                Le plus choisi
              </span>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  ...priceAnim,
                  fontFamily:    "'Instrument Serif', Georgia, serif",
                  fontSize:      52,
                  fontWeight:    700,
                  color:         '#0A0A0A',
                  letterSpacing: '-2px',
                  lineHeight:    1,
                }}>
                  {prices.biannualPm} €
                </span>
                <span style={{ fontSize: 13, color: '#9A9088' }}>/mois {tax}</span>
              </div>

              <div style={{ fontSize: 13, color: '#6B6358', marginTop: 7 }}>
                Facturé {prices.biannualTotal} € {tax} en une fois
              </div>
            </div>

            <ul style={{
              listStyle: 'none', flex: 1,
              display: 'flex', flexDirection: 'column', gap: 10,
              marginBottom: 28, position: 'relative',
            }}>
              {FEATURES.map(f => (
                <li key={f} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 9,
                  fontSize: 13.5, color: '#3D3832', lineHeight: 1.5,
                }}>
                  <CheckIcon />{f}
                </li>
              ))}
            </ul>

            <div style={{ position: 'relative' }}>
              <button
                className="ps-btn-f"
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 12,
                  border: 'none', background: '#C97B5C', color: '#fff',
                  fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', transition: 'all .2s', marginBottom: 8,
                  boxShadow: '0 4px 14px rgba(201,123,92,.22)',
                }}
              >
                Essayer 30 jours gratuit
              </button>
              <p style={{ textAlign: 'center', fontSize: 11, color: '#B0A898', margin: 0 }}>
                Aucune carte bancaire requise
              </p>
            </div>
          </div>
        </div>

        {/* ── Mentions légales ── */}
        <p style={{
          textAlign:   'center',
          fontSize:    12,
          color:       '#9A9088',
          margin:      '32px auto 0',
          lineHeight:  1.8,
          maxWidth:    680,
          opacity:     visible ? 1 : 0,
          transition:  'opacity .6s .5s',
        }}>
          Prix TTC. TVA française 20% incluse. Facture déductible pour les professionnels assujettis.
          Annulable à tout moment. Vos données vous appartiennent et restent exportables.
        </p>

      </div>
    </section>
  )
}
