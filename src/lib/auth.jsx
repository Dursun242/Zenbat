import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => {})
      .finally(() => setLoading(false))

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
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

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const resetPasswordForEmail = useCallback((email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    }), [])

  const updatePassword = useCallback(async (password) => {
    const res = await supabase.auth.updateUser({ password })
    if (!res.error) setRecovery(false)
    return res
  }, [])

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
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
