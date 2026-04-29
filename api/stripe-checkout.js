// Crée une session Stripe Checkout et renvoie l'URL de redirection.
// POST /api/stripe-checkout
// Body : { plan: "monthly" | "biannual" }

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { cors } from './_cors.js'

const PLAN_CONFIG = {
  monthly: {
    productId:     'prod_UQOVWM1dF9ZGKs',
    unitAmount:    1900,   // 19,00 € HT en centimes
    interval:      'month',
    intervalCount: 1,
    biannual:      false,
  },
  biannual: {
    productId:     'prod_UQOWyWNR0hPe0M',
    unitAmount:    5700,   // 57,00 € HT en centimes
    interval:      'month',
    intervalCount: 6,
    biannual:      true,   // cancel_at_period_end activé via webhook
  },
}

function appUrl(req) {
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (origins.length) return origins[0].replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:5173'
}

export default async function handler(req, res) {
  cors(req, res, { methods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeKey   = process.env.STRIPE_SECRET_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Config Supabase manquante' })
  if (!stripeKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY non configurée' })

  const { plan } = req.body || {}
  const cfg = PLAN_CONFIG[plan]
  if (!cfg) return res.status(400).json({ error: "Plan invalide (monthly | biannual)" })

  const admin  = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' })

  // Identifie l'utilisateur
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

  // Récupère ou crée le customer Stripe
  const { data: profile } = await admin.from('profiles').select('stripe_customer_id, company_name, full_name').eq('id', user.id).maybeSingle()
  let customerId = profile?.stripe_customer_id || null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email,
      name:     profile?.company_name || profile?.full_name || user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const base = appUrl(req)

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    mode:                 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency:   'eur',
        product:    cfg.productId,
        unit_amount: cfg.unitAmount,
        recurring:  { interval: cfg.interval, interval_count: cfg.intervalCount },
      },
      quantity: 1,
    }],
    subscription_data: {
      metadata: { plan, supabase_user_id: user.id },
    },
    success_url: `${base}/app?stripe=success`,
    cancel_url:  `${base}/app?stripe=cancel`,
    locale:      'fr',
  })

  return res.status(200).json({ url: session.url })
}
