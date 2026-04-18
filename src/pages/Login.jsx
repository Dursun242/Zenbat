import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'

const styles = {
  wrap:   { minHeight:'100vh', display:'grid', placeItems:'center', padding:24, background:'#f8fafc', fontFamily:'system-ui,sans-serif' },
  card:   { width:'100%', maxWidth:420, background:'#fff', borderRadius:16, padding:32, boxShadow:'0 8px 24px rgba(15,23,42,.08)' },
  title:  { margin:0, fontSize:24, fontWeight:700, color:'#0f172a' },
  sub:    { marginTop:4, marginBottom:24, fontSize:14, color:'#64748b' },
  label:  { display:'block', fontSize:12, fontWeight:600, color:'#334155', marginBottom:6 },
  input:  { width:'100%', padding:'12px 14px', border:'1px solid #e2e8f0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' },
  btn:    { width:'100%', padding:'12px 14px', border:0, borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer' },
  primary:{ background:'#0f172a', color:'#fff', marginTop:16 },
  google: { background:'#fff', color:'#0f172a', border:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginTop:12 },
  err:    { background:'#fef2f2', color:'#991b1b', padding:10, borderRadius:10, fontSize:13, marginTop:12 },
  row:    { display:'flex', alignItems:'center', gap:12, margin:'20px 0', color:'#94a3b8', fontSize:12 },
  hr:     { flex:1, height:1, background:'#e2e8f0' },
  switch: { textAlign:'center', marginTop:20, fontSize:13, color:'#64748b' },
  link:   { color:'#1d4ed8', background:'none', border:0, cursor:'pointer', fontWeight:600, padding:0 },
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.7 1.22 9.18 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
)

export default function Login({ onSwitchToSignup }) {
  const { signInWithPassword, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null); setLoading(true)
    const { error } = await signInWithPassword(email, password)
    setLoading(false)
    if (error) setError(error.message === 'Invalid login credentials' ? 'Identifiants incorrects.' : error.message)
  }

  const onGoogle = async () => {
    setError(null); setLoading(true)
    const { error } = await signInWithGoogle()
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Se connecter</h1>
        <p style={styles.sub}>Accédez à votre espace Zenbat.</p>

        <button onClick={onGoogle} disabled={loading} style={{...styles.btn, ...styles.google}}>
          <GoogleIcon /> Continuer avec Google
        </button>

        <div style={styles.row}><div style={styles.hr}/>ou<div style={styles.hr}/></div>

        <form onSubmit={onSubmit}>
          <label style={styles.label}>Email</label>
          <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={styles.input} autoComplete="email" />
          <div style={{height:12}}/>
          <label style={styles.label}>Mot de passe</label>
          <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} style={styles.input} autoComplete="current-password" />
          {error && <div style={styles.err}>{error}</div>}
          <button type="submit" disabled={loading} style={{...styles.btn, ...styles.primary, opacity:loading?0.6:1}}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <div style={styles.switch}>
          Pas encore de compte ?{' '}
          <button type="button" style={styles.link} onClick={onSwitchToSignup}>Créer un compte</button>
        </div>
      </div>
    </div>
  )
}
