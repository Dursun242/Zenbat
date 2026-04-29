import { useState } from 'react'
import LandingNav      from '../components/landing/LandingNav'
import LandingHero     from '../components/landing/LandingHero'
import LandingStats    from '../components/landing/LandingStats'
import LandingIA       from '../components/landing/LandingIA'
import LandingMetiers  from '../components/landing/LandingMetiers'
import LandingRelance  from '../components/landing/LandingRelance'
import LandingHow      from '../components/landing/LandingHow'
import PricingSection  from '../components/landing/PricingSection'
import LandingFAQ        from '../components/landing/LandingFAQ'
import LandingNewsletter from '../components/landing/LandingNewsletter'
import LandingFooter     from '../components/landing/LandingFooter'

function WhatsAppButton() {
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href="https://wa.me/33679116085"
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:        'fixed',
        bottom:          24,
        right:           24,
        zIndex:          9999,
        display:         'flex',
        alignItems:      'center',
        gap:             10,
        background:      '#25D366',
        color:           'white',
        textDecoration:  'none',
        borderRadius:    999,
        padding:         hovered ? '12px 20px 12px 14px' : '14px',
        boxShadow:       hovered
          ? '0 8px 24px rgba(37,211,102,.45)'
          : '0 4px 16px rgba(37,211,102,.35)',
        transform:       hovered ? 'scale(1.05)' : 'scale(1)',
        transition:      'all 0.2s ease',
        overflow:        'hidden',
        maxWidth:        hovered ? 200 : 52,
      }}
    >
      {/* WhatsApp icon */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="white"
        style={{ flexShrink: 0 }}
      >
        <path d="M17.5 14.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5s-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.3 3.1c.2.2 2.1 3.2 5 4.4.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.4A10 10 0 1012 2z"/>
      </svg>

      {/* Label revealed on hover */}
      <span
        style={{
          fontFamily:   "'DM Sans', system-ui, sans-serif",
          fontWeight:   600,
          fontSize:     14,
          whiteSpace:   'nowrap',
          opacity:      hovered ? 1 : 0,
          maxWidth:     hovered ? 140 : 0,
          transition:   'opacity 0.18s ease, max-width 0.2s ease',
          overflow:     'hidden',
        }}
      >
        WhatsApp
      </span>
    </a>
  )
}

export default function Landing({ onLogin, onSignup }) {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#FAF7F2', color: '#1A1612', overflowX: 'hidden' }}>
      <LandingNav     onLogin={onLogin} onSignup={onSignup} />
      <LandingHero    onSignup={onSignup} />
      <LandingStats   />
      <LandingIA      />
      <LandingMetiers />
      <LandingRelance />
      <LandingHow     />
      <PricingSection onSignup={onSignup} />
      <LandingFAQ        />
      <LandingNewsletter />
      <LandingFooter     onSignup={onSignup} />
      <WhatsAppButton />
    </div>
  )
}
