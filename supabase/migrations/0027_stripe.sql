-- Colonnes Stripe sur profiles
-- Appliquée manuellement dans le SQL Editor Supabase.

alter table profiles
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text;

create index if not exists profiles_stripe_customer_id_idx
  on profiles (stripe_customer_id);
