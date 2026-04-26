import { useState, useEffect, useRef } from 'react'

const C = {
  terra:  '#C97B5C',
  ink:    '#1A1612',
  muted:  '#6B6358',
  border: '#E8E2D8',
  cream:  '#FAF7F2',
  warm:   '#F0EBE3',
}

const DEMO_INPUT = 'Isolation combles laine minérale soufflée R>=6, 80m2, fourniture et pose'
const DEMO_LINES = [
  { lot: true,  label: 'ISOLATION COMBLES' },
  { lot: false, label: 'Laine minérale soufflée R6', unite: 'm²', qty: '80', pu: '32,00 €', total: '2 560,00 €', tva: '0%' },
]

const CAPS = [
  {
    icon: '🎙️',
    title: '12 langues reconnues',
    desc: 'Dictez en français, anglais, espagnol, arabe… L'IA transcrit et restructure dans la langue de votre devis.',
  },
  {
    icon: '🏗️',
    title: '200+ corps de métier',
    desc: 'Plomberie, carrelage, isolation, électricité, menuiserie… Le vocabulaire technique est intégré nativement.',
  },
  {
    icon: '🧾',
    title: 'TVA et mentions auto',
    desc: 'Franchise, auto-liquidation, TVA réduite… L'IA applique le bon régime selon votre profil et le contexte.',
  },
  {
    icon: '✏️',
    title: 'Vous restez aux commandes',
    desc: 'Ajustez, supprimez, relancez l'IA en un clic. Le devis final est toujours le vôtre.',
  },
]

export default function LandingIA() {
  const [phase, setPhase]   = useState(0) // 0=idle 1=typing 2=processing 3=result
  const [typed, setTyped]   = useState('')
  const [dots,  setDots]    = useState(0)
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  // Animation loop
  useEffect(() => {
    if (!visible) return
    let timer

    if (phase === 0) {
      timer = setTimeout(() => { setPhase(1); setTyped('') }, 800)
    } else if (phase === 1) {
      let i = 0
      const iv = setInterval(() => {
        if (i >= DEMO_INPUT.length) {
          clearInterval(iv)
          setPhase(2)
          return
        }
        setTyped(DEMO_INPUT.slice(0, ++i))
      }, 38)
      return () => clearInterval(iv)
    } else if (phase === 2) {
      const iv = setInterval(() => setDots(d => (d + 1) % 4), 350)
      timer = setTimeout(() => { clearInterval(iv); setPhase(3) }, 1800)
      return () => clearInterval(iv)
    } else if (phase === 3) {
      timer = setTimeout(() => { setPhase(0); setTyped('') }, 4000)
    }

    return () => clearTimeout(timer)
  }, [phase, visible])

  return (
    <section
      id="features"
      ref={ref}
      style={{
        background: C.ink,
        padding: '100px 24px',
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes ia-fadein {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ia-v0 { animation: ia-fadein .65s cubic-bezier(.16,1,.3,1) both; }
        .ia-v1 { animation: ia-fadein .65s .10s cubic-bezier(.16,1,.3,1) both; }
        .ia-v2 { animation: ia-fadein .65s .20s cubic-bezier(.16,1,.3,1) both; }
        .ia-v3 { animation: ia-fadein .65s .30s cubic-bezier(.16,1,.3,1) both; }

        @media (max-width: 900px) {
          .ia-grid { flex-direction: column !important; }
          .ia-demo { max-width: 100% !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1120, margin: '0 auto' }}>

        {/* En-tête */}
        <div className={visible ? 'ia-v0' : ''} style={{ opacity: visible ? undefined : 0, textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(201,123,92,.14)', color: C.terra,
            fontSize: 11, fontWeight: 700,
            padding: '4px 14px', borderRadius: 20,
            letterSpacing: '.8px', textTransform: 'uppercase',
            marginBottom: 20,
          }}>
            Moteur IA génératif
          </div>

          <h2 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 400,
            color: '#FFFCF7',
            letterSpacing: '-.5px',
            lineHeight: 1.15,
            marginBottom: 16,
          }}>
            Une phrase dictée.<br />
            <span style={{ color: C.terra, fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 400 }}>
              Un devis complet.
            </span>
          </h2>

          <p style={{ fontSize: 16, color: '#9A8E82', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
            Pas un formulaire. Pas de menus à remplir. Décrivez votre prestation comme vous le feriez à voix haute — l'IA fait le reste.
          </p>
        </div>

        {/* Grille principale */}
        <div className={`ia-grid ${visible ? 'ia-v1' : ''}`} style={{
          opacity: visible ? undefined : 0,
          display: 'flex', gap: 48, alignItems: 'flex-start',
        }}>

          {/* ── Démo visuelle ── */}
          <div className="ia-demo" style={{ flex: '0 0 420px', maxWidth: 420 }}>
            <div style={{
              background: '#231D18',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,.07)',
              overflow: 'hidden',
              boxShadow: '0 40px 80px rgba(0,0,0,.5)',
            }}>
              {/* Barre de titre */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#C97B5C' }} />
                <span style={{ color: '#6B6358', fontSize: 11, fontWeight: 600, letterSpacing: '.4px' }}>ZENBAT IA</span>
                <span style={{
                  marginLeft: 'auto',
                  background: 'rgba(201,123,92,.15)', color: C.terra,
                  fontSize: 9, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 6, letterSpacing: '.4px',
                }}>
                  EN LIGNE
                </span>
              </div>

              {/* Zone de saisie */}
              <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <p style={{ fontSize: 9, color: '#6B6358', letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: 10 }}>
                  Vous décrivez votre prestation
                </p>
                <div style={{
                  background: 'rgba(255,255,255,.04)',
                  borderRadius: 10, padding: '12px 14px',
                  border: `1px solid ${phase === 1 ? 'rgba(201,123,92,.4)' : 'rgba(255,255,255,.07)'}`,
                  transition: 'border-color .3s',
                  minHeight: 60,
                }}>
                  <p style={{ color: '#F5F0EA', fontSize: 13, lineHeight: 1.6, minHeight: 40 }}>
                    {phase >= 1 ? typed : ''}
                    {phase === 1 && <span style={{ opacity: .5, marginLeft: 1 }}>|</span>}
                  </p>
                </div>
              </div>

              {/* Zone IA */}
              <div style={{ padding: 20, minHeight: 200 }}>
                {phase < 2 && (
                  <p style={{ fontSize: 9, color: '#4A4642', letterSpacing: '.6px', textTransform: 'uppercase' }}>
                    En attente…
                  </p>
                )}

                {phase === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160, gap: 14 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: dots > i ? C.terra : 'rgba(201,123,92,.25)',
                          transition: 'background .25s',
                        }} />
                      ))}
                    </div>
                    <p style={{ fontSize: 12, color: '#6B6358' }}>L'IA structure votre devis…</p>
                  </div>
                )}

                {phase === 3 && (
                  <div>
                    <p style={{ fontSize: 9, color: C.terra, letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: 12 }}>
                      ✓ Devis généré
                    </p>
                    {/* Tableau mini */}
                    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,.07)' }}>
                      <div style={{ background: C.terra, padding: '6px 10px', display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 6 }}>
                        {['Désignation', 'Qté', 'TVA', 'Total HT'].map(h => (
                          <span key={h} style={{ color: 'white', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>{h}</span>
                        ))}
                      </div>
                      {DEMO_LINES.map((l, i) => l.lot ? (
                        <div key={i} style={{ background: 'rgba(201,123,92,.10)', padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                          <span style={{ color: C.terra, fontSize: 9, fontWeight: 700, letterSpacing: '.3px' }}>{l.label}</span>
                        </div>
                      ) : (
                        <div key={i} style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 6, alignItems: 'center' }}>
                          <span style={{ color: '#F5F0EA', fontSize: 11 }}>{l.label}</span>
                          <span style={{ color: '#6B6358', fontSize: 10 }}>{l.qty} {l.unite}</span>
                          <span style={{ color: '#6B6358', fontSize: 10 }}>{l.tva}</span>
                          <span style={{ color: C.terra, fontSize: 11, fontWeight: 700 }}>{l.total}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                      <span style={{ background: 'rgba(201,123,92,.15)', color: C.terra, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 8 }}>
                        TOTAL TTC : 2 560,00 €
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Capacités ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {CAPS.map((cap, i) => (
              <div
                key={i}
                className={visible ? `ia-v${Math.min(i + 1, 3)}` : ''}
                style={{
                  opacity: visible ? undefined : 0,
                  padding: '22px 24px',
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,.06)',
                  background: 'rgba(255,255,255,.03)',
                  transition: 'background .2s, border-color .2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(201,123,92,.07)'
                  e.currentTarget.style.borderColor = 'rgba(201,123,92,.25)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,.03)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{cap.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#FFFCF7', marginBottom: 5 }}>
                      {cap.title}
                    </div>
                    <div style={{ fontSize: 13.5, color: '#9A8E82', lineHeight: 1.6 }}>
                      {cap.desc}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
