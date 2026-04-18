import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
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

  const signInWithGoogle = useCallback(() =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    }), [])

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
