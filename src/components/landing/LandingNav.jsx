import { useState, useEffect } from 'react'

const C = {
  terra:     '#C97B5C',
  darkTerra: '#A55F44',
  cream:     '#FAF7F2',
  ink:       '#1A1612',
  muted:     '#6B6358',
  border:    '#E8E2D8',
}

const NAV_LINKS = [
  { label: 'Fonctionnalités', href: '#features' },
  { label: 'Tarifs',          href: '#pricing'  },
  { label: 'FAQ',             href: '#faq'      },
]

export default function LandingNav({ onLogin, onSignup }) {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)

  useEffect(() => {
    function handleScroll() { setScrolled(window.scrollY > 10) }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  /* Close mobile menu on resize past breakpoint */
  useEffect(() => {
    function handleResize() { if (window.innerWidth >= 768) setMenuOpen(false) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&display=swap');

        .ln-link {
          font-size: 14px;
          font-weight: 500;
          color: ${C.muted};
          text-decoration: none;
          transition: color .18s;
          white-space: nowrap;
        }
        .ln-link:hover { color: ${C.ink}; }

        .ln-ghost {
          padding: 9px 18px;
          border-radius: 10px;
          border: 1.5px solid ${C.border};
          background: transparent;
          color: ${C.ink};
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
          transition: border-color .18s, color .18s, background .18s;
        }
        .ln-ghost:hover {
          border-color: ${C.terra};
          color: ${C.terra};
          background: rgba(201,123,92,.06);
        }

        .ln-cta {
          padding: 9px 20px;
          border-radius: 10px;
          border: none;
          background: ${C.terra};
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
          transition: background .18s, box-shadow .18s, transform .14s;
        }
        .ln-cta:hover {
          background: ${C.darkTerra};
          box-shadow: 0 6px 18px rgba(201,123,92,.32);
          transform: translateY(-1px);
        }

        .ln-hamburger {
          display: none;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
        }

        @media (max-width: 767px) {
          .ln-center-links  { display: none !important; }
          .ln-right-buttons { display: none !important; }
          .ln-hamburger     { display: flex !important; }
        }

        /* ── Mobile drawer ── */
        .ln-mobile-menu {
          position: fixed;
          top: 64px;
          left: 0;
          right: 0;
          background: rgba(250,247,242,.97);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid ${C.border};
          z-index: 999;
          padding: 16px 24px 24px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transform-origin: top center;
          animation: ln-menu-in .2s cubic-bezier(.16,1,.3,1) both;
        }
        @keyframes ln-menu-in {
          from { opacity: 0; transform: scaleY(.92); }
          to   { opacity: 1; transform: scaleY(1);   }
        }

        .ln-mobile-link {
          display: block;
          padding: 12px 4px;
          font-size: 15px;
          font-weight: 500;
          color: ${C.ink};
          text-decoration: none;
          border-bottom: 1px solid ${C.border};
          transition: color .15s;
        }
        .ln-mobile-link:last-of-type { border-bottom: none; }
        .ln-mobile-link:hover        { color: ${C.terra}; }

        .ln-mobile-ghost {
          margin-top: 12px;
          padding: 12px 0;
          border-radius: 10px;
          border: 1.5px solid ${C.border};
          background: transparent;
          color: ${C.ink};
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          width: 100%;
          transition: border-color .18s, color .18s;
        }
        .ln-mobile-ghost:hover { border-color: ${C.terra}; color: ${C.terra}; }

        .ln-mobile-cta {
          margin-top: 8px;
          padding: 13px 0;
          border-radius: 10px;
          border: none;
          background: ${C.terra};
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          width: 100%;
          transition: background .18s;
        }
        .ln-mobile-cta:hover { background: ${C.darkTerra}; }
      `}</style>

      {/* ── Sticky nav bar ── */}
      <nav
        role="navigation"
        aria-label="Navigation principale"
        style={{
          position:           'sticky',
          top:                0,
          zIndex:             1000,
          height:             64,
          background:         scrolled ? 'rgba(250,247,242,.92)' : C.cream,
          backdropFilter:     scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom:       `1px solid ${C.border}`,
          transition:         'background .25s',
          fontFamily:         "Inter, 'DM Sans', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth:       1120,
            margin:         '0 auto',
            height:         '100%',
            padding:        '0 24px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            gap:            24,
          }}
        >
          {/* Logo */}
          <a
            href="/"
            aria-label="Zenbat — retour à l'accueil"
            style={{ textDecoration: 'none', flexShrink: 0 }}
          >
            <span
              style={{
                fontFamily:    "'Syne', sans-serif",
                fontSize:      26,
                fontWeight:    400,
                letterSpacing: '-.5px',
                lineHeight:    1,
              }}
            >
              <span style={{ color: C.terra }}>Zen</span>
              <span style={{ color: C.ink  }}>bat</span>
            </span>
          </a>

          {/* Center links — desktop only */}
          <div
            className="ln-center-links"
            style={{ display: 'flex', alignItems: 'center', gap: 32 }}
          >
            {NAV_LINKS.map(({ label, href }) => (
              <a key={href} href={href} className="ln-link">
                {label}
              </a>
            ))}
          </div>

          {/* Right buttons — desktop only */}
          <div
            className="ln-right-buttons"
            style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
          >
            <button className="ln-ghost" onClick={onLogin}>
              Se connecter
            </button>
            <button className="ln-cta" onClick={onSignup}>
              Tester gratuitement
            </button>
          </div>

          {/* Hamburger — mobile only */}
          <button
            className="ln-hamburger"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true">
              {menuOpen ? (
                <>
                  <line x1="1"  y1="1"  x2="21" y2="15" stroke={C.ink} strokeWidth="2" strokeLinecap="round" />
                  <line x1="21" y1="1"  x2="1"  y2="15" stroke={C.ink} strokeWidth="2" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <line x1="1" y1="2"  x2="21" y2="2"  stroke={C.ink} strokeWidth="2" strokeLinecap="round" />
                  <line x1="1" y1="8"  x2="21" y2="8"  stroke={C.ink} strokeWidth="2" strokeLinecap="round" />
                  <line x1="1" y1="14" x2="21" y2="14" stroke={C.ink} strokeWidth="2" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* ── Mobile slide-down menu ── */}
      {menuOpen && (
        <div
          className="ln-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
        >
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="ln-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </a>
          ))}
          <button
            className="ln-mobile-ghost"
            onClick={() => { setMenuOpen(false); onLogin?.() }}
          >
            Se connecter
          </button>
          <button
            className="ln-mobile-cta"
            onClick={() => { setMenuOpen(false); onSignup?.() }}
          >
            Tester gratuitement
          </button>
        </div>
      )}
    </>
  )
}
