-- ═══════════════════════════════════════════════════════════════════
-- Journal d'audit (qui-quoi-quand) sur devis + factures
-- Utilité :
--   • Piste d'audit lisible en cas de litige / contrôle fiscal.
--   • Traçabilité des transitions de statut (brouillon → envoyé → accepté…).
--   • Support client (comprendre une modification d'une ligne).
--
-- Portée : on logge INSERT / UPDATE / DELETE sur devis, lignes_devis,
-- invoices, lignes_invoices. Le diff stocké est jsonb old + new.
--
-- RLS : l'utilisateur lit ses propres lignes. L'admin via service_role.
-- Les triggers sont SECURITY DEFINER → l'auth.uid() peut être NULL dans
-- certains contextes (cron, service_role), d'où la tolérance.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users(id) on delete set null,
  table_name  text not null,
  row_id      uuid not null,
  action      text not null check (action in ('insert','update','delete')),
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_owner_created_idx
  on public.activity_log(owner_id, created_at desc);
create index if not exists activity_log_row_idx
  on public.activity_log(table_name, row_id, created_at desc);

alter table public.activity_log enable row level security;

-- L'utilisateur lit uniquement ses propres entrées (support + RGPD).
drop policy if exists "activity_log_select_own" on public.activity_log;
create policy "activity_log_select_own" on public.activity_log
  for select using (auth.uid() = owner_id);

-- Personne ne peut insérer/modifier/supprimer côté client : uniquement
-- les triggers SECURITY DEFINER.
drop policy if exists "activity_log_no_write" on public.activity_log;
create policy "activity_log_no_write" on public.activity_log
  for all using (false) with check (false);

-- ─── Trigger générique de logging ──────────────────────────────────
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner  uuid;
  v_row_id uuid;
begin
  -- Récupère l'owner_id depuis la ligne (NEW en INSERT/UPDATE, OLD en DELETE)
  if tg_op = 'DELETE' then
    v_owner  := coalesce(old.owner_id, null);
    v_row_id := coalesce((old.id)::uuid, null);
  else
    v_owner  := coalesce(new.owner_id, null);
    v_row_id := coalesce((new.id)::uuid, null);
  end if;

  insert into public.activity_log (owner_id, table_name, row_id, action, old_data, new_data)
  values (
    coalesce(v_owner, auth.uid()),
    tg_table_name,
    v_row_id,
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- ─── Branchement des triggers ──────────────────────────────────────
drop trigger if exists t_devis_audit            on public.devis;
drop trigger if exists t_lignes_devis_audit     on public.lignes_devis;
drop trigger if exists t_invoices_audit         on public.invoices;
drop trigger if exists t_lignes_invoices_audit  on public.lignes_invoices;

create trigger t_devis_audit
  after insert or update or delete on public.devis
  for each row execute function public.log_activity();

create trigger t_lignes_devis_audit
  after insert or update or delete on public.lignes_devis
  for each row execute function public.log_activity();

create trigger t_invoices_audit
  after insert or update or delete on public.invoices
  for each row execute function public.log_activity();

create trigger t_lignes_invoices_audit
  after insert or update or delete on public.lignes_invoices
  for each row execute function public.log_activity();

-- ─── Extension de la purge RGPD : activity_log > 3 ans ────────────
-- On étend la fonction de purge créée en 0011 pour y inclure le
-- journal d'audit. CREATE OR REPLACE garde la même signature.
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
  v_audit_purged    int;
begin
  with deleted as (
    delete from public.invoices
     where (deleted_at is not null and deleted_at < now() - interval '10 years')
        or (deleted_at is not null and statut = 'brouillon' and deleted_at < now() - interval '30 days')
    returning 1
  )
  select count(*) into v_invoices_purged from deleted;

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

  -- Activity log : 3 ans glissants (bonne pratique, couvre les litiges
  -- commerciaux habituels tout en restant sous les seuils RGPD).
  with d4 as (
    delete from public.activity_log
     where created_at < now() - interval '3 years'
    returning 1
  )
  select count(*) into v_audit_purged from d4;

  raise notice 'Zenbat retention purge : invoices=% devis=% ia_conv=% ia_err=% ia_neg=% audit=%',
               v_invoices_purged, v_devis_purged, v_conv_purged, v_err_purged, v_neg_purged, v_audit_purged;
end;
$$;
