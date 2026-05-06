-- 0036_trial_devis_daily_limit.sql
-- Limite côté DB la création de devis à 5/jour pendant la période d'essai
-- (plan = 'free' ET compte créé il y a moins de 30 jours).
--
-- Complète l'enforcement frontend (useDevis.js) — empêche le bypass via
-- appel direct à l'API Supabase.
--
-- À appliquer manuellement dans le SQL Editor Supabase (cf. CLAUDE.md).

-- 1. Helper : l'utilisateur est-il en période d'essai active ?
create or replace function public.is_in_trial(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(p.plan, 'free') = 'free'
     and u.created_at > (now() - interval '30 days')
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = uid;
$$;

revoke all on function public.is_in_trial(uuid) from public;
grant execute on function public.is_in_trial(uuid) to authenticated;

-- 2. Helper : nombre de devis créés aujourd'hui (timezone Europe/Paris)
--    pour un owner donné. SECURITY DEFINER pour bypasser RLS lors du
--    comptage (sinon récursion infinie sur public.devis).
create or replace function public.devis_today_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.devis
  where owner_id = uid
    and created_at >= (
      date_trunc('day', (now() at time zone 'Europe/Paris'))
      at time zone 'Europe/Paris'
    );
$$;

revoke all on function public.devis_today_count(uuid) from public;
grant execute on function public.devis_today_count(uuid) to authenticated;

-- 3. Policy RESTRICTIVE qui s'ajoute à devis_insert_own.
--    Une policy restrictive doit ÊTRE VRAIE en plus des policies permissives.
--    Donc l'insertion est autorisée si :
--      - l'utilisateur n'est PAS en essai (Pro ou jour 31+) → pas de limite
--      - OU il est en essai mais avec moins de 5 devis aujourd'hui
drop policy if exists "devis_insert_trial_daily_limit" on public.devis;
create policy "devis_insert_trial_daily_limit"
  on public.devis
  as restrictive
  for insert
  to authenticated
  with check (
    not public.is_in_trial(owner_id)
    or public.devis_today_count(owner_id) < 5
  );
