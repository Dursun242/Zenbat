-- 0039_freemium_weekly_limit.sql
-- Bascule du modèle « essai 30 jours » vers un modèle freemium permanent.
--
-- Avant (0036 + 0037) :
--   plan='free' AND created_at < 30j  → 5 devis/jour, sticky par appareil.
--   Après 30j : paywall systématique (plus aucune création possible).
--
-- Après (cette migration) :
--   plan='free' permanent              → 5 devis / semaine ISO (lundi 00:00
--                                         à dimanche 23:59 Europe/Paris).
--   plan='pro'                         → devis illimités + factures activées.
--   plan='free' ne peut plus créer de facture (toute version, tout délai).
--
-- Le compteur reste « sticky » : un devis supprimé compte toujours dans le
-- quota de la semaine (anti-bypass « créer 5 → supprimer → recréer »).
--
-- La colonne profiles.plan ne change pas de domaine : on conserve les
-- valeurs 'free' | 'pro' (le code front lit déjà p.plan === 'free' partout).
-- 'free' signifie désormais « freemium permanent ».
--
-- À appliquer manuellement dans le SQL Editor Supabase APRÈS la 0038
-- (cf. CLAUDE.md — migrations non auto-appliquées).

-- ─── 1. Helper : début de semaine ISO (lundi) en Europe/Paris ─────────
create or replace function public.current_week_start()
returns date
language sql
stable
as $$
  select date_trunc('week', (now() at time zone 'Europe/Paris'))::date;
$$;

revoke all on function public.current_week_start() from public;
grant execute on function public.current_week_start() to authenticated;

-- ─── 2. Helper : plan effectif d'un utilisateur (bypass RLS) ──────────
--    Utilisé par les policies restrictives ci-dessous. SECURITY DEFINER
--    pour éviter toute récursion / dépendance sur la policy SELECT de
--    profiles.
create or replace function public.user_plan(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(plan, 'free') from public.profiles where id = uid;
$$;

revoke all on function public.user_plan(uuid) from public;
grant execute on function public.user_plan(uuid) to authenticated;

-- ─── 3. Table compteur sticky par semaine ────────────────────────────
create table if not exists public.devis_weekly_counters (
  owner_id   uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  count      int  not null default 0,
  primary key (owner_id, week_start)
);

alter table public.devis_weekly_counters enable row level security;

drop policy if exists "dwc_select_own" on public.devis_weekly_counters;
create policy "dwc_select_own" on public.devis_weekly_counters
  for select using (auth.uid() = owner_id);

-- ─── 4. Trigger d'incrément (sticky : pas de décrément à la DELETE) ──
create or replace function public.incr_devis_weekly_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  w date := public.current_week_start();
begin
  insert into public.devis_weekly_counters (owner_id, week_start, count)
  values (new.owner_id, w, 1)
  on conflict (owner_id, week_start)
    do update set count = public.devis_weekly_counters.count + 1;
  return new;
end;
$$;

drop trigger if exists devis_incr_weekly_counter on public.devis;
create trigger devis_incr_weekly_counter
  after insert on public.devis
  for each row execute function public.incr_devis_weekly_counter();

-- ─── 5. RPC : compteur de la semaine en cours ────────────────────────
create or replace function public.devis_week_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count, 0)
  from public.devis_weekly_counters
  where owner_id = uid
    and week_start = public.current_week_start();
$$;

revoke all on function public.devis_week_count(uuid) from public;
grant execute on function public.devis_week_count(uuid) to authenticated;

-- ─── 6. Backfill compteur semaine en cours ───────────────────────────
--    Initialise le compteur depuis les devis créés depuis le lundi
--    Europe/Paris. Sans ce backfill, les utilisateurs ayant déjà créé
--    des devis cette semaine bypasseraient la limite jusqu'à leur
--    prochain INSERT (qui déclenche le trigger pour la 1re fois).
insert into public.devis_weekly_counters (owner_id, week_start, count)
select owner_id,
       public.current_week_start() as week_start,
       count(*)
from public.devis
where created_at >= (public.current_week_start()::timestamp at time zone 'Europe/Paris')
group by owner_id
on conflict (owner_id, week_start) do update
  set count = greatest(public.devis_weekly_counters.count, excluded.count);

-- ─── 7. Remplacement de la policy d'essai par la policy freemium ─────
drop policy if exists "devis_insert_trial_daily_limit" on public.devis;

drop policy if exists "devis_insert_freemium_weekly_limit" on public.devis;
create policy "devis_insert_freemium_weekly_limit"
  on public.devis
  as restrictive
  for insert
  to authenticated
  with check (
    public.user_plan(owner_id) = 'pro'
    or public.devis_week_count(owner_id) < 5
  );

-- ─── 8. Factures bloquées pour les comptes freemium ──────────────────
--    Empêche la création d'une facture (INSERT direct via PostgREST,
--    via le bouton « Facturer ce devis », ou via tout autre flux) tant
--    que plan != 'pro'. Le bouton est aussi grisé côté UI.
drop policy if exists "invoices_insert_pro_only" on public.invoices;
create policy "invoices_insert_pro_only"
  on public.invoices
  as restrictive
  for insert
  to authenticated
  with check (public.user_plan(owner_id) = 'pro');

-- ─── 9. Colonne billing_cycle sur profiles ───────────────────────────
--    Stocke le cycle de facturation Stripe ('monthly' | 'biannual').
--    Renseignée par le webhook Stripe à chaque checkout.completed.
--    Pas de backfill : les Pro existants verront leur valeur arriver
--    via le prochain événement Stripe (renouvellement automatique).
alter table public.profiles
  add column if not exists billing_cycle text;

alter table public.profiles
  drop constraint if exists profiles_billing_cycle_check;
alter table public.profiles
  add constraint profiles_billing_cycle_check
  check (billing_cycle is null or billing_cycle in ('monthly', 'biannual'));

-- ─── 10. Nettoyage des objets de l'ancien essai 30 jours ─────────────
drop trigger if exists devis_incr_daily_counter on public.devis;
drop function if exists public.incr_devis_daily_counter();
drop function if exists public.is_in_trial(uuid);
drop function if exists public.devis_today_count(uuid);
drop table  if exists public.devis_daily_counters;
