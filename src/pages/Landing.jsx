export default function Landing({ onLogin, onSignup }) {
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: '#fff', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .hero-anim { animation: fadeUp 0.7s ease both; }
        .hero-anim-2 { animation: fadeUp 0.7s 0.15s ease both; }
        .hero-anim-3 { animation: fadeUp 0.7s 0.3s ease both; }
        .phone-float { animation: float 4s ease-in-out infinite; }
        .nav-btn:hover { opacity: 0.85 !important; }
        .feature-card:hover { transform: translateY(-4px) !important; box-shadow: 0 20px 60px rgba(15,23,42,.1) !important; }
        .step-card:hover { border-color: #22c55e !important; }
        .cta-main:hover { background: #16a34a !important; transform: translateY(-2px); }
        .cta-secondary:hover { background: #f1f5f9 !important; }
        .trade-chip:hover { background: #f0fdf4 !important; border-color: #22c55e !important; }
        @media (max-width: 768px) {
          .hero-grid { flex-direction: column !important; }
          .hero-phone { display: none !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .nav-links { display: none !important; }
          .hero-title { font-size: 36px !important; }
          .section-title { font-size: 28px !important; }
          .trades-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ background: '#0f172a', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 0 rgba(255,255,255,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px' }}>
            <span style={{ color: '#22c55e' }}>Zen</span><span style={{ color: '#fff' }}>bat</span>
          </span>
          <div className="nav-links" style={{ display: 'flex', gap: 24 }}>
            {[['#features', 'Fonctionnalités'], ['#how', 'Comment ça marche'], ['#pricing', 'Tarifs']].map(([href, label]) => (
              <a key={href} href={href} style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}
                onMouseOver={e => e.target.style.color = '#fff'} onMouseOut={e => e.target.style.color = '#94a3b8'}>
                {label}
              </a>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="nav-btn" onClick={onLogin}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'opacity .2s' }}>
            Connexion
          </button>
          <button className="nav-btn" onClick={onSignup}
            style={{ padding: '8px 16px', borderRadius: 8, border: 0, background: '#22c55e', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'opacity .2s' }}>
            Essai gratuit
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', padding: '80px 24px 100px', minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Background decoration */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -50, left: -50, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div className="hero-grid" style={{ display: 'flex', alignItems: 'center', gap: 64 }}>

            {/* Left copy */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="hero-anim" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 20, padding: '6px 14px', marginBottom: 28 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite', display: 'inline-block' }} />
                <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px' }}>DISPONIBLE MAINTENANT — 30 JOURS GRATUITS</span>
              </div>

              <h1 className="hero-anim hero-title" style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.1, color: '#fff', marginBottom: 20, letterSpacing: '-1.5px' }}>
                Vos devis BTP<br />
                <span style={{ color: '#22c55e' }}>en quelques secondes</span><br />
                grâce à l'IA
              </h1>

              <p className="hero-anim-2" style={{ fontSize: 18, color: '#94a3b8', lineHeight: 1.7, marginBottom: 36, maxWidth: 500 }}>
                Décrivez les travaux en français, arabe, darija ou espagnol —
                Zenbat génère instantanément un devis professionnel prêt à signer.
              </p>

              <div className="hero-anim-3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="cta-main" onClick={onSignup}
                  style={{ padding: '14px 28px', borderRadius: 12, border: 0, background: '#22c55e', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Commencer gratuitement
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>
                </button>
                <button className="cta-secondary" onClick={onLogin}
                  style={{ padding: '14px 28px', borderRadius: 12, border: '1px solid #334155', background: 'transparent', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', transition: 'all .2s' }}>
                  Se connecter
                </button>
              </div>

              <div style={{ marginTop: 32, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {[['✓', 'Sans carte bancaire'], ['✓', '30 jours d\'essai'], ['✓', 'Annulation à tout moment']].map(([icon, text]) => (
                  <span key={text} style={{ color: '#64748b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>{icon}</span> {text}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — phone mockup */}
            <div className="hero-phone" style={{ flexShrink: 0 }}>
              <div className="phone-float" style={{ width: 280, height: 560, background: '#1e293b', borderRadius: 40, border: '6px solid #334155', boxShadow: '0 40px 80px rgba(0,0,0,.5)', padding: 16, position: 'relative', overflow: 'hidden' }}>
                {/* Notch */}
                <div style={{ width: 80, height: 24, background: '#0f172a', borderRadius: 12, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#334155' }} />
                </div>
                {/* App header */}
                <div style={{ background: '#0f172a', borderRadius: 12, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}><span style={{ color: '#22c55e' }}>Zen</span>bat</span>
                  <span style={{ background: 'rgba(34,197,94,.15)', color: '#4ade80', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10, border: '1px solid rgba(34,197,94,.25)' }}>PRO</span>
                </div>
                {/* Devis card */}
                <div style={{ background: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>DEV-2025-0042</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Rénovation salle de bain</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>M. Martin · Paris 15e</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>4 850,00 €</span>
                    <span style={{ background: 'rgba(34,197,94,.15)', color: '#4ade80', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 10, border: '1px solid rgba(34,197,94,.25)' }}>ACCEPTÉ</span>
                  </div>
                </div>
                {/* Chat input simulation */}
                <div style={{ background: '#0f172a', borderRadius: 12, padding: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>Agent IA</div>
                  <div style={{ background: '#1e293b', borderRadius: 8, padding: '6px 10px', marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>Pose carrelage 25€/m² pour 40m², fourniture carrelage 18€/m²…</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['Carrelage / Faïence', 'Pose de carrelage'].map(t => (
                      <div key={t} style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 6, padding: '3px 6px', fontSize: 8, color: '#4ade80', fontWeight: 600, whiteSpace: 'nowrap' }}>{t}</div>
                    ))}
                  </div>
                </div>
                {/* Bottom nav */}
                <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, background: '#0f172a', borderRadius: 12, padding: '8px 0', display: 'flex', justifyContent: 'space-around' }}>
                  {['🏠', '👥', '📄', '✨'].map(icon => (
                    <span key={icon} style={{ fontSize: 16 }}>{icon}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <section style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '32px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 24 }}>
          {[
            ['< 30s', 'Pour générer un devis'],
            ['100%', 'Conforme TVA France'],
            ['26+', 'Métiers BTP couverts'],
            ['15€', 'Par mois tout inclus'],
          ].map(([stat, label]) => (
            <div key={stat} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-1px' }}>{stat}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-block', background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 20, marginBottom: 16, letterSpacing: '0.5px' }}>FONCTIONNALITÉS</div>
            <h2 className="section-title" style={{ fontSize: 40, fontWeight: 800, color: '#0f172a', letterSpacing: '-1px', marginBottom: 16 }}>Tout ce dont vous avez besoin</h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
              De la description des travaux jusqu'à la signature du devis — tout en un seul outil.
            </p>
          </div>

          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {[
              {
                icon: '🤖',
                title: 'Agent IA multilingue',
                desc: 'Décrivez les travaux dans votre langue (français, arabe, darija, espagnol, portugais…). Zenbat rédige le devis en français professionnel, avec les bonnes unités et les bons prix.',
                color: '#f0fdf4', border: '#bbf7d0',
              },
              {
                icon: '📄',
                title: 'PDF professionnel instantané',
                desc: 'Générez un PDF à votre image en un clic : logo, couleurs, coordonnées, TVA, mentions légales, RIB. Prêt à envoyer au client.',
                color: '#eff6ff', border: '#bfdbfe',
              },
              {
                icon: '✍️',
                title: 'Signature électronique',
                desc: 'Envoyez le devis en signature via Odoo Sign. Le client signe en ligne depuis son téléphone. Vous suivez l\'état en temps réel.',
                color: '#fdf4ff', border: '#e9d5ff',
              },
              {
                icon: '📱',
                title: 'Application mobile (PWA)',
                desc: 'Installez Zenbat sur votre iPhone ou Android en un tap. Créez vos devis depuis le chantier, sans connexion initiale requise.',
                color: '#fff7ed', border: '#fed7aa',
              },
              {
                icon: '👥',
                title: 'Gestion des clients',
                desc: 'Carnet d\'adresses complet : particuliers, artisans, entreprises. Importez depuis une photo, une carte de visite ou une capture d\'écran.',
                color: '#f0fdf4', border: '#bbf7d0',
              },
              {
                icon: '📊',
                title: 'Tableau de bord & CA',
                desc: 'Suivez votre chiffre d\'affaires signé, les devis en cours, votre taux de conversion. Toutes vos stats en un coup d\'œil.',
                color: '#eff6ff', border: '#bfdbfe',
              },
            ].map(({ icon, title, desc, color, border }) => (
              <div key={title} className="feature-card"
                style={{ background: color, border: `1px solid ${border}`, borderRadius: 20, padding: 28, transition: 'all .3s' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: '96px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-block', background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 20, marginBottom: 16, letterSpacing: '0.5px' }}>EN 3 ÉTAPES</div>
            <h2 className="section-title" style={{ fontSize: 40, fontWeight: 800, color: '#0f172a', letterSpacing: '-1px', marginBottom: 16 }}>Simple comme bonjour</h2>
          </div>

          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              {
                n: '01',
                icon: '💬',
                title: 'Décrivez les travaux',
                desc: 'Tapez ou dictez les travaux dans la langue de votre choix. Ex : "Pose de carrelage 25€/m² pour 40m², fourniture 18€/m²"',
              },
              {
                n: '02',
                icon: '⚡',
                title: 'L\'IA génère le devis',
                desc: 'En moins de 30 secondes, Zenbat structure chaque ligne : désignation, quantité, prix unitaire, TVA, total HT.',
              },
              {
                n: '03',
                icon: '✅',
                title: 'Envoyez & faites signer',
                desc: 'Générez le PDF, envoyez-le par email ou directement en signature électronique. Suivez l\'état depuis l\'appli.',
              },
            ].map(({ n, icon, title, desc }) => (
              <div key={n} className="step-card"
                style={{ background: '#fff', border: '2px solid #e2e8f0', borderRadius: 20, padding: 28, transition: 'border-color .2s', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 44, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-2px', lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 40, marginBottom: 16 }}>{icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRADES ── */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 20, marginBottom: 16, letterSpacing: '0.5px' }}>TOUS CORPS D'ÉTAT</div>
          <h2 className="section-title" style={{ fontSize: 36, fontWeight: 800, color: '#0f172a', letterSpacing: '-1px', marginBottom: 12 }}>Votre métier, votre IA</h2>
          <p style={{ fontSize: 15, color: '#64748b', marginBottom: 40, maxWidth: 520, margin: '0 auto 40px' }}>
            Zenbat s'adapte à votre corps d'état. L'IA ne génère que des devis cohérents avec vos métiers déclarés.
          </p>
          <div className="trades-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, maxWidth: 800, margin: '0 auto' }}>
            {[
              ['🧱','Maçonnerie'],['🏗️','Gros œuvre'],['🚜','Terrassement'],['🪵','Charpente'],
              ['🏠','Couverture'],['🏛️','Façade'],['🧊','Isolation'],['📐','Plâtrerie'],
              ['🚪','Menuiserie'],['🔧','Serrurerie'],['🚰','Plomberie'],['🛁','Sanitaire'],
              ['🔥','Chauffage'],['❄️','Climatisation'],['⚡','Électricité'],['🎨','Peinture'],
              ['🟦','Carrelage'],['🟫','Sols & Parquet'],['🍳','Cuisine'],['🌳','Paysagisme'],
            ].map(([icon, label]) => (
              <div key={label} className="trade-chip"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 8px', fontSize: 12, fontWeight: 500, color: '#475569', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s', cursor: 'default' }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ lineHeight: 1.3 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: '96px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 20, marginBottom: 16, letterSpacing: '0.5px' }}>TARIFS</div>
          <h2 className="section-title" style={{ fontSize: 40, fontWeight: 800, color: '#0f172a', letterSpacing: '-1px', marginBottom: 12 }}>Simple et transparent</h2>
          <p style={{ fontSize: 16, color: '#64748b', marginBottom: 48 }}>Commencez gratuitement, passez Pro quand vous êtes prêt.</p>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, textAlign: 'left' }}>
            {/* Free */}
            <div style={{ background: '#fff', border: '2px solid #e2e8f0', borderRadius: 24, padding: 32 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Essai gratuit</div>
              <div style={{ fontSize: 42, fontWeight: 900, color: '#0f172a', letterSpacing: '-2px', marginBottom: 4 }}>0€</div>
              <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>pendant 30 jours</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {['Devis illimités', 'Agent IA inclus', 'PDF professionnel', 'Gestion clients', 'Application mobile'].map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#475569' }}>
                    <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 16 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={onSignup}
                style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: '2px solid #0f172a', background: 'transparent', color: '#0f172a', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all .2s' }}
                onMouseOver={e => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = '#fff'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#0f172a'; }}>
                Commencer gratuitement
              </button>
            </div>

            {/* Pro */}
            <div style={{ background: '#0f172a', border: '2px solid #22c55e', borderRadius: 24, padding: 32, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 16, right: 16, background: '#22c55e', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.5px' }}>RECOMMANDÉ</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#4ade80', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pro</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: '-2px' }}>15€</span>
                <span style={{ fontSize: 14, color: '#94a3b8' }}>/mois</span>
              </div>
              <div style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Sans engagement</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {['Tout de l\'essai gratuit', 'Devis illimités sans limite', 'Signature Odoo Sign', 'Support prioritaire', 'Mises à jour IA incluses'].map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#cbd5e1' }}>
                    <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 16 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={onSignup}
                style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 0, background: '#22c55e', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background .2s' }}
                onMouseOver={e => e.currentTarget.style.background = '#16a34a'}
                onMouseOut={e => e.currentTarget.style.background = '#22c55e'}>
                Passer Pro →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ background: '#0f172a', padding: '96px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
          <h2 style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', marginBottom: 16, lineHeight: 1.2 }}>
            Prêt à gagner du temps<br />sur vos devis ?
          </h2>
          <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 36, lineHeight: 1.7 }}>
            Rejoignez les artisans et PME BTP qui utilisent Zenbat.<br />
            Aucune carte bancaire requise pour l'essai.
          </p>
          <button className="cta-main" onClick={onSignup}
            style={{ padding: '16px 36px', borderRadius: 14, border: 0, background: '#22c55e', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', transition: 'all .2s' }}>
            Créer mon compte gratuitement
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#020617', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px' }}>
            <span style={{ color: '#22c55e' }}>Zen</span><span style={{ color: '#475569' }}>bat</span>
          </span>
          <span style={{ color: '#334155', fontSize: 13 }}>© 2025 Zenbat — SaaS de devis BTP</span>
          <button onClick={onLogin} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 13, cursor: 'pointer' }}
            onMouseOver={e => e.target.style.color = '#94a3b8'} onMouseOut={e => e.target.style.color = '#475569'}>
            Connexion
          </button>
        </div>
      </footer>
    </div>
  )
}
