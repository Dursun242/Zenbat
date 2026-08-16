import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    '[Zenbat] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquante. ' +
    'Vérifiez votre .env.local (dev) ou les Environment Variables Vercel (prod).'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  // Deadline globale : sans elle, une base saturée laisse chaque requête
  // pendre jusqu'au timeout TCP du navigateur (~90 s) et l'UI reste bloquée
  // sur « Chargement… » (incident Supabase 16/08). 30 s laisse de la marge
  // aux uploads Storage lents (logo, PDF) tout en bornant le pire cas.
  // Garde de compatibilité : AbortSignal.timeout absent → fetch standard.
  global: {
    fetch: (input, init = {}) => {
      if (typeof AbortSignal === 'undefined' || !AbortSignal.timeout || init.signal) {
        return fetch(input, init)
      }
      return fetch(input, { ...init, signal: AbortSignal.timeout(30_000) })
    },
  },
})
