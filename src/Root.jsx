import { Suspense, useState } from 'react'
import { useAuth } from './lib/auth.jsx'
import { lazyWithReload } from './lib/lazyWithReload.js'
import { ZB } from './lib/theme.js'

// Chaque grande surface est un chunk séparé, chargé à la demande : un
// client qui ouvre /d/<token> ne télécharge ni la vitrine, ni l'application,
// ni le CRM ; un artisan connecté ne télécharge pas la vitrine ; le CRM
// (admin seulement) ne pèse plus sur personne.
//
// lazyWithReload (src/lib/lazyWithReload.js) couvre le chunk périmé après
// redéploiement (« Failed to fetch dynamically imported module ») : reload
// unique via tryReloadOnce, fallback Suspense affiché pendant ce temps. Ces
// imports partent tous au démarrage (pas en pleine session), juste après le
// chunk principal du même déploiement : la fenêtre de chunk périmé est
// minime, contrairement aux écrans chargés au fil de la navigation (restés
// en import synchrone dans App.jsx).
//
// VillesIndex / VillePage : prérendues au build (src/prerender.jsx), le JS
// ne sert qu'à reprendre la main dans le navigateur.
const loadApp     = () => import('./App.jsx')
const loadLanding = () => import('./pages/Landing.jsx')
const loadLogin   = () => import('./pages/Login.jsx')
const loadSignup  = () => import('./pages/Signup.jsx')

const App             = lazyWithReload(loadApp)
const Landing         = lazyWithReload(loadLanding)
const Login           = lazyWithReload(loadLogin)
const Signup          = lazyWithReload(loadSignup)
const AuthCallback    = lazyWithReload(() => import('./pages/AuthCallback.jsx'))
const ResetPassword   = lazyWithReload(() => import('./pages/ResetPassword.jsx'))
const CGU             = lazyWithReload(() => import('./pages/CGU.jsx'))
const ContactPage     = lazyWithReload(() => import('./pages/ContactPage.jsx'))
const DevisPublicPage = lazyWithReload(() => import('./pages/DevisPublicPage.jsx'))
const CRM             = lazyWithReload(() => import('./pages/CRM.jsx'))
const VillesIndex     = lazyWithReload(() => import('./pages/VillesIndex.jsx'))
const VillePage       = lazyWithReload(() => import('./pages/VillePage.jsx'))

// Sur « / », on lance tout de suite le téléchargement de l'écran probable
// (application si une session Supabase est stockée, vitrine sinon) sans
// attendre la fin de getSession() : un aller-retour réseau de gagné. Le
// lazy() réutilise ensuite le même module. Côté vitrine, connexion et
// inscription suivent quand le navigateur est libre (pas d'attente au clic).
// Erreurs ignorées ici : elles seront traitées par lazyWithReload au rendu.
function hasStoredSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (/^sb-.+-auth-token$/.test(localStorage.key(i) || '')) return true
    }
  } catch { /* stockage indisponible */ }
  return false
}
if (typeof window !== 'undefined' && window.location.pathname === '/') {
  if (hasStoredSession()) {
    loadApp().catch(() => {})
  } else {
    loadLanding().then(() => {
      const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1500))
      idle(() => { loadLogin().catch(() => {}); loadSignup().catch(() => {}) })
    }).catch(() => {})
  }
}

// Fallback sobre (couleurs Bordereau) pendant le chargement d'un chunk ou de
// la session : fond papier, libellé discret. Police système et non Archivo
// (ZB.font) : sinon ce seul libellé ferait télécharger la police de
// l'application (~88 Ko) sur la vitrine, les CGU et les pages villes.
const loaderStyle = {
  minHeight: '100vh', display: 'grid', placeItems: 'center',
  background: ZB.paper, color: ZB.ink3, fontFamily: 'system-ui, sans-serif', fontSize: 14,
}
function PageLoader() {
  return <div style={loaderStyle} role="status" aria-live="polite">Chargement…</div>
}

const EMAIL_VERIFY_GRACE_DAYS = 7

export default function Root() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RootRoutes />
    </Suspense>
  )
}

function RootRoutes() {
  const { session, loading, recovery } = useAuth()
  const [mode, setMode] = useState(null) // null = landing, 'login', 'signup'

  const path = typeof window !== 'undefined' ? window.location.pathname : '/'

  if (path === '/crm') return <CRM />
  if (path === '/auth/callback') return <AuthCallback />
  if (path === '/reset-password' || recovery) return <ResetPassword />
  if (path === '/cgu')     return <CGU />
  if (path === '/contact') return <ContactPage />
  if (path.startsWith('/d/')) return <DevisPublicPage token={path.slice(3)} />
  if (path === '/villes' || path === '/villes/') return <VillesIndex />
  if (path.startsWith('/villes/')) {
    const slug = path.slice('/villes/'.length).replace(/\/$/, '')
    return <VillePage slug={slug} />
  }

  if (loading) return <PageLoader />
  if (session) {
    const user = session.user
    const isConfirmed = !!user.email_confirmed_at
    if (!isConfirmed) {
      const ageDays = (Date.now() - new Date(user.created_at).getTime()) / 86_400_000
      const isBlocking = ageDays >= EMAIL_VERIFY_GRACE_DAYS
      // Le bandeau est rendu par App, sous la barre du haut (cf. EmailVerificationBanner).
      return <App emailVerification={{ blocking: isBlocking }} />
    }
    return <App />
  }

  if (mode === 'signup') return <Signup onSwitchToLogin={() => setMode('login')} onBack={() => setMode(null)} />
  if (mode === 'login')  return <Login  onSwitchToSignup={() => setMode('signup')} onBack={() => setMode(null)} />

  return <Landing onLogin={() => setMode('login')} onSignup={() => setMode('signup')} />
}
