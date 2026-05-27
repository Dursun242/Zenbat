import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  // Drapeau ref pour distinguer une déconnexion volontaire (clic bouton
  // « Se déconnecter ») d'un SIGNED_OUT spontané émis par supabase-js
  // (refresh interne raté, bfcache Safari long, etc.).
  const explicitSignOutRef = useRef(false)

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000)
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch((e) => console.error('[auth] getSession failed:', e?.message))
      .finally(() => { clearTimeout(timeout); setLoading(false) })

    // Sur SIGNED_OUT spontané (non déclenché par notre bouton), on tente
    // d'abord un refreshSession() : sur Safari après bfcache long, le
    // timer interne de refresh peut rater alors que le token est encore
    // valide en DB. Sans ce filet, l'utilisateur tombe sur la Landing et
    // perd son travail. Échec confirmé → SIGNED_OUT honoré.
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)

      if (event === 'SIGNED_OUT' && !explicitSignOutRef.current) {
        try {
          const { data: r, error } = await supabase.auth.refreshSession()
          if (!error && r?.session) {
            setSession(r.session)
            return
          }
        } catch (e) {
          console.warn('[auth] refresh retry failed:', e?.message)
        }
      }
      explicitSignOutRef.current = false
      setSession(s)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signInWithPassword = useCallback((email, password) =>
    supabase.auth.signInWithPassword({ email, password }), [])

  const signUpWithPassword = useCallback((email, password, metadata) =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    }), [])

  const signOut = useCallback(() => {
    explicitSignOutRef.current = true
    return supabase.auth.signOut()
  }, [])

  const resetPasswordForEmail = useCallback((email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    }), [])

  const updatePassword = useCallback(async (password) => {
    const res = await supabase.auth.updateUser({ password })
    if (!res.error) setRecovery(false)
    return res
  }, [])

  const resendConfirmation = useCallback(async () => {
    const email = session?.user?.email
    if (!email) return { error: { message: "Email introuvable" } }
    return supabase.auth.resend({ type: 'signup', email })
  }, [session])

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    recovery,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    resetPasswordForEmail,
    updatePassword,
    resendConfirmation,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
