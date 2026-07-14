import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase'

const styles = {
  wrap:  { minHeight:'100vh', display:'grid', placeItems:'center', padding:24, background:'#FAF7F2', fontFamily:'system-ui,sans-serif' },
  card:  { width:'100%', maxWidth:420, background:'#fff', borderRadius:16, padding:32, boxShadow:'0 8px 24px rgba(15,23,42,.08)' },
  title: { margin:0, fontSize:24, fontWeight:700, color:'#1A1612' },
  sub:   { marginTop:4, marginBottom:24, fontSize:14, color:'#6B6358' },
  label: { display:'block', fontSize:12, fontWeight:600, color:'#3D3028', marginBottom:6 },
  input: { width:'100%', padding:'12px 14px', border:'1px solid #E8E2D8', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' },
  btn:   { width:'100%', padding:'12px 14px', border:0, borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', background:'#1A1612', color:'#fff', marginTop:16 },
  err:   { background:'#fef2f2', color:'#991b1b', padding:10, borderRadius:10, fontSize:13, marginTop:12 },
  ok:    { background:'#ecfdf5', color:'#065f46', padding:10, borderRadius:10, fontSize:13, marginTop:12 },
  hint:  { fontSize:12, color:'#9A8E82', marginTop:6 },
  spin:  { width:32, height:32, border:'3px solid #E8E2D8', borderTopColor:'#1A1612', borderRadius:'50%', margin:'8px auto 0', animation:'zb-spin .9s linear infinite' },
}

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  // 'verifying' = on établit la session de récupération depuis le lien email,
  // 'ready' = session OK, on peut saisir le nouveau mot de passe,
  // 'invalid' = lien expiré / déjà utilisé / ouvert sur un autre appareil,
  // 'done' = mot de passe changé.
  const [phase,      setPhase]      = useState('verifying')
  const [invalidMsg, setInvalidMsg] = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)

  // Établit la session de récupération à l'arrivée. Le lien de l'email peut se
  // présenter sous plusieurs formes selon le flow Supabase :
  //   - PKCE : ?code=…  (détecté/échangé automatiquement par detectSessionInUrl,
  //     mais on gère le résidu et l'échec cross-device explicitement)
  //   - OTP  : ?token_hash=…&type=recovery → verifyOtp (marche cross-appareil)
  //   - Implicite : #access_token=…&type=recovery (detectSessionInUrl)
  //   - Erreur : ?error=…&error_description=… (lien expiré / déjà cliqué)
  useEffect(() => {
    let cancelled = false
    const finish = (ok, msg) => {
      if (cancelled) return
      if (ok) setPhase('ready')
      else {
        setInvalidMsg(msg || "Ce lien de réinitialisation est invalide ou a expiré. Redemandez-en un depuis l'écran de connexion.")
        setPhase('invalid')
      }
    }

    const run = async () => {
      const url    = new URL(window.location.href)
      const params = url.searchParams
      const hash   = new URLSearchParams(url.hash.replace(/^#/, ''))

      // 1. Erreur explicite renvoyée par Supabase dans l'URL.
      const rawErr = params.get('error_description') || hash.get('error_description')
        || params.get('error') || hash.get('error')
      if (rawErr) { finish(false, decodeURIComponent(String(rawErr).replace(/\+/g, ' '))); return }

      // 2. Session déjà présente (detectSessionInUrl a fait le travail).
      const { data: s0 } = await supabase.auth.getSession()
      if (s0?.session) { finish(true); return }

      // 3. token_hash (flow OTP) — pas de code_verifier requis, marche même si
      //    le lien est ouvert sur un autre appareil/navigateur.
      const tokenHash = params.get('token_hash') || hash.get('token_hash')
      const type      = params.get('type') || hash.get('type') || 'recovery'
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        finish(!error, error?.message)
        return
      }

      // 4. code PKCE résiduel (si detectSessionInUrl ne l'a pas déjà consommé).
      const code = params.get('code')
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          finish(!error, error?.message)
        } catch (e) { finish(false, e?.message) }
        return
      }

      // 5. Rien d'exploitable tout de suite → on laisse une chance à
      //    detectSessionInUrl (asynchrone) puis on revérifie une fois.
      setTimeout(async () => {
        const { data: s1 } = await supabase.auth.getSession()
        finish(!!s1?.session)
      }, 1200)
    }
    run()

    // Filet : capte PASSWORD_RECOVERY / SIGNED_IN s'ils arrivent après coup.
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && sess) finish(true)
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

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
      setPhase('done')
      setTimeout(() => { window.location.href = '/' }, 1500)
    }
  }

  return (
    <div style={styles.wrap}>
      <style>{`@keyframes zb-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={styles.card}>
        <h1 style={styles.title}>Nouveau mot de passe</h1>

        {phase === 'verifying' && (
          <>
            <p style={styles.sub}>Vérification de votre lien de réinitialisation…</p>
            <div style={styles.spin}/>
          </>
        )}

        {phase === 'invalid' && (
          <>
            <p style={styles.sub}>Lien de réinitialisation</p>
            <div style={styles.err}>{invalidMsg}</div>
            <button type="button" style={styles.btn} onClick={() => { window.location.href = '/' }}>
              Retour à la connexion
            </button>
          </>
        )}

        {phase === 'done' && (
          <>
            <p style={styles.sub}>Choisissez un nouveau mot de passe pour votre compte Zenbat.</p>
            <div style={styles.ok}>Mot de passe mis à jour ✓ Redirection…</div>
          </>
        )}

        {phase === 'ready' && (
          <>
            <p style={styles.sub}>Choisissez un nouveau mot de passe pour votre compte Zenbat.</p>
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
          </>
        )}
      </div>
    </div>
  )
}
