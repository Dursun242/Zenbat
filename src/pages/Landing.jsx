import PricingSection from '../components/landing/PricingSection'

export default function Landing({ onLogin, onSignup }) {
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: '#fff', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        @keyframes fadeUp  { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float   { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:.4; } }
        .ha  { animation: fadeUp .75s cubic-bezier(.16,1,.3,1) both; }
        .ha1 { animation: fadeUp .75s .13s cubic-bezier(.16,1,.3,1) both; }
        .ha2 { animation: fadeUp .75s .26s cubic-bezier(.16,1,.3,1) both; }
        .phone-float { animation: float 4s ease-in-out infinite; }

        /* Nav */
        .nav-link:hover  { color: #fff !important; }
        .nav-ghost:hover { background: rgba(255,255,255,.06) !important; }
        .nav-cta:hover   { background: #16a34a !important; }

        /* Hero CTA */
        .cta-main:hover    { background: #16a34a !important; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(34,197,94,.35) !important; }
        .cta-ghost:hover   { background: rgba(255,255,255,.06) !important; }

        /* Features — grille journal */
        .feat-grid {
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          overflow: hidden;
        }
        .feat-item {
          padding: 28px 26px;
          background: #fff;
          border-right:  1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          transition: background .2s;
        }
        .feat-item:nth-child(2n)       { border-right: none; }
        .feat-item:nth-last-child(-n+2){ border-bottom: none; }
        .feat-item:hover               { background: #f8fafc !important; }

        /* How it works */
        .step-item:hover .step-inner { border-color: #22c55e !important; }

        /* Trades */
        .trade-chip:hover { border-color: #22c55e !important; color: #16a34a !important; background: #f0fdf4 !important; }

        /* Final CTA */
        .final-btn:hover { background: #16a34a !important; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(34,197,94,.35) !important; }

        /* Responsive */
        @media (max-width: 768px) {
          .hero-grid    { flex-direction: column !important; }
          .hero-phone   { display: none !important; }
          .nav-links    { display: none !important; }
          .hero-title   { font-size: 38px !important; }
          .section-h2   { font-size: 30px !important; }
          .stats-grid   { grid-template-columns: repeat(2,1fr) !important; }
          .feat-grid    { grid-template-columns: 1fr !important; }
          .feat-item    { border-right: none !important; }
          .feat-item:nth-last-child(-n+2) { border-bottom: 1px solid #e2e8f0 !important; }
          .feat-item:last-child           { border-bottom: none !important; }
          .steps-grid   { grid-template-columns: 1fr !important; }
          .trades-grid  { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        background: '#0f172a', padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 0 rgba(255,255,255,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px' }}>
            <span style={{ color: '#22c55e' }}>Zen</span><span style={{ color: '#fff' }}>bat</span>
          </span>
          <div className="nav-links" style={{ display: 'flex', gap: 24 }}>
            {[['#features','Fonctionnalités'],['#how','Comment ça marche'],['#pricing','Tarifs'],['#aide','Aide']].map(([h,l]) => (
              <a key={h} href={h} className="nav-link" style={{
                color: '#94a3b8', fontSize: 14, fontWeight: 500,
                textDecoration: 'none', transition: 'color .15s',
              }}>{l}</a>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="nav-ghost" onClick={onLogin} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #334155',
            background: 'transparent', color: '#94a3b8',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background .15s',
          }}>Connexion</button>
          <button className="nav-cta" onClick={onSignup} style={{
            padding: '8px 16px', borderRadius: 8, border: 0,
            background: '#22c55e', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background .15s',
          }}>Essai gratuit</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        padding: '80px 24px 100px',
        minHeight: 'calc(100vh - 64px)',
        display: 'flex', alignItems: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', top:-100, right:-100, width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(34,197,94,.07) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-50, left:-50, width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(34,197,94,.04) 0%, transparent 70%)', pointerEvents:'none' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div className="hero-grid" style={{ display: 'flex', alignItems: 'center', gap: 64 }}>

            {/* Copy */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ha" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(34,197,94,.10)', border: '1px solid rgba(34,197,94,.22)',
                borderRadius: 20, padding: '6px 14px', marginBottom: 28,
              }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse 2.5s ease infinite' }} />
                <span style={{ color:'#4ade80', fontSize:11.5, fontWeight:600, letterSpacing:'.5px' }}>
                  DISPONIBLE MAINTENANT — 30 JOURS GRATUITS
                </span>
              </div>

              <h1 className="ha1 hero-title" style={{
                fontSize: 52, fontWeight: 900, lineHeight: 1.1,
                color: '#fff', letterSpacing: '-1.5px', marginBottom: 20,
              }}>
                Vos devis BTP<br />
                <span style={{ color: '#22c55e' }}>en quelques secondes</span><br />
                grâce à l'IA
              </h1>

              <p className="ha2" style={{
                fontSize: 17, color: '#94a3b8', lineHeight: 1.75, marginBottom: 36, maxWidth: 480,
              }}>
                Décrivez vos prestations dans votre langue — français, arabe, darija,
                espagnol, anglais… Zenbat génère instantanément un devis professionnel prêt à signer.
              </p>

              <div className="ha2" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
                <button className="cta-main" onClick={onSignup} style={{
                  padding: '14px 28px', borderRadius: 12, border: 0,
                  background: '#22c55e', color: '#fff',
                  fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  Commencer gratuitement
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
                  </svg>
                </button>
                <button className="cta-ghost" onClick={onLogin} style={{
                  padding: '14px 28px', borderRadius: 12,
                  border: '1px solid #334155', background: 'transparent',
                  color: '#fff', fontSize: 16, fontWeight: 600,
                  cursor: 'pointer', transition: 'background .2s',
                }}>Se connecter</button>
              </div>

              <div className="ha2" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {['Sans carte bancaire', "30 jours d'essai", 'Annulation à tout moment'].map(t => (
                  <span key={t} style={{ color: '#64748b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Phone mockup */}
            <div className="hero-phone" style={{ flexShrink: 0 }}>
              <div className="phone-float" style={{
                width: 268, height: 540, background: '#1e293b',
                borderRadius: 40, border: '5px solid #334155',
                boxShadow: '0 40px 80px rgba(0,0,0,.55)',
                padding: 14, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ width:72, height:22, background:'#0f172a', borderRadius:11, margin:'0 auto 10px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:'#334155' }} />
                </div>
                <div style={{ background:'#0f172a', borderRadius:10, padding:'7px 11px', marginBottom:9, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ color:'#fff', fontWeight:800, fontSize:13 }}><span style={{ color:'#22c55e' }}>Zen</span>bat</span>
                  <span style={{ background:'rgba(34,197,94,.15)', color:'#4ade80', fontSize:8, fontWeight:700, padding:'2px 6px', borderRadius:8, border:'1px solid rgba(34,197,94,.25)' }}>PRO</span>
                </div>
                <div style={{ background:'#0f172a', borderRadius:10, padding:11, marginBottom:8 }}>
                  <div style={{ fontSize:9, color:'#64748b', marginBottom:3 }}>DEV-2026-0042</div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:2 }}>Rénovation salle de bain</div>
                  <div style={{ fontSize:10, color:'#94a3b8', marginBottom:8 }}>M. Martin · Paris 15e</div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:15, fontWeight:800, color:'#22c55e' }}>4 850,00 €</span>
                    <span style={{ background:'rgba(34,197,94,.15)', color:'#4ade80', fontSize:8, fontWeight:700, padding:'2px 7px', borderRadius:8, border:'1px solid rgba(34,197,94,.25)' }}>ACCEPTÉ</span>
                  </div>
                </div>
                <div style={{ background:'#0f172a', borderRadius:10, padding:9, marginBottom:8 }}>
                  <div style={{ fontSize:9, color:'#64748b', marginBottom:5 }}>Agent IA</div>
                  <div style={{ background:'#1e293b', borderRadius:7, padding:'5px 9px', marginBottom:5 }}>
                    <div style={{ fontSize:9, color:'#94a3b8', lineHeight:1.5 }}>Pose carrelage 25 €/m² pour 40 m², fourniture 18 €/m²…</div>
                  </div>
                  <div style={{ display:'flex', gap:5 }}>
                    {['Carrelage','Pose'].map(t => (
                      <div key={t} style={{ background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.2)', borderRadius:5, padding:'2px 6px', fontSize:7.5, color:'#4ade80', fontWeight:600 }}>{t}</div>
                    ))}
                  </div>
                </div>
                <div style={{ position:'absolute', bottom:14, left:14, right:14, background:'#0f172a', borderRadius:10, padding:'7px 0', display:'flex', justifyContent:'space-around' }}>
                  {['🏠','👥','📄','🧾','✨'].map(i => <span key={i} style={{ fontSize:13 }}>{i}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '52px 24px' }}>
        <div className="stats-grid" style={{
          maxWidth: 920, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16,
        }}>
          {[
            ['< 30 s',  'Pour générer un devis'],
            ['100 %',   'Conforme TVA France'],
            ['121+',    'Métiers couverts'],
            ['19 €',    'Par mois TTC tout inclus'],
          ].map(([stat, label]) => (
            <div key={stat} style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                fontSize: 44, fontWeight: 900, color: '#0f172a',
                letterSpacing: '-2px', lineHeight: 1, marginBottom: 8,
              }}>{stat}</div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display:'inline-block', background:'#f0fdf4', color:'#16a34a', fontSize:11.5, fontWeight:700, padding:'4px 14px', borderRadius:20, marginBottom:16, letterSpacing:'.5px', textTransform:'uppercase' }}>
              Fonctionnalités
            </div>
            <h2 className="section-h2" style={{ fontSize:40, fontWeight:800, color:'#0f172a', letterSpacing:'-1px', marginBottom:14, lineHeight:1.15 }}>
              Tout ce dont vous avez besoin
            </h2>
            <p style={{ fontSize:16, color:'#64748b', maxWidth:480, margin:'0 auto', lineHeight:1.72 }}>
              De la description des travaux jusqu'à la signature du devis — tout en un seul outil.
            </p>
          </div>

          <div className="feat-grid" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)' }}>
            {[
              { icon:'🤖', title:'Agent IA multilingue',          desc:"Dictez ou tapez en français, arabe, darija, espagnol, anglais, portugais… Zenbat rédige le devis en français professionnel en moins de 30 secondes." },
              { icon:'📄', title:'PDF professionnel instantané',   desc:"Logo, couleurs, TVA, mentions légales, RIB. Un PDF à votre image prêt à envoyer au client en un clic." },
              { icon:'✍️', title:'Signature électronique eIDAS',   desc:"Envoyez le devis via Odoo Sign. Le client signe en ligne depuis son téléphone — vous suivez l'état en temps réel." },
              { icon:'📱', title:'Application mobile (PWA)',       desc:"Installez Zenbat sur iPhone ou Android en un tap. Créez vos devis depuis le chantier." },
              { icon:'👥', title:'Gestion des clients',            desc:"Carnet d'adresses complet. Importez depuis une photo, une carte de visite ou une capture d'écran." },
              { icon:'📊', title:'Tableau de bord & CA',           desc:"Chiffre d'affaires signé, devis en cours, taux de conversion — toutes vos stats en un coup d'œil." },
              { icon:'🧾', title:'Factures & Factur-X 2026',       desc:"Convertissez un devis en facture en un clic. PDF Factur-X embarqué, conforme à l'obligation de facturation électronique 2026." },
              { icon:'🏛️', title:'Conformité légale & TVA',        desc:"Régime normal ou franchise (art. 293B). Décennale, IBAN, RIB — tout est intégré automatiquement dans vos documents." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="feat-item">
                <div style={{ fontSize:32, marginBottom:14, lineHeight:1 }}>{icon}</div>
                <h3 style={{ fontSize:16, fontWeight:700, color:'#0f172a', marginBottom:8, letterSpacing:'-.2px' }}>{title}</h3>
                <p style={{ fontSize:14, color:'#475569', lineHeight:1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: '96px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ display:'inline-block', background:'#f0fdf4', color:'#16a34a', fontSize:11.5, fontWeight:700, padding:'4px 14px', borderRadius:20, marginBottom:16, letterSpacing:'.5px', textTransform:'uppercase' }}>
              En 3 étapes
            </div>
            <h2 className="section-h2" style={{ fontSize:40, fontWeight:800, color:'#0f172a', letterSpacing:'-1px', lineHeight:1.15 }}>
              Simple comme bonjour
            </h2>
          </div>

          <div className="steps-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:40 }}>
            {[
              { n:'01', title:'Décrivez les travaux',    desc:"Tapez ou dictez dans la langue de votre choix. Ex : « Pose de carrelage 25 €/m² pour 40 m², fourniture 18 €/m² »" },
              { n:'02', title:"L'IA génère le devis",    desc:"En moins de 30 secondes, Zenbat structure chaque ligne : désignation, quantité, prix unitaire, TVA, total HT." },
              { n:'03', title:'Envoyez & faites signer', desc:"PDF prêt en un clic. Envoyez par email ou en signature électronique et suivez l'état depuis l'appli." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="step-item">
                <div style={{
                  fontSize: 80, fontWeight: 900, color: 'rgba(34,197,94,.10)',
                  letterSpacing: '-4px', lineHeight: 1, marginBottom: 12,
                  userSelect: 'none',
                }}>{n}</div>
                <h3 style={{ fontSize:17, fontWeight:700, color:'#0f172a', marginBottom:10, letterSpacing:'-.2px' }}>{title}</h3>
                <p style={{ fontSize:14, color:'#64748b', lineHeight:1.72 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRADES ── */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display:'inline-block', background:'#f0fdf4', color:'#16a34a', fontSize:11.5, fontWeight:700, padding:'4px 14px', borderRadius:20, marginBottom:16, letterSpacing:'.5px', textTransform:'uppercase' }}>
            Tous secteurs
          </div>
          <h2 className="section-h2" style={{ fontSize:36, fontWeight:800, color:'#0f172a', letterSpacing:'-1px', marginBottom:12 }}>
            Votre métier, votre IA
          </h2>
          <p style={{ fontSize:15, color:'#64748b', marginBottom:40, maxWidth:520, margin:'0 auto 40px', lineHeight:1.72 }}>
            BTP, beauté, tech, restauration, santé… Zenbat s'adapte à vos métiers déclarés et génère des devis cohérents avec votre activité.
          </p>
          <div className="trades-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, maxWidth:900, margin:'0 auto' }}>
            {[
              ['🧱','Maçonnerie'],['🚰','Plomberie'],['⚡','Électricité'],['🎨','Peinture'],
              ['🪵','Charpente'],['❄️','Climatisation'],['🟦','Carrelage'],['🌳','Paysagisme'],
              ['✂️','Coiffure'],['💅','Esthétique'],['💻','Développement web'],['📸','Photographie'],
              ['🍕','Restauration'],['🥐','Boulangerie'],['🚗','Mécanique auto'],['📦','Déménagement'],
              ['💆','Kinésithérapie'],['🎓','Formation'],['🧹','Nettoyage'],['🐾','Toilettage animal'],
              ['🔥','Chauffage'],['🛁','Sanitaire'],['🏠','Couverture'],['🍳','Cuisine / Agencement'],
            ].map(([icon, label]) => (
              <div key={label} className="trade-chip" style={{
                background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10,
                padding:'10px 8px', fontSize:12.5, fontWeight:500, color:'#475569',
                display:'flex', alignItems:'center', gap:6,
                transition:'all .18s', cursor:'default',
              }}>
                <span style={{ fontSize:15 }}>{icon}</span>
                <span style={{ lineHeight:1.3 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <PricingSection />

      {/* ── FINAL CTA ── */}
      <section style={{ background:'#0f172a', padding:'96px 24px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle, rgba(34,197,94,.07) 0%, transparent 65%)', pointerEvents:'none' }} />
        <div style={{ position:'relative', maxWidth:580, margin:'0 auto' }}>
          <h2 style={{ fontSize:42, fontWeight:900, color:'#fff', letterSpacing:'-1.5px', marginBottom:16, lineHeight:1.15 }}>
            Prêt à gagner du temps<br />sur vos devis ?
          </h2>
          <p style={{ fontSize:16, color:'#94a3b8', marginBottom:36, lineHeight:1.75 }}>
            Rejoignez les artisans et indépendants qui utilisent Zenbat.<br />
            Aucune carte bancaire requise pour l'essai.
          </p>
          <button className="final-btn" onClick={onSignup} style={{
            padding:'15px 36px', borderRadius:12, border:0,
            background:'#22c55e', color:'#fff',
            fontSize:17, fontWeight:700, cursor:'pointer',
            transition:'all .2s',
          }}>
            Créer mon compte gratuitement
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background:'#020617', padding:'32px 24px' }}>
        <div style={{ maxWidth:1000, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
          <span style={{ fontWeight:800, fontSize:18, letterSpacing:'-.5px' }}>
            <span style={{ color:'#22c55e' }}>Zen</span><span style={{ color:'#475569' }}>bat</span>
          </span>
          <span style={{ color:'#334155', fontSize:12 }}>© 2026 Zenbat — SaaS de devis & facturation</span>
          <div style={{ display:'flex', gap:16, alignItems:'center' }}>
            {[['#','Aide'],['/cgu','CGU'],['mailto:Zenbat76@gmail.com','Contact']].map(([href,label]) => (
              <a key={label} href={href} style={{ color:'#475569', fontSize:13, textDecoration:'none' }}
                onMouseOver={e => e.target.style.color='#94a3b8'}
                onMouseOut={e => e.target.style.color='#475569'}>
                {label}
              </a>
            ))}
            <button onClick={onLogin} style={{ background:'none', border:'none', color:'#475569', fontSize:13, cursor:'pointer' }}
              onMouseOver={e => e.target.style.color='#94a3b8'}
              onMouseOut={e => e.target.style.color='#475569'}>
              Connexion
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
