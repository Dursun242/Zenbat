import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { saveCguAcceptance } from '../lib/api.js'
import { CGU_VERSION } from './CGU.jsx'

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

export default function Signup({ onSwitchToLogin, onBack }) {
  const { signUpWithPassword } = useAuth()
  const [firstName, setFirstName]     = useState('')
  const [lastName,  setLastName]      = useState('')
  const [company, setCompany]         = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [cguAccepted, setCguAccepted] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [sent, setSent]               = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!cguAccepted) return
    setError(null); setLoading(true)
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    const { error } = await signUpWithPassword(email, password, {
      first_name:      firstName.trim(),
      last_name:       lastName.trim(),
      full_name:       fullName,
      company_name:    company,
      cgu_version:     CGU_VERSION,
      cgu_accepted_at: new Date().toISOString(),
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    saveCguAcceptance(CGU_VERSION).catch(() => {})
    setSent(true)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        {onBack && (
          <button type="button" onClick={onBack}
            style={{background:'none',border:'none',color:'#94a3b8',fontSize:13,cursor:'pointer',padding:0,marginBottom:16,display:'flex',alignItems:'center',gap:4}}>
            ← Retour
          </button>
        )}
        <h1 style={styles.title}>Créer un compte</h1>
        <p style={styles.sub}>30 jours d'essai, aucune carte bancaire.</p>

        {sent ? (
          <div style={styles.ok}>
            Compte créé ! Un email de confirmation vous a été envoyé à <b>{email}</b>. Cliquez sur le lien pour activer votre compte.
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <label style={styles.label}>Prénom</label>
                <input required value={firstName} onChange={e=>setFirstName(e.target.value)} style={styles.input} autoComplete="given-name" />
              </div>
              <div>
                <label style={styles.label}>Nom</label>
                <input required value={lastName} onChange={e=>setLastName(e.target.value)} style={styles.input} autoComplete="family-name" />
              </div>
            </div>
            <div style={{height:12}}/>
            <label style={styles.label}>Nom de l'entreprise</label>
            <input required value={company} onChange={e=>setCompany(e.target.value)} style={styles.input} autoComplete="organization" placeholder="Ex : Aila Façade, SARL Dupont…" />
            <div style={{height:12}}/>
            <label style={styles.label}>Email</label>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={styles.input} autoComplete="email" />
            <div style={{height:12}}/>
            <label style={styles.label}>Mot de passe (min. 6 caractères)</label>
            <input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} style={styles.input} autoComplete="new-password" />

            {/* CGU */}
            <label style={{ display:'flex', alignItems:'flex-start', gap:10, marginTop:20, cursor:'pointer', userSelect:'none' }}>
              <input
                type="checkbox"
                checked={cguAccepted}
                onChange={e => setCguAccepted(e.target.checked)}
                style={{ width:16, height:16, marginTop:2, accentColor:'#0f172a', flexShrink:0, cursor:'pointer' }}
              />
              <span style={{ fontSize:13, color:'#334155', lineHeight:1.5 }}>
                J'accepte les{' '}
                <a href="/cgu" target="_blank" rel="noopener noreferrer"
                  style={{ color:'#2563eb', fontWeight:600, textDecoration:'underline' }}>
                  Conditions Générales d'Utilisation
                </a>
              </span>
            </label>

            {error && <div style={styles.err}>{error}</div>}

            <button
              type="submit"
              disabled={loading || !cguAccepted}
              style={{ ...styles.btn, opacity:(loading || !cguAccepted) ? 0.45 : 1, cursor:(loading || !cguAccepted) ? 'not-allowed' : 'pointer' }}>
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
