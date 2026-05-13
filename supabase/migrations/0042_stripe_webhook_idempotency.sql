-- Idempotence des webhooks Stripe.
--
-- Stripe peut retransmettre un même événement (timeout réseau, retry
-- automatique côté Stripe, etc.). Sans dédup, un `checkout.session.completed`
-- retransmis déclenche une seconde mise à jour du profil + une seconde
-- notification Telegram pour le même paiement.
--
-- Pattern : on tente d'INSERT l'event_id en clé primaire AVANT de traiter
-- l'événement. Si la contrainte unique échoue (code 23505), on a déjà
-- traité — on répond 200 et on sort sans rien refaire.
--
-- La table reste petite (purge manuelle ou via cron si besoin — 1 event
-- pèse ~50 octets, à raison de quelques events / paiement on est à <1 Mo
-- pour 10k paiements).

create table if not exists public.stripe_webhook_events (
  event_id    text primary key,
  type        text,
  received_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_received_at_idx
  on public.stripe_webhook_events (received_at desc);

-- RLS : seul le service_role écrit dans cette table (depuis api/stripe.js).
-- Aucun utilisateur final n'y accède via le client Supabase.
alter table public.stripe_webhook_events enable row level security;
