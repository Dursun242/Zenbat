import { supabase } from "./supabase";

// Appelle /api/stripe-checkout avec le JWT Supabase, puis redirige vers Stripe.
export async function startCheckout() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Vous devez être connecté.");
  const res = await fetch("/api/stripe-checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Erreur lors de la création de la session de paiement.");
  }
  const { url } = await res.json();
  window.location.href = url;
}

// Appelle /api/stripe-portal et redirige vers le portail de gestion Stripe.
export async function openBillingPortal() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Vous devez être connecté.");
  const res = await fetch("/api/stripe-portal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Erreur lors de l'ouverture du portail.");
  }
  const { url } = await res.json();
  window.location.href = url;
}
