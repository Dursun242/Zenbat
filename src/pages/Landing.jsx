import PricingSection from '../components/landing/PricingSection'

/* ─── Icônes SVG légères (16×16, stroke terracotta) ─── */
const Icon = ({ d, d2 }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="#C97B5C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
)

const FEATURES = [
  { title: 'Agent IA multilingue',          desc: 'Dictez ou tapez en français, arabe, darija, espagnol, anglais… Zenbat rédige le devis en français professionnel en moins de 30 s.',     d: 'M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2zm0 6v4l3 3' },
  { title: 'PDF professionnel instantané',   desc: 'Logo, couleurs, TVA, mentions légales, RIB. Un PDF à votre image prêt à envoyer en un clic.',                                             d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', d2: 'M14 2v6h6' },
  { title: 'Signature électronique eIDAS',   desc: 'Envoyez le devis via Odoo Sign. Le client signe depuis son téléphone — vous suivez l\'état en temps réel.',                              d: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z' },
  { title: 'Application mobile (PWA)',       desc: 'Installez Zenbat sur iPhone ou Android en un tap. Créez vos devis depuis le chantier.',                                                  d: 'M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 16h.01' },
  { title: 'Gestion des clients',            desc: 'Carnet d\'adresses complet. Importez depuis une photo, une carte de visite ou une capture d\'écran.',                                    d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { title: 'Tableau de bord & CA',           desc: 'Chiffre d\'affaires signé, devis en cours, taux de conversion — toutes vos stats en un coup d\'œil.',                                   d: 'M18 20V10M12 20V4M6 20v-6' },
  { title: 'Factures & Factur-X 2026',       desc: 'Convertissez un devis en facture en un clic. PDF Factur-X embarqué, conforme à l\'obligation 2026.',                                    d: 'M2 5h20a0 0 0 0 1 0 0v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5zm0 5h20' },
  { title: 'Conformité légale & TVA',        desc: 'Régime normal ou franchise (art. 293B). Décennale, IBAN, RIB — tout intégré automatiquement.',                                          d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
]

export default function Landing({ onLogin, onSignup }) {
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: '#fff', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        /* ── Animations ── */
        @keyframes lp-up   { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes lp-pulse { 0%,100% { opacity:1; } 50% { opacity:.35; } }
        .ha  { animation: lp-up .75s cubic-bezier(.16,1,.3,1) both; }
        .ha1 { animation: lp-up .75s .13s cubic-bezier(.16,1,.3,1) both; }
        .ha2 { animation: lp-up .75s .26s cubic-bezier(.16,1,.3,1) both; }

        /* ── Nav ── */
        .lp-nav-link:hover { color: #0A0A0A !important; }
        .lp-nav-ghost:hover { background: rgba(10,10,10,.06) !important; }
        .lp-nav-cta:hover   { background: #B86D4F !important; }

        /* ── Hero CTA ── */
        .lp-cta-primary:hover   { background: #B86D4F !important; transform: translateY(-2px); box-shadow: 0 10px 28px rgba(201,123,92,.38) !important; }
        .lp-cta-ghost:hover     { background: rgba(255,255,255,.08) !important; }

        /* ── Features newspaper grid ── */
        .lp-features-grid {
          border: 1px solid #EDE8E2;
          border-radius: 20px;
          overflow: hidden;
        }
        .lp-fi {
          padding: 32px 28px;
          border-right: 1px solid #EDE8E2;
          border-bottom: 1px solid #EDE8E2;
          transition: background .2s;
          background: #fff;
        }
        .lp-fi:nth-child(2n)      { border-right: none; }
        .lp-fi:nth-last-child(-n+2){ border-bottom: none; }
        .lp-fi:hover               { background: #FAF7F2 !important; }

        /* ── Trades ── */
        .lp-chip:hover { border-color: #C97B5C !important; color: #C97B5C !important; }

        /* ── Final CTA ── */
        .lp-final-btn:hover { background: #B86D4F !important; transform: translateY(-2px); box-shadow: 0 10px 28px rgba(201,123,92,.40) !important; }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .lp-nav-links   { display: none !important; }
          .lp-hero-title  { font-size: 38px !important; }
          .lp-section-h2  { font-size: 30px !important; }
          .lp-stats-grid  { grid-template-columns: repeat(2,1fr) !important; }
          .lp-feat-grid   { grid-template-columns: 1fr !important; }
          .lp-feat-grid .lp-fi { border-right: none !important; }
          .lp-feat-grid .lp-fi:nth-last-child(-n+1) { border-bottom: none !important; }
          .lp-feat-grid .lp-fi:nth-last-child(-n+2) { border-bottom: 1px solid #EDE8E2 !important; }
          .lp-steps-grid  { grid-template-columns: 1fr !important; }
          .lp-trades-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      {/* ════════════════════════════════ NAV ════════════════════════════════ */}
      <nav style={{
        background: '#FAFAF8', borderBottom: '1px solid #EDE8E2',
        padding: '0 28px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, letterSpacing: '-.3px' }}>
            <span style={{ color: '#C97B5C' }}>Zen</span><span style={{ color: '#0A0A0A' }}>bat</span>
          </span>
          <div className="lp-nav-links" style={{ display: 'flex', gap: 24 }}>
            {[['#features','Fonctionnalités'],['#how','Comment ça marche'],['#pricing','Tarifs'],['#aide','Aide']].map(([h,l]) => (
              <a key={h} href={h} className="lp-nav-link" style={{
                color: '#6B6358', fontSize: 13.5, fontWeight: 500,
                textDecoration: 'none', transition: 'color .15s',
              }}>{l}</a>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="lp-nav-ghost" onClick={onLogin} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: 'transparent', color: '#6B6358',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background .15s',
          }}>Connexion</button>
          <button className="lp-nav-cta" onClick={onSignup} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: '#C97B5C', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background .15s',
          }}>Essai gratuit</button>
        </div>
      </nav>

      {/* ════════════════════════════════ HERO ════════════════════════════════ */}
      <section style={{
        background: '#0D0B09',
        padding: '96px 28px 120px',
        minHeight: 'calc(100vh - 60px)',
        display: 'flex', alignItems: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Halo terracotta */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(201,123,92,.13) 0%, transparent 68%)',
        }} />

        <div style={{ maxWidth: 1060, margin: '0 auto', width: '100%', position: 'relative' }}>

          {/* Badge disponibilité */}
          <div className="ha" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(201,123,92,.10)', border: '1px solid rgba(201,123,92,.22)',
            borderRadius: 20, padding: '6px 14px', marginBottom: 32,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#C97B5C',
              display: 'inline-block', animation: 'lp-pulse 2.5s ease infinite',
            }} />
            <span style={{ color: '#C97B5C', fontSize: 11, fontWeight: 600, letterSpacing: '.7px' }}>
              DISPONIBLE MAINTENANT — 30 JOURS GRATUITS
            </span>
          </div>

          {/* Titre éditorial */}
          <h1 className="ha1 lp-hero-title" style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 62, fontWeight: 400, lineHeight: 1.07,
            color: '#F5F0EA', letterSpacing: '-1.5px',
            marginBottom: 24, maxWidth: 680,
          }}>
            Vos devis BTP<br />
            <span style={{ color: '#C97B5C', fontStyle: 'italic' }}>en quelques secondes,</span><br />
            grâce à l'IA.
          </h1>

          <p className="ha2" style={{
            fontSize: 17, color: '#7A7470', lineHeight: 1.78,
            marginBottom: 40, maxWidth: 460,
          }}>
            Décrivez vos prestations dans votre langue — français, arabe, darija,
            espagnol, anglais… Zenbat génère instantanément un devis professionnel prêt à signer.
          </p>

          {/* CTAs */}
          <div className="ha2" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 36 }}>
            <button className="lp-cta-primary" onClick={onSignup} style={{
              padding: '13px 28px', borderRadius: 10, border: 'none',
              background: '#C97B5C', color: '#fff',
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
              transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 20px rgba(201,123,92,.28)',
            }}>
              Commencer gratuitement
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
              </svg>
            </button>
            <button className="lp-cta-ghost" onClick={onLogin} style={{
              padding: '13px 28px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,.10)', background: 'transparent',
              color: 'rgba(255,255,255,.55)', fontSize: 15, fontWeight: 500,
              cursor: 'pointer', transition: 'background .2s',
            }}>Se connecter</button>
          </div>

          {/* Garanties */}
          <div className="ha2" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {['Sans carte bancaire', "30 jours d'essai", 'Annulation à tout moment'].map(t => (
              <span key={t} style={{
                color: '#4A4642', fontSize: 12.5,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5.5" fill="#C97B5C" fillOpacity=".18"/>
                  <path d="M4 6.5L5.8 8.5L9 4.5" stroke="#C97B5C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════ STATS ════════════════════════════════ */}
      <section style={{
        background: '#FAF7F2',
        borderBottom: '1px solid #EDE8E2',
        padding: '60px 28px',
      }}>
        <div className="lp-stats-grid" style={{
          maxWidth: 860, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24,
        }}>
          {[
            ['< 30 s',  'Pour générer un devis'],
            ['100 %',   'Conforme TVA France'],
            ['121+',    'Métiers couverts'],
            ['19 €',    'Par mois TTC tout inclus'],
          ].map(([stat, label]) => (
            <div key={stat} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 44, fontWeight: 400, color: '#0A0A0A',
                letterSpacing: '-1px', lineHeight: 1, marginBottom: 8,
              }}>{stat}</div>
              <div style={{ fontSize: 13, color: '#6B6358', lineHeight: 1.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════ FEATURES ════════════════════════════════ */}
      <section id="features" style={{ padding: '104px 28px', background: '#fff' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>

          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#C97B5C',
              letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 18,
            }}>Fonctionnalités</div>
            <h2 className="lp-section-h2" style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 40, fontWeight: 400, color: '#0A0A0A',
              letterSpacing: '-.5px', marginBottom: 14, lineHeight: 1.18,
            }}>Tout ce dont vous avez besoin</h2>
            <p style={{ fontSize: 15.5, color: '#6B6358', maxWidth: 460, margin: '0 auto', lineHeight: 1.72 }}>
              De la description des travaux jusqu'à la signature — tout en un seul outil.
            </p>
          </div>

          {/* Grille "journal" — bordures partagées */}
          <div className="lp-features-grid lp-feat-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)' }}>
            {FEATURES.map(({ title, desc, d, d2 }) => (
              <div key={title} className="lp-fi">
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'rgba(201,123,92,.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <Icon d={d} d2={d2} />
                </div>
                <h3 style={{
                  fontSize: 15.5, fontWeight: 600, color: '#0A0A0A',
                  marginBottom: 8, letterSpacing: '-.2px',
                }}>{title}</h3>
                <p style={{ fontSize: 13.5, color: '#6B6358', lineHeight: 1.68 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════ HOW IT WORKS ════════════════════════════════ */}
      <section id="how" style={{ padding: '104px 28px', background: '#FAF7F2' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#C97B5C',
              letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 18,
            }}>En 3 étapes</div>
            <h2 className="lp-section-h2" style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 40, fontWeight: 400, color: '#0A0A0A',
              letterSpacing: '-.5px', lineHeight: 1.18,
            }}>Simple comme bonjour</h2>
          </div>

          <div className="lp-steps-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 56,
          }}>
            {[
              { n: '01', title: 'Décrivez les travaux',    desc: "Tapez ou dictez dans la langue de votre choix. Ex : « Pose de carrelage 25 €/m² pour 40 m², fourniture 18 €/m² »" },
              { n: '02', title: "L'IA génère le devis",    desc: "En moins de 30 secondes, Zenbat structure chaque ligne : désignation, quantité, prix unitaire, TVA, total HT." },
              { n: '03', title: 'Envoyez & faites signer', desc: "PDF prêt en un clic. Envoyez par email ou en signature électronique et suivez l'état depuis l'appli." },
            ].map(({ n, title, desc }) => (
              <div key={n}>
                <div style={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: 72, fontWeight: 400, color: 'rgba(10,10,10,.07)',
                  letterSpacing: '-3px', lineHeight: 1, marginBottom: 16,
                }}>{n}</div>
                <h3 style={{
                  fontSize: 16.5, fontWeight: 600, color: '#0A0A0A',
                  marginBottom: 10, letterSpacing: '-.2px',
                }}>{title}</h3>
                <p style={{ fontSize: 14, color: '#6B6358', lineHeight: 1.72 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════ TRADES ════════════════════════════════ */}
      <section style={{ padding: '88px 28px', background: '#fff' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#C97B5C',
            letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 18,
          }}>Tous secteurs</div>
          <h2 className="lp-section-h2" style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 36, fontWeight: 400, color: '#0A0A0A',
            letterSpacing: '-.5px', marginBottom: 14, lineHeight: 1.2,
          }}>Votre métier, votre IA</h2>
          <p style={{
            fontSize: 15, color: '#6B6358', lineHeight: 1.72,
            maxWidth: 480, margin: '0 auto 44px',
          }}>
            BTP, beauté, tech, restauration… Zenbat s'adapte à vos métiers déclarés et génère des devis cohérents avec votre activité.
          </p>

          <div className="lp-trades-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
            gap: 7, maxWidth: 880, margin: '0 auto',
          }}>
            {[
              'Maçonnerie','Plomberie','Électricité','Peinture',
              'Charpente','Climatisation','Carrelage','Paysagisme',
              'Coiffure','Esthétique','Développement web','Photographie',
              'Restauration','Boulangerie','Mécanique auto','Déménagement',
              'Kinésithérapie','Formation','Nettoyage','Toilettage animal',
              'Chauffage','Sanitaire','Couverture','Cuisine / Agencement',
            ].map(label => (
              <div key={label} className="lp-chip" style={{
                border: '1px solid #EDE8E2', borderRadius: 8,
                padding: '9px 10px', fontSize: 12.5, fontWeight: 500,
                color: '#6B6358', background: '#fff',
                transition: 'border-color .18s, color .18s',
                textAlign: 'center', lineHeight: 1.4, cursor: 'default',
              }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════ PRICING ════════════════════════════════ */}
      <PricingSection />

      {/* ════════════════════════════════ FINAL CTA ════════════════════════════════ */}
      <section style={{
        background: '#0D0B09', padding: '108px 28px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none',
          transform: 'translate(-50%, -50%)',
          width: 700, height: 700, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,123,92,.09) 0%, transparent 62%)',
        }} />
        <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 46, fontWeight: 400, color: '#F5F0EA',
            letterSpacing: '-1px', marginBottom: 18, lineHeight: 1.13,
          }}>
            Prêt à gagner du temps<br />
            <span style={{ color: '#C97B5C', fontStyle: 'italic' }}>sur vos devis ?</span>
          </h2>
          <p style={{ fontSize: 15.5, color: '#5A5550', marginBottom: 36, lineHeight: 1.75 }}>
            Rejoignez les artisans et indépendants qui utilisent Zenbat.<br />
            Aucune carte bancaire requise pour l'essai.
          </p>
          <button className="lp-final-btn" onClick={onSignup} style={{
            padding: '14px 36px', borderRadius: 12, border: 'none',
            background: '#C97B5C', color: '#fff',
            fontSize: 16, fontWeight: 600, cursor: 'pointer',
            transition: 'all .2s', boxShadow: '0 4px 20px rgba(201,123,92,.28)',
          }}>
            Créer mon compte gratuitement
          </button>
        </div>
      </section>

      {/* ════════════════════════════════ FOOTER ════════════════════════════════ */}
      <footer style={{ background: '#080706', padding: '28px 28px' }}>
        <div style={{
          maxWidth: 1000, margin: '0 auto',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: 16,
        }}>
          <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 20, letterSpacing: '-.3px' }}>
            <span style={{ color: '#C97B5C' }}>Zen</span><span style={{ color: '#3A3632' }}>bat</span>
          </span>
          <span style={{ color: '#2E2A26', fontSize: 12 }}>© 2026 Zenbat</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {[['#','Aide'],['/cgu','CGU'],['mailto:Zenbat76@gmail.com','Contact']].map(([href, label]) => (
              <a key={label} href={href} style={{ color: '#3A3632', fontSize: 13, textDecoration: 'none' }}
                onMouseOver={e => e.target.style.color = '#6B6358'}
                onMouseOut={e => e.target.style.color = '#3A3632'}>
                {label}
              </a>
            ))}
            <button onClick={onLogin} style={{
              background: 'none', border: 'none', color: '#3A3632',
              fontSize: 13, cursor: 'pointer',
            }}
              onMouseOver={e => e.target.style.color = '#6B6358'}
              onMouseOut={e => e.target.style.color = '#3A3632'}>
              Connexion
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
