import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Webhook Stripe : désactiver le bodyParser pour pouvoir vérifier la signature
// sur le corps brut (Stripe signe le JSON exact reçu).
export const config = { api: { bodyParser: false } };

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: "Stripe webhook non configuré" });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];
  const raw = await readRaw(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Signature invalide : ${err.message}` });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Résout un profil via stripe_customer_id ou via metadata.supabase_user_id.
  async function resolveProfileId({ customerId, metadataUserId }) {
    if (metadataUserId) return metadataUserId;
    if (!customerId) return null;
    const { data } = await supabase
      .from("profiles").select("id").eq("stripe_customer_id", customerId).single();
    return data?.id || null;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const userId = await resolveProfileId({
          customerId: s.customer,
          metadataUserId: s.metadata?.supabase_user_id,
        });
        if (!userId) break;
        const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
        const sub = subId ? await stripe.subscriptions.retrieve(subId) : null;
        await supabase.from("profiles").update({
          plan: "pro",
          stripe_customer_id: s.customer,
          stripe_subscription_id: subId || null,
          subscription_status: sub?.status || "active",
          current_period_end: sub?.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        }).eq("id", userId);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const userId = await resolveProfileId({
          customerId: sub.customer,
          metadataUserId: sub.metadata?.supabase_user_id,
        });
        if (!userId) break;
        const active = ["active", "trialing"].includes(sub.status);
        await supabase.from("profiles").update({
          plan: active ? "pro" : "free",
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        }).eq("id", userId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = await resolveProfileId({
          customerId: sub.customer,
          metadataUserId: sub.metadata?.supabase_user_id,
        });
        if (!userId) break;
        await supabase.from("profiles").update({
          plan: "free",
          subscription_status: "canceled",
        }).eq("id", userId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    return res.status(500).json({ error: `Webhook handler error: ${err.message}` });
  }

  return res.status(200).json({ received: true });
}
