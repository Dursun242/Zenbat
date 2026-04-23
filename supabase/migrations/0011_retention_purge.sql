-- ═══════════════════════════════════════════════════════════════════
-- Purge automatique des données expirées (pg_cron)
-- Concilie :
--   • Conservation légale (LPF L102 B : 10 ans factures ; C. civ. : 5 ans
--     devis signés ; bonne pratique : 3 ans devis non signés).
--   • Principe RGPD de limitation de la durée (art. 5).
--   • CGU v1.1 art. 7 : logs IA conservés 12 mois glissants.
--
-- ⚠ Ce script tente d'activer pg_cron. Sur Supabase hosted l'extension
-- est disponible mais doit être activée dans le dashboard (Database →
-- Extensions → pg_cron) ; si elle ne l'est pas, la migration réussit
-- quand même (CREATE EXTENSION IF NOT EXISTS) — mais la planification
-- sera muette. Plan B : appeler manuellement la fonction `run_retention_purge()`.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

-- ─── Fonction unique de purge, tout-en-un ───────────────────────────
create or replace function public.run_retention_purge()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoices_purged int;
  v_devis_purged    int;
  v_conv_purged     int;
  v_err_purged      int;
  v_neg_purged      int;
begin
  -- 1. Factures soft-supprimées (deleted_at) + émises il y a > 10 ans.
  --    Les brouillons soft-deletés sont purgés après 30 jours (pas de
  --    valeur légale).
  with deleted as (
    delete from public.invoices
     where (deleted_at is not null and deleted_at < now() - interval '10 years')
        or (deleted_at is not null and statut = 'brouillon' and deleted_at < now() - interval '30 days')
    returning 1
  )
  select count(*) into v_invoices_purged from deleted;

  -- 2. Devis soft-supprimés :
  --    - Brouillons et refus supprimés il y a > 30 jours → purge.
  --    - Devis signés (accepte) soft-deletés > 5 ans → purge (5 ans civ).
  --    - Devis envoyés > 3 ans → purge (prescription commerciale courte).
  with deleted as (
    delete from public.devis
     where deleted_at is not null
       and (
         (statut in ('brouillon','refuse') and deleted_at < now() - interval '30 days')
         or (statut = 'envoye'             and deleted_at < now() - interval '3 years')
         or (statut in ('accepte','en_signature') and deleted_at < now() - interval '5 years')
       )
    returning 1
  )
  select count(*) into v_devis_purged from deleted;

  -- 3. Journaux IA : conservation 12 mois glissants (CGU v1.1 art. 7).
  with d1 as (
    delete from public.ia_conversations
     where created_at < now() - interval '12 months'
    returning 1
  )
  select count(*) into v_conv_purged from d1;

  with d2 as (
    delete from public.ia_error_logs
     where created_at < now() - interval '12 months'
    returning 1
  )
  select count(*) into v_err_purged from d2;

  with d3 as (
    delete from public.ia_negative_logs
     where created_at < now() - interval '12 months'
    returning 1
  )
  select count(*) into v_neg_purged from d3;

  raise notice 'Zenbat retention purge : invoices=% devis=% ia_conv=% ia_err=% ia_neg=%',
               v_invoices_purged, v_devis_purged, v_conv_purged, v_err_purged, v_neg_purged;
end;
$$;

revoke all on function public.run_retention_purge() from public;
-- (pas d'exécution pour `authenticated` : c'est une tâche système.)

-- ─── Planification mensuelle via pg_cron ───────────────────────────
-- Tente d'enregistrer le job ; si pg_cron n'est pas active, l'appel
-- échouera mais sera muet (wrapped dans un bloc anonyme qui capture
-- l'erreur). Sur Supabase, le schema pg_cron s'appelle `cron`.
do $$
begin
  -- Nettoyage préalable d'éventuels jobs homonymes créés par une ancienne
  -- version de cette migration.
  perform 1
    from pg_extension
   where extname = 'pg_cron';
  if found then
    perform cron.unschedule(jobid)
      from cron.job
     where jobname = 'zenbat_retention_purge';
    -- Tous les 1er du mois à 03:00 UTC
    perform cron.schedule(
      'zenbat_retention_purge',
      '0 3 1 * *',
      $cron$ select public.run_retention_purge(); $cron$
    );
  end if;
exception when others then
  raise notice 'pg_cron non disponible — run_retention_purge() devra être appelée manuellement.';
end $$;
