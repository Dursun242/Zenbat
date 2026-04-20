import { useState } from 'react'
import { useAuth } from './lib/auth.jsx'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Landing from './pages/Landing.jsx'
import AuthCallback from './pages/AuthCallback.jsx'

const loader = {
  wrap: { minHeight:'100vh', display:'grid', placeItems:'center', background:'#f8fafc', color:'#64748b', fontFamily:'system-ui,sans-serif' },
}

export default function Root() {
  const { session, loading } = useAuth()
  const [view, setView] = useState('landing')

  if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
    return <AuthCallback />
  }

  if (loading) {
    return <div style={loader.wrap}>Chargement…</div>
  }

  if (!session) {
    if (view === 'login')  return <Login  onSwitchToSignup={() => setView('signup')} onBack={() => setView('landing')} />
    if (view === 'signup') return <Signup onSwitchToLogin={() => setView('login')} onBack={() => setView('landing')} />
    return <Landing onSignup={() => setView('signup')} onLogin={() => setView('login')} />
  }

  return <App />
}
