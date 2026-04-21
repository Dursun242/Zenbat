import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'

const styles = {
  wrap:  { minHeight:'100vh', display:'grid', placeItems:'center', padding:24, background:'#f8fafc', fontFamily:'system-ui,sans-serif' },
  card:  { width:'100%', maxWidth:420, background:'#fff', borderRadius:16, padding:32, boxShadow:'0 8px 24px rgba(15,23,42,.08)' },
  title: { margin:0, fontSize:24, fontWeight:700, color:'#0f172a' },
  sub:   { marginTop:4, marginBottom:24, fontSize:14, color:'#64748b' },
  label: { display:'block', fontSize:12, fontWeight:600, color:'#334155', marginBottom:6 },
  input: { width:'100%', padding:'12px 14px', border:'1px solid #e2e8f0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' },
  btn:   { width:'100%', padding:'12px 14px', border:0, borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', background:'#0f172a', color:'#fff', marginTop:16 },
  err:   { background:'#fef2f2', color:'#991b1b', padding:10, borderRadius:10, fontSize:13, marginTop:12 },
  ok:    { background:'#ecfdf5', color:'#065f46', padding:10, borderRadius:10, fontSize:13, marginTop:12 },
  hint:  { fontSize:12, color:'#94a3b8', marginTop:6 },
}

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const [password, setPassword]     = useState('')
  const [confirm,  setConfirm]      = useState('')
  const [loading,  setLoading]      = useState(false)
  const [error,    setError]        = useState(null)
  const [done,     setDone]         = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('8 caractères minimum.'); return }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) setError(error.message)
    else {
      setDone(true)
      setTimeout(() => { window.location.href = '/' }, 1500)
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Nouveau mot de passe</h1>
        <p style={styles.sub}>Choisissez un nouveau mot de passe pour votre compte Zenbat.</p>

        {done ? (
          <div style={styles.ok}>Mot de passe mis à jour ✓ Redirection…</div>
        ) : (
          <form onSubmit={onSubmit}>
            <label style={styles.label}>Nouveau mot de passe</label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} style={styles.input} autoComplete="new-password" />
            <div style={styles.hint}>8 caractères minimum.</div>
            <div style={{height:12}}/>
            <label style={styles.label}>Confirmer le mot de passe</label>
            <input type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)} style={styles.input} autoComplete="new-password" />
            {error && <div style={styles.err}>{error}</div>}
            <button type="submit" disabled={loading} style={{...styles.btn, opacity:loading?0.6:1}}>
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
