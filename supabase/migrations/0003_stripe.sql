-- =========================================================
-- Zenbat — Champs Stripe (abonnement)
-- =========================================================
alter table public.profiles
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status    text,
  add column if not exists current_period_end     timestamptz;

create index if not exists profiles_stripe_customer_idx
  on public.profiles(stripe_customer_id);

create index if not exists profiles_stripe_subscription_idx
  on public.profiles(stripe_subscription_id);
