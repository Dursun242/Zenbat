// Webhook Stripe — met à jour le plan dans Supabase.
// POST /api/stripe-webhook
// Événements gérés :
//   checkout.session.completed      → plan = 'pro'
//   customer.subscription.deleted   → plan = 'free'

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Vercel doit recevoir le body brut pour vérifier la signature Stripe.
export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk))
    req.on('end',  () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// Notification Telegram fire-and-forget. Auth via service_role key.
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
    console.error('[stripe-webhook] notifyTelegram failed:', err.message)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const stripeKey     = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) return res.status(500).json({ error: 'Config Stripe manquante' })

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' })
  const sig    = req.headers['stripe-signature']

  let event
  try {
    const rawBody = await getRawBody(req)
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] signature invalide:', err.message)
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

    // Retrouve l'utilisateur Supabase via stripe_customer_id
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()

    if (!profile) {
      console.error('[stripe-webhook] profil introuvable pour customer', customerId)
      return res.status(200).json({ received: true })
    }

    await admin.from('profiles').update({
      plan:                   'pro',
      stripe_subscription_id: subscriptionId,
    }).eq('id', profile.id)

    // Plan biannuel : pas de renouvellement automatique
    if (plan === 'biannual') {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
    }

    console.log(`[stripe-webhook] checkout.completed → user ${profile.id} plan=pro (${plan})`)

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
      console.log(`[stripe-webhook] subscription.deleted → user ${profile.id} plan=free`)

      const { data: { user } = {} } = await admin.auth.admin.getUserById(profile.id)
      await notifyTelegram('subscription_canceled', { email: user?.email || null })
    }
  }

  return res.status(200).json({ received: true })
}
