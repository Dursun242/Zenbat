-- Migration 0050 : badge "support non-lu" + purge auto des tickets >36h.
--
-- 1. Colonne support_tickets.user_last_seen_at pour différencier les messages
--    déjà vus par l'utilisateur. Le front compte les messages
--    role IN ('claude','admin') créés après user_last_seen_at pour afficher
--    le dot rouge sur le menu hamburger + sur l'item "Support".
--
-- 2. Purge automatique des tickets dont last_message_at remonte à plus de 36h.
--    Utilise pg_cron (extension Supabase). ON DELETE CASCADE supprime les
--    support_messages associés (FK déclarée dans 0030).
--
-- ⚠ Prérequis : pg_cron doit être activé côté Supabase Dashboard →
--    Database → Extensions → pg_cron (si pas déjà fait). Sinon le `create
--    extension` ci-dessous échoue.

-- ─── 1. Colonne user_last_seen_at ────────────────────────────────────────
alter table public.support_tickets
  add column if not exists user_last_seen_at timestamptz;

-- Init : on considère les tickets existants comme "vus" pour éviter qu'un
-- déploiement fasse apparaître des badges sur des conversations anciennes.
update public.support_tickets
   set user_last_seen_at = last_message_at
 where user_last_seen_at is null;

-- La policy RLS "user updates own tickets" (0030) couvre déjà tous les
-- UPDATE par le user sur ses tickets — pas besoin de modifier la RLS.

-- ─── 2. Fonction de purge ─────────────────────────────────────────────────
create or replace function public.purge_old_support_tickets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.support_tickets
   where last_message_at < now() - interval '36 hours';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- SECURITY DEFINER → exécute avec les droits du créateur (postgres).
-- On révoque l'accès public pour éviter qu'un client authentifié l'appelle.
revoke all on function public.purge_old_support_tickets() from public;

-- ─── 3. Planification pg_cron ─────────────────────────────────────────────
create extension if not exists pg_cron with schema cron;

-- Idempotent : si la migration est rejouée, on déprogramme avant de reprogrammer.
do $$
begin
  perform cron.unschedule('purge-support-tickets-36h');
exception when others then
  null; -- le job n'existait pas, on continue
end $$;

-- Tourne toutes les heures à la 5ᵉ minute (évite le pic à minute 0).
select cron.schedule(
  'purge-support-tickets-36h',
  '5 * * * *',
  $$select public.purge_old_support_tickets();$$
);

-- Diagnostic :
--   SELECT * FROM cron.job WHERE jobname = 'purge-support-tickets-36h';
--   SELECT * FROM cron.job_run_details
--    WHERE jobname = 'purge-support-tickets-36h'
--    ORDER BY start_time DESC LIMIT 10;

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0050', 'support_notif_purge', now())
on conflict (version) do nothing;
