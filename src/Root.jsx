import { lazy, Suspense, useState } from 'react'
import { useAuth } from './lib/auth.jsx'
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

const VillesIndex = lazy(() => import('./pages/VillesIndex.jsx'))
const VillePage   = lazy(() => import('./pages/VillePage.jsx'))

const loader = {
  wrap: { minHeight:'100vh', display:'grid', placeItems:'center', background:'#FAF7F2', color:'#6B6358', fontFamily:'system-ui,sans-serif' },
}

const EMAIL_VERIFY_GRACE_DAYS = 7

export default function Root() {
  const { session, loading, recovery } = useAuth()
  const [mode, setMode] = useState(null) // null = landing, 'login', 'signup'

  const path = typeof window !== 'undefined' ? window.location.pathname : '/'

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

  if (path === '/signup' || path === '/signup/') {
    return <Signup onSwitchToLogin={() => { window.location.href = '/login' }} onBack={() => { window.location.href = '/' }} />
  }
  if (path === '/login' || path === '/login/') {
    return <Login onSwitchToSignup={() => { window.location.href = '/signup' }} onBack={() => { window.location.href = '/' }} />
  }

  if (mode === 'signup') return <Signup onSwitchToLogin={() => setMode('login')} onBack={() => setMode(null)} />
  if (mode === 'login')  return <Login  onSwitchToSignup={() => setMode('signup')} onBack={() => setMode(null)} />

  return <Landing onLogin={() => setMode('login')} onSignup={() => setMode('signup')} />
}
