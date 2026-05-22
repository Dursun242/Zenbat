-- Migration 0053 : essai Pro à durée limitée (offre "1 mois Pro gratuit").
--
-- Contexte : profiles.plan est binaire ('free' / 'pro') et n'a aucune
-- notion de durée. Pour offrir un essai Pro daté à un prospect sans avoir
-- à le repasser en Free manuellement, on ajoute un simple minuteur.
--
-- Principe : plan reste la SEULE source de vérité lue par l'app et la RLS.
-- pro_until n'est qu'une date d'échéance optionnelle ; un job pg_cron
-- quotidien repasse plan='free' quand l'échéance est dépassée. Les
-- abonnés Stripe payants ont pro_until = null → jamais touchés par le job.
--
-- ⚠ Prérequis : pg_cron doit être activé côté Supabase Dashboard →
--    Database → Extensions → pg_cron (déjà fait pour la migration 0050).

-- ─── 1. Colonne pro_until ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists pro_until timestamptz;

comment on column public.profiles.pro_until is
  'Échéance d''un essai Pro offert. NULL = Pro permanent (Stripe ou admin) '
  'ou compte Free. Le job expire_pro_trials repasse plan=free quand dépassé.';

-- ─── 2. Fonction d'expiration ────────────────────────────────────────────
-- Ne touche QUE les comptes dont pro_until est renseigné et dépassé :
-- un abonné Stripe (pro_until NULL) ou un Pro permanent admin n'est jamais
-- rétrogradé par erreur.
create or replace function public.expire_pro_trials()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.profiles
     set plan = 'free',
         pro_until = null
   where plan = 'pro'
     and pro_until is not null
     and pro_until < now();
  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

-- SECURITY DEFINER → exécute avec les droits du créateur (postgres).
-- On révoque l'accès public pour qu'aucun client authentifié ne l'appelle.
revoke all on function public.expire_pro_trials() from public;

-- ─── 3. Planification pg_cron ────────────────────────────────────────────
create extension if not exists pg_cron with schema cron;

-- Idempotent : si la migration est rejouée, on déprogramme avant de reprogrammer.
do $$
begin
  perform cron.unschedule('expire-pro-trials-daily');
exception when others then
  null; -- le job n'existait pas, on continue
end $$;

-- Tous les jours à 03:15 (heure serveur) — hors heures de pointe.
select cron.schedule(
  'expire-pro-trials-daily',
  '15 3 * * *',
  $$select public.expire_pro_trials();$$
);

-- Diagnostic :
--   SELECT * FROM cron.job WHERE jobname = 'expire-pro-trials-daily';
--   SELECT * FROM cron.job_run_details
--    WHERE jobname = 'expire-pro-trials-daily'
--    ORDER BY start_time DESC LIMIT 10;
--   SELECT id, plan, pro_until FROM public.profiles WHERE pro_until IS NOT NULL;

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0053', 'pro_trial_until', now())
on conflict (version) do nothing;
