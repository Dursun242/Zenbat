// Crée une session Stripe Checkout et renvoie l'URL de redirection.
// POST /api/stripe-checkout
// Body : { plan: "monthly" | "biannual" }

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { cors } from './_cors.js'

const PLAN_CONFIG = {
  monthly: {
    productName:  'Zenbat Pro — Mensuel',
    unitAmount:    1900,   // 19,00 € TTC en centimes
    interval:      'month',
    intervalCount: 1,
    biannual:      false,
  },
  biannual: {
    productName:  'Zenbat Pro — 6 mois',
    unitAmount:    5700,   // 57,00 € TTC en centimes
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

  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Non authentifié' })

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    const stripeKey   = process.env.STRIPE_SECRET_KEY
    if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Config Supabase manquante' })
    if (!stripeKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY non configurée' })

    const action = (req.body && req.body.action) || 'checkout'
    const admin  = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const stripe = new Stripe(stripeKey)

    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

    // ── action = 'info' : renvoie les détails d'abonnement Stripe ──────
    if (action === 'info') {
      const { data: profile } = await admin.from('profiles')
        .select('plan, stripe_customer_id, stripe_subscription_id')
        .eq('id', user.id).maybeSingle()

      const subId = profile?.stripe_subscription_id
      if (!subId) return res.status(200).json({ plan: profile?.plan || 'free', subscription: null })

      try {
        const sub = await stripe.subscriptions.retrieve(subId)
        const item = sub.items?.data?.[0]
        return res.status(200).json({
          plan: profile?.plan || 'pro',
          subscription: {
            id:                  sub.id,
            status:              sub.status,
            cancelAtPeriodEnd:   sub.cancel_at_period_end,
            currentPeriodEnd:    sub.current_period_end,
            currentPeriodStart:  sub.current_period_start,
            interval:            item?.price?.recurring?.interval || null,
            intervalCount:       item?.price?.recurring?.interval_count || null,
            unitAmount:          item?.price?.unit_amount || null,
            currency:            item?.price?.currency || 'eur',
            planLabel:           sub.metadata?.plan || null,
          },
        })
      } catch (err) {
        if (err?.code === 'resource_missing') return res.status(200).json({ plan: profile?.plan || 'free', subscription: null })
        throw err
      }
    }

    // ── action = 'portal' : redirige vers Stripe Customer Portal ───────
    if (action === 'portal') {
      const { data: profile } = await admin.from('profiles')
        .select('stripe_customer_id').eq('id', user.id).maybeSingle()
      const customerId = profile?.stripe_customer_id
      if (!customerId) return res.status(400).json({ error: "Aucun abonnement Stripe — passez d'abord par la souscription." })

      const base = appUrl(req)
      const portal = await stripe.billingPortal.sessions.create({
        customer:   customerId,
        return_url: `${base}/app?stripe=portal_return`,
      })
      return res.status(200).json({ url: portal.url })
    }

    // ── action = 'checkout' (par défaut) : crée une session Checkout ───

    const { plan } = req.body || {}
    const cfg = PLAN_CONFIG[plan]
    if (!cfg) return res.status(400).json({ error: "Plan invalide (monthly | biannual)" })

    const { data: profile } = await admin.from('profiles').select('stripe_customer_id, company_name, full_name').eq('id', user.id).maybeSingle()
    let customerId = profile?.stripe_customer_id || null

    // Vérifie que le customer stocké existe toujours côté Stripe.
    // Il peut être obsolète si la clé API a changé (rotation, test → live, autre compte).
    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId)
        if (existing?.deleted) customerId = null
      } catch (err) {
        if (err?.code === 'resource_missing') customerId = null
        else throw err
      }
    }

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
          currency:    'eur',
          product_data: { name: cfg.productName, metadata: { plan } },
          unit_amount: cfg.unitAmount,
          recurring:   { interval: cfg.interval, interval_count: cfg.intervalCount },
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
  } catch (err) {
    console.error('[stripe-checkout] error:', err)
    const message = err?.raw?.message || err?.message || 'Erreur interne Stripe Checkout'
    return res.status(500).json({ error: message, code: err?.code || err?.type || null })
  }
}
