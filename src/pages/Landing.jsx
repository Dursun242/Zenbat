import LandingNav      from '../components/landing/LandingNav'
import LandingHero     from '../components/landing/LandingHero'
import LandingStats    from '../components/landing/LandingStats'
import LandingMetiers  from '../components/landing/LandingMetiers'
import LandingRelance  from '../components/landing/LandingRelance'
import LandingHow      from '../components/landing/LandingHow'
import PricingSection  from '../components/landing/PricingSection'
import LandingFAQ      from '../components/landing/LandingFAQ'
import LandingFooter   from '../components/landing/LandingFooter'

export default function Landing({ onLogin, onSignup }) {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#FAF7F2', color: '#1A1612', overflowX: 'hidden' }}>
      <LandingNav     onLogin={onLogin} onSignup={onSignup} />
      <LandingHero    onSignup={onSignup} />
      <LandingStats   />
      <LandingMetiers />
      <LandingRelance />
      <LandingHow     />
      <PricingSection />
      <LandingFAQ     />
      <LandingFooter  onSignup={onSignup} />
    </div>
  )
}
