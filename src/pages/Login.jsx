import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'

const styles = {
  wrap:   { minHeight:'100vh', display:'grid', placeItems:'center', padding:24, background:'#f8fafc', fontFamily:'system-ui,sans-serif' },
  card:   { width:'100%', maxWidth:420, background:'#fff', borderRadius:16, padding:32, boxShadow:'0 8px 24px rgba(15,23,42,.08)' },
  title:  { margin:0, fontSize:24, fontWeight:700, color:'#0f172a' },
  sub:    { marginTop:4, marginBottom:24, fontSize:14, color:'#64748b' },
  label:  { display:'block', fontSize:12, fontWeight:600, color:'#334155', marginBottom:6 },
  input:  { width:'100%', padding:'12px 14px', border:'1px solid #e2e8f0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' },
  btn:    { width:'100%', padding:'12px 14px', border:0, borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', background:'#0f172a', color:'#fff', marginTop:16 },
  err:    { background:'#fef2f2', color:'#991b1b', padding:10, borderRadius:10, fontSize:13, marginTop:12 },
  switch: { textAlign:'center', marginTop:20, fontSize:13, color:'#64748b' },
  link:   { color:'#1d4ed8', background:'none', border:0, cursor:'pointer', fontWeight:600, padding:0 },
}

export default function Login({ onSwitchToSignup, onBack }) {
  const { signInWithPassword } = useAuth()
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

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        {onBack && <button type="button" onClick={onBack} style={{background:'none',border:'none',color:'#94a3b8',fontSize:13,cursor:'pointer',padding:0,marginBottom:16,display:'flex',alignItems:'center',gap:4}}>← Retour</button>}
        <h1 style={styles.title}>Se connecter</h1>
        <p style={styles.sub}>Accédez à votre espace Zenbat.</p>

        <form onSubmit={onSubmit}>
          <label style={styles.label}>Email</label>
          <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={styles.input} autoComplete="email" />
          <div style={{height:12}}/>
          <label style={styles.label}>Mot de passe</label>
          <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} style={styles.input} autoComplete="current-password" />
          {error && <div style={styles.err}>{error}</div>}
          <button type="submit" disabled={loading} style={{...styles.btn, opacity:loading?0.6:1}}>
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
