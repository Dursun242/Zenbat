import { useState } from 'react'
import { useAuth } from './lib/auth.jsx'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Landing from './pages/Landing.jsx'

const loader = {
  wrap: { minHeight:'100vh', display:'grid', placeItems:'center', background:'#f8fafc', color:'#64748b', fontFamily:'system-ui,sans-serif' },
}

export default function Root() {
  const { session, loading, recovery } = useAuth()
  const [mode, setMode] = useState(null) // null = landing, 'login', 'signup'

  const path = typeof window !== 'undefined' ? window.location.pathname : '/'

  if (path === '/auth/callback') return <AuthCallback />
  if (path === '/reset-password' || recovery) return <ResetPassword />

  if (loading) {
    return <div style={loader.wrap}>Chargement…</div>
  }

  if (session) return <App />

  if (mode === 'signup') return <Signup onSwitchToLogin={() => setMode('login')} onBack={() => setMode(null)} />
  if (mode === 'login')  return <Login  onSwitchToSignup={() => setMode('signup')} onBack={() => setMode(null)} />

  return <Landing onLogin={() => setMode('login')} onSignup={() => setMode('signup')} />
}
