import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const styles = {
  wrap: { minHeight:'100vh', display:'grid', placeItems:'center', padding:24, background:'#FAF7F2', fontFamily:'system-ui,sans-serif' },
  box:  { textAlign:'center', color:'#3D3028' },
  err:  { color:'#991b1b', maxWidth:420 },
}

export default function AuthCallback() {
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) { setError(error.message); return }
      // Session OK (détectée automatiquement via detectSessionInUrl).
      // On nettoie l'URL et on ramène l'utilisateur à l'accueil.
      window.history.replaceState({}, '', '/')
      window.location.reload()
    })
  }, [])

  return (
    <div style={styles.wrap}>
      <div style={styles.box}>
        {error
          ? <div style={styles.err}>Erreur d'authentification : {error}</div>
          : <div>Connexion en cours…</div>}
      </div>
    </div>
  )
}
