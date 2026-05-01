// Endpoint Stripe unifié — checkout, portal, info, webhook.
// Routage interne :
//   - Header `stripe-signature` présent → webhook (vérif HMAC + maj profil)
//   - Sinon → POST authentifié { action: 'checkout' | 'portal' | 'info', plan? }
//
// URLs externes préservées via vercel.json :
//   /api/stripe-checkout → /api/stripe
//   /api/stripe-webhook  → /api/stripe

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { cors } from './_cors.js'

// Vercel doit recevoir le body brut pour vérifier la signature Stripe.
// Pour les actions non-webhook on parse manuellement le JSON.
export const config = { api: { bodyParser: false } }

const PLAN_CONFIG = {
  monthly: {
    productName:  'Zenbat Pro — Mensuel',
    unitAmount:    1900,
    interval:      'month',
    intervalCount: 1,
    biannual:      false,
  },
  biannual: {
    productName:  'Zenbat Pro — 6 mois',
    unitAmount:    5700,
    interval:      'month',
    intervalCount: 6,
    biannual:      true,
  },
}

async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

function appUrl() {
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (origins.length) return origins[0].replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:5173'
}

async function notifyTelegram(kind, payload) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  try {
    await fetch(`${url}/functions/v1/notify-telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ kind, payload }),
    })
  } catch (err) {
    console.error('[stripe] notifyTelegram failed:', err.message)
  }
}

// ─── Webhook Stripe ──────────────────────────────────────────────────
async function handleWebhook(req, res, rawBody) {
  const stripeKey     = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) return res.status(500).json({ error: 'Config Stripe manquante' })

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' })
  const sig    = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe webhook] signature invalide:', err.message)
    return res.status(400).json({ error: `Signature invalide : ${err.message}` })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Config Supabase manquante' })

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    if (session.mode !== 'subscription') return res.status(200).json({ received: true })

    const customerId     = session.customer
    const subscriptionId = session.subscription
    const plan           = session.metadata?.plan || 'monthly'

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()

    if (!profile) {
      console.error('[stripe webhook] profil introuvable pour customer', customerId)
      return res.status(200).json({ received: true })
    }

    await admin.from('profiles').update({
      plan:                   'pro',
      stripe_subscription_id: subscriptionId,
    }).eq('id', profile.id)

    if (plan === 'biannual') {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
    }

    console.log(`[stripe webhook] checkout.completed → user ${profile.id} plan=pro (${plan})`)

    await notifyTelegram('payment_success', {
      email:  session.customer_details?.email || session.customer_email || null,
      plan,
      amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : null,
    })
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object
    const customerId   = subscription.customer

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()

    if (profile) {
      await admin.from('profiles').update({
        plan:                   'free',
        stripe_subscription_id: null,
      }).eq('id', profile.id)
      console.log(`[stripe webhook] subscription.deleted → user ${profile.id} plan=free`)

      const { data: { user } = {} } = await admin.auth.admin.getUserById(profile.id)
      await notifyTelegram('subscription_canceled', { email: user?.email || null })
    }
  }

  return res.status(200).json({ received: true })
}

// ─── Actions authentifiées (checkout, portal, info) ──────────────────
async function handleAction(req, res, rawBody) {
  cors(req, res, { methods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let body = {}
  if (rawBody.length) {
    try { body = JSON.parse(rawBody.toString('utf8')) }
    catch { return res.status(400).json({ error: 'JSON invalide' }) }
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Non authentifié' })

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    const stripeKey   = process.env.STRIPE_SECRET_KEY
    if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Config Supabase manquante' })
    if (!stripeKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY non configurée' })

    const action = body.action || 'checkout'
    const admin  = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const stripe = new Stripe(stripeKey)

    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

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

    if (action === 'portal') {
      const { data: profile } = await admin.from('profiles')
        .select('stripe_customer_id').eq('id', user.id).maybeSingle()
      const customerId = profile?.stripe_customer_id
      if (!customerId) return res.status(400).json({ error: "Aucun abonnement Stripe — passez d'abord par la souscription." })

      const base = appUrl()
      const portal = await stripe.billingPortal.sessions.create({
        customer:   customerId,
        return_url: `${base}/app?stripe=portal_return`,
      })
      return res.status(200).json({ url: portal.url })
    }

    // checkout (par défaut)
    const { plan } = body
    const cfg = PLAN_CONFIG[plan]
    if (!cfg) return res.status(400).json({ error: "Plan invalide (monthly | biannual)" })

    const { data: profile } = await admin.from('profiles').select('stripe_customer_id, company_name, full_name').eq('id', user.id).maybeSingle()
    let customerId = profile?.stripe_customer_id || null

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

    const base = appUrl()

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
    console.error('[stripe checkout] error:', err)
    const message = err?.raw?.message || err?.message || 'Erreur interne Stripe'
    return res.status(500).json({ error: message, code: err?.code || err?.type || null })
  }
}

function isWebhookRequest(req) {
  // Webhook arrive via rewrite Vercel `/api/stripe-webhook` → `/api/stripe?route=webhook`
  // ou directement avec le header `stripe-signature`.
  if (req.url) {
    const idx = req.url.indexOf('?')
    if (idx >= 0) {
      const params = new URLSearchParams(req.url.slice(idx + 1))
      if (params.get('route') === 'webhook') return true
    }
  }
  return !!req.headers['stripe-signature']
}

export default async function handler(req, res) {
  if (isWebhookRequest(req)) {
    if (req.method !== 'POST') return res.status(405).end()
    const rawBody = await getRawBody(req)
    return handleWebhook(req, res, rawBody)
  }

  // OPTIONS preflight ne lit pas le body
  if (req.method === 'OPTIONS') return handleAction(req, res, Buffer.alloc(0))
  const rawBody = await getRawBody(req)
  return handleAction(req, res, rawBody)
}
