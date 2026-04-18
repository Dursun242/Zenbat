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
  ok:     { background:'#ecfdf5', color:'#065f46', padding:10, borderRadius:10, fontSize:13, marginTop:12 },
  switch: { textAlign:'center', marginTop:20, fontSize:13, color:'#64748b' },
  link:   { color:'#1d4ed8', background:'none', border:0, cursor:'pointer', fontWeight:600, padding:0 },
}

export default function Signup({ onSwitchToLogin }) {
  const { signUpWithPassword } = useAuth()
  const [fullName, setFullName] = useState('')
  const [company, setCompany]   = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [sent, setSent]         = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null); setLoading(true)
    const { error } = await signUpWithPassword(email, password, {
      full_name: fullName,
      company_name: company,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Créer un compte</h1>
        <p style={styles.sub}>14 jours d'essai, aucune carte bancaire.</p>

        {sent ? (
          <div style={styles.ok}>
            Compte créé ! Un email de confirmation vous a été envoyé à <b>{email}</b>. Cliquez sur le lien pour activer votre compte.
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <label style={styles.label}>Nom complet</label>
            <input required value={fullName} onChange={e=>setFullName(e.target.value)} style={styles.input} autoComplete="name" />
            <div style={{height:12}}/>
            <label style={styles.label}>Entreprise</label>
            <input value={company} onChange={e=>setCompany(e.target.value)} style={styles.input} autoComplete="organization" />
            <div style={{height:12}}/>
            <label style={styles.label}>Email</label>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={styles.input} autoComplete="email" />
            <div style={{height:12}}/>
            <label style={styles.label}>Mot de passe (min. 6 caractères)</label>
            <input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} style={styles.input} autoComplete="new-password" />
            {error && <div style={styles.err}>{error}</div>}
            <button type="submit" disabled={loading} style={{...styles.btn, opacity:loading?0.6:1}}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>
        )}

        <div style={styles.switch}>
          Déjà un compte ?{' '}
          <button type="button" style={styles.link} onClick={onSwitchToLogin}>Se connecter</button>
        </div>
      </div>
    </div>
  )
}
