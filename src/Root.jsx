import { useState } from 'react'
import { useAuth } from './lib/auth.jsx'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Landing from './pages/Landing.jsx'
import CGU from './pages/CGU.jsx'
import EmailVerificationGate from './components/EmailVerificationGate.jsx'

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
  if (path === '/cgu') return <CGU />

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
