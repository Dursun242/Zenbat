import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { ZB } from '../lib/theme.js'

const styles = {
  wrap:   { minHeight:'100vh', display:'grid', placeItems:'center', padding:'24px 16px', background:ZB.paper, fontFamily:ZB.font, color:ZB.ink },
  card:   { width:'100%', maxWidth:420, background:ZB.sheet, border:`1px solid ${ZB.rule}`, borderRadius:8, padding:'24px 20px' },
  title:  { margin:0, fontSize:24, fontWeight:700, color:ZB.ink, letterSpacing:'-0.01em' },
  sub:    { marginTop:6, marginBottom:20, fontSize:15, color:ZB.ink2, lineHeight:1.45 },
  label:  { display:'block', fontSize:14, fontWeight:600, color:ZB.ink2, marginBottom:6 },
  input:  { width:'100%', minHeight:48, padding:'0 12px', border:`1px solid ${ZB.field}`, borderRadius:8, background:ZB.sheet, fontFamily:'inherit', fontSize:16, color:ZB.ink, outline:'none', boxSizing:'border-box' },
  btn:    { width:'100%', minHeight:52, border:0, borderRadius:10, fontFamily:'inherit', fontSize:16, fontWeight:700, cursor:'pointer', background:ZB.accent, color:ZB.sheet, marginTop:16 },
  err:    { background:ZB.dangerSoft, color:ZB.danger, padding:'10px 12px', borderRadius:8, fontSize:15, marginTop:12, lineHeight:1.45 },
  ok:     { background:ZB.stampSoft, color:ZB.ink, padding:'10px 12px', borderRadius:8, fontSize:15, marginTop:12, lineHeight:1.45 },
  switch: { textAlign:'center', marginTop:18, fontSize:15, color:ZB.ink2 },
  link:   { minHeight:44, color:ZB.accent, background:'none', border:0, cursor:'pointer', fontFamily:'inherit', fontSize:15, fontWeight:600, padding:'0 4px' },
  forgot: { marginTop:6, textAlign:'right' },
  forgotLink: { minHeight:44, color:ZB.ink2, background:'none', border:0, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:500, padding:0, textDecoration:'underline', textUnderlineOffset:3 },
}
const FOCUS_CSS = `.zb-login input:focus{border-color:${ZB.accent} !important}.zb-login button:focus-visible,.zb-login input:focus-visible{outline:2px solid ${ZB.accent};outline-offset:2px}`


export default function Login({ onSwitchToSignup, onBack }) {
  const { signInWithPassword, resetPasswordForEmail } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null); setLoading(true)
    const { error } = await signInWithPassword(email, password)
    setLoading(false)
    if (error) setError(error.message === 'Invalid login credentials' ? 'Identifiants incorrects.' : error.message)
  }

  const onForgot = async (e) => {
    e.preventDefault()
    if (!email) { setError('Saisis ton email pour recevoir le lien.'); return }
    setError(null); setLoading(true)
    const { error } = await resetPasswordForEmail(email.trim())
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  const goForgot = () => { setMode('forgot'); setError(null); setSent(false) }
  const goLogin  = () => { setMode('login');  setError(null); setSent(false) }

  return (
    <div className="zb-login" style={styles.wrap}>
      <style>{FOCUS_CSS}</style>
      <div style={styles.card}>
        {onBack && <button type="button" onClick={onBack} style={{minHeight:44,background:'none',border:'none',color:ZB.ink,fontFamily:'inherit',fontSize:15,fontWeight:600,cursor:'pointer',padding:0,marginBottom:8,display:'flex',alignItems:'center',gap:4}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Retour</button>}

        {mode === 'login' ? (
          <>
            <h1 style={styles.title}>Se connecter</h1>
            <p style={styles.sub}>Retrouve tes devis et tes factures.</p>

            <form onSubmit={onSubmit}>
              <label htmlFor="login-email" style={styles.label}>Email</label>
              <input id="login-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={styles.input} autoComplete="email" />
              <div style={{height:12}}/>
              <label htmlFor="login-password" style={styles.label}>Mot de passe</label>
              <input id="login-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} style={styles.input} autoComplete="current-password" />
              <div style={styles.forgot}>
                <button type="button" style={styles.forgotLink} onClick={goForgot}>Mot de passe oublié ?</button>
              </div>
              {error && <div role="alert" style={styles.err}>{error}</div>}
              <button type="submit" disabled={loading} style={{...styles.btn, opacity:loading?0.6:1}}>
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>

            <div style={styles.switch}>
              Pas encore de compte ?{' '}
              <button type="button" style={styles.link} onClick={onSwitchToSignup}>Créer un compte</button>
            </div>
          </>
        ) : (
          <>
            <h1 style={styles.title}>Mot de passe oublié</h1>
            <p style={styles.sub}>Saisis ton email : tu reçois un lien pour choisir un nouveau mot de passe.</p>

            {sent ? (
              <>
                <div style={styles.ok}>
                  Email envoyé à <strong>{email}</strong>. Ouvre le lien reçu pour choisir un nouveau mot de passe.
                </div>
                <button type="button" style={styles.btn} onClick={goLogin}>Retour à la connexion</button>
              </>
            ) : (
              <form onSubmit={onForgot}>
                <label htmlFor="forgot-email" style={styles.label}>Email</label>
                <input id="forgot-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={styles.input} autoComplete="email" />
                {error && <div role="alert" style={styles.err}>{error}</div>}
                <button type="submit" disabled={loading} style={{...styles.btn, opacity:loading?0.6:1}}>
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </button>
                <div style={styles.switch}>
                  <button type="button" style={styles.link} onClick={goLogin}>Revenir à la connexion</button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
