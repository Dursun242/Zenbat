import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'

const styles = {
  wrap:   { minHeight:'100vh', display:'grid', placeItems:'center', padding:24, background:'#f8fafc', fontFamily:'system-ui,sans-serif' },
  card:   { width:'100%', maxWidth:460, background:'#fff', borderRadius:16, padding:32, boxShadow:'0 8px 24px rgba(15,23,42,.08)' },
  title:  { margin:0, fontSize:24, fontWeight:700, color:'#0f172a' },
  sub:    { marginTop:4, marginBottom:20, fontSize:14, color:'#64748b' },
  section:{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'1px', marginTop:18, marginBottom:10 },
  label:  { display:'block', fontSize:12, fontWeight:600, color:'#334155', marginBottom:6 },
  hint:   { fontSize:11, color:'#94a3b8', marginTop:4 },
  input:  { width:'100%', padding:'12px 14px', border:'1px solid #e2e8f0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' },
  row:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  btn:    { width:'100%', padding:'12px 14px', border:0, borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', background:'#0f172a', color:'#fff', marginTop:20 },
  err:    { background:'#fef2f2', color:'#991b1b', padding:10, borderRadius:10, fontSize:13, marginTop:12 },
  ok:     { background:'#ecfdf5', color:'#065f46', padding:10, borderRadius:10, fontSize:13, marginTop:12 },
  switch: { textAlign:'center', marginTop:20, fontSize:13, color:'#64748b' },
  link:   { color:'#1d4ed8', background:'none', border:0, cursor:'pointer', fontWeight:600, padding:0 },
  back:   { background:'none', border:0, color:'#64748b', fontSize:13, cursor:'pointer', padding:0, marginBottom:12 },
}

export default function Signup({ onSwitchToLogin, onBack }) {
  const { signUpWithPassword } = useAuth()
  const [fullName, setFullName] = useState('')
  const [company, setCompany]   = useState('')
  const [siret, setSiret]       = useState('')
  const [phone, setPhone]       = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity]         = useState('')
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
      siret,
      phone,
      postal_code: postalCode,
      city,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        {onBack && !sent && (
          <button type="button" style={styles.back} onClick={onBack}>← Retour</button>
        )}
        <h1 style={styles.title}>Créer un compte</h1>
        <p style={styles.sub}>30 jours d'essai, aucune carte bancaire. Ces infos préremplissent vos devis.</p>

        {sent ? (
          <div style={styles.ok}>
            Compte créé ! Un email de confirmation vous a été envoyé à <b>{email}</b>. Cliquez sur le lien pour activer votre compte.
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div style={styles.section}>Vous</div>
            <label style={styles.label}>Nom complet *</label>
            <input required value={fullName} onChange={e=>setFullName(e.target.value)} style={styles.input} autoComplete="name" />

            <div style={styles.section}>Votre entreprise</div>
            <label style={styles.label}>Nom de l'entreprise *</label>
            <input required value={company} onChange={e=>setCompany(e.target.value)} style={styles.input} autoComplete="organization" placeholder="Ex : Maçonnerie Dupont SAS" />
            <div style={{height:10}}/>
            <label style={styles.label}>SIRET</label>
            <input
              value={siret}
              onChange={e=>setSiret(e.target.value.replace(/\D/g,'').slice(0,14))}
              style={styles.input}
              inputMode="numeric"
              placeholder="14 chiffres"
            />
            <div style={styles.hint}>Utilisé sur vos devis PDF — modifiable plus tard.</div>
            <div style={{height:10}}/>
            <label style={styles.label}>Téléphone pro</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} style={styles.input} autoComplete="tel" placeholder="06 12 34 56 78" />
            <div style={{height:10}}/>
            <div style={styles.row}>
              <div>
                <label style={styles.label}>Code postal</label>
                <input
                  value={postalCode}
                  onChange={e=>setPostalCode(e.target.value.replace(/\D/g,'').slice(0,5))}
                  style={styles.input}
                  inputMode="numeric"
                  placeholder="76600"
                />
              </div>
              <div>
                <label style={styles.label}>Ville</label>
                <input value={city} onChange={e=>setCity(e.target.value)} style={styles.input} autoComplete="address-level2" placeholder="Le Havre" />
              </div>
            </div>

            <div style={styles.section}>Vos accès</div>
            <label style={styles.label}>Email *</label>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={styles.input} autoComplete="email" />
            <div style={{height:10}}/>
            <label style={styles.label}>Mot de passe * (min. 6 caractères)</label>
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
