import { lazy, Suspense, useState } from 'react'
import { useAuth } from './lib/auth.jsx'
import { isChunkLoadError, tryReloadOnce } from './lib/chunkReload.js'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Landing from './pages/Landing.jsx'
import CGU from './pages/CGU.jsx'
import DevisPublicPage from './pages/DevisPublicPage.jsx'
import ContactPage from './pages/ContactPage.jsx'
import EmailVerificationGate from './components/EmailVerificationGate.jsx'
// CRM en import sync (utilisé par l'admin au quotidien — éliminer les
// chunk errors prime sur les ~80 Ko de bundle initial supplémentaire).
import CRM from './pages/CRM.jsx'

// Pages SEO publiques uniquement — conservées en lazy car prerenderées
// statiquement par vitePrerenderPlugin (un visiteur Google qui arrive
// sur /villes/paris reçoit le HTML final pré-rendu, le JS n'est lazy
// que pour l'hydratation côté navigateur), et pour ne pas charger les
// ~36 Ko de data/villes.js dans le bundle principal des artisans.
//
// lazyWithReload : ces deux imports restaient la dernière source possible
// de « Failed to fetch dynamically imported module » (chunk périmé après
// redéploiement Vercel chez un client au cache PWA obsolète). Plutôt que
// laisser l'erreur remonter à l'ErrorBoundary (écran crash + log), on
// l'attrape dans la factory : si c'est bien un chunk error, on déclenche
// le reload via tryReloadOnce (debounce 30s + escalade nuke gérés là-bas)
// et on renvoie une promesse pendante → le fallback Suspense s'affiche
// pendant que la page recharge le nouvel index.html. Si tryReloadOnce a
// déjà abandonné (false), on relance l'erreur pour laisser l'ErrorBoundary
// proposer le reload manuel.
function lazyWithReload(factory) {
  return lazy(() => factory().catch(err => {
    if (isChunkLoadError(err) && tryReloadOnce()) return new Promise(() => {})
    throw err
  }))
}
const VillesIndex = lazyWithReload(() => import('./pages/VillesIndex.jsx'))
const VillePage   = lazyWithReload(() => import('./pages/VillePage.jsx'))

const loader = {
  wrap: { minHeight:'100vh', display:'grid', placeItems:'center', background:'#FAF7F2', color:'#6B6358', fontFamily:'system-ui,sans-serif' },
}

const EMAIL_VERIFY_GRACE_DAYS = 7

export default function Root() {
  const { session, loading, recovery } = useAuth()
  const [mode, setMode] = useState(null) // null = landing, 'login', 'signup'

  const path = typeof window !== 'undefined' ? window.location.pathname : '/'

  if (path === '/crm') return (
    <Suspense fallback={<div style={loader.wrap}>Chargement…</div>}>
      <CRM />
    </Suspense>
  )
  if (path === '/auth/callback') return <AuthCallback />
  if (path === '/reset-password' || recovery) return <ResetPassword />
  if (path === '/cgu')     return <CGU />
  if (path === '/contact') return <ContactPage />
  if (path.startsWith('/d/')) return <DevisPublicPage token={path.slice(3)} />
  if (path === '/villes' || path === '/villes/') {
    return (
      <Suspense fallback={<div style={loader.wrap}>Chargement…</div>}>
        <VillesIndex />
      </Suspense>
    )
  }
  if (path.startsWith('/villes/')) {
    const slug = path.slice('/villes/'.length).replace(/\/$/, '')
    return (
      <Suspense fallback={<div style={loader.wrap}>Chargement…</div>}>
        <VillePage slug={slug} />
      </Suspense>
    )
  }

  if (loading) {
    return <div style={loader.wrap}>Chargement…</div>
  }

  if (session) {
    const user = session.user
    const isConfirmed = !!user.email_confirmed_at
    if (!isConfirmed) {
      const ageDays = (Date.now() - new Date(user.created_at).getTime()) / 86_400_000
      const isBlocking = ageDays >= EMAIL_VERIFY_GRACE_DAYS
      return <EmailVerificationGate blocking={isBlocking}><App /></EmailVerificationGate>
    }
    return <App />
  }

  if (mode === 'signup') return <Signup onSwitchToLogin={() => setMode('login')} onBack={() => setMode(null)} />
  if (mode === 'login')  return <Login  onSwitchToSignup={() => setMode('signup')} onBack={() => setMode(null)} />

  return <Landing onLogin={() => setMode('login')} onSignup={() => setMode('signup')} />
}
