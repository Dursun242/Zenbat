-- ═══════════════════════════════════════════════════════════════════
-- Migration B2Brouter → Super PDP (v0 — single shared sandbox)
--
-- IDEMPOTENTE — gère les 3 cas :
--   1. b2b_accounts existe (migration 0005 complète, B2Brouter installé)
--      → rename vers pdp_accounts + rename colonnes invoices.b2brouter_*
--   2. ni b2b_accounts ni pdp_accounts (0005 partielle, B2Brouter jamais
--      branché) → create pdp_accounts from scratch + add colonnes invoices
--   3. pdp_accounts existe déjà (re-run de 0039) → noop sur la struct,
--      add column if not exists pour les ajouts v0/v1
-- ═══════════════════════════════════════════════════════════════════

-- 1. Renommer b2b_accounts → pdp_accounts si l'ancienne existe
do $$
begin
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'b2b_accounts'
  ) then
    alter table public.b2b_accounts rename to pdp_accounts;
  end if;
end $$;

-- 2. Créer pdp_accounts si elle n'existe pas (cas où 0005 partielle)
create table if not exists public.pdp_accounts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references auth.users(id) on delete cascade,
  siren       text,
  environment text not null default 'staging' check (environment in ('staging','production')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3. Renommer la colonne b2brouter_account_id → pdp_account_id si elle existe
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'pdp_accounts'
      and column_name  = 'b2brouter_account_id'
  ) then
    alter table public.pdp_accounts rename column b2brouter_account_id to pdp_account_id;
  end if;
end $$;

-- 4. Ajouter pdp_account_id si elle n'existe pas (cas table créée from scratch)
alter table public.pdp_accounts
  add column if not exists pdp_account_id text;

-- 5. Ajouter les colonnes utiles dès maintenant + celles destinées à v1 (nullable)
alter table public.pdp_accounts
  add column if not exists provider                text not null default 'superpdp'
    check (provider in ('superpdp')),
  add column if not exists client_id               text,
  add column if not exists encrypted_client_secret bytea,
  add column if not exists secret_iv               bytea,
  add column if not exists secret_tag              bytea,
  add column if not exists access_token            text,
  add column if not exists token_expires_at        timestamptz,
  add column if not exists company_siren           text,
  add column if not exists company_env             text;

-- pdp_account_id nullable (v0 sandbox partagé : pas d'id par artisan)
alter table public.pdp_accounts alter column pdp_account_id drop not null;

-- 6. Sur invoices : renommer les anciennes colonnes B2Brouter si elles existent
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoices' and column_name = 'b2brouter_invoice_id'
  ) then
    alter table public.invoices rename column b2brouter_invoice_id to pdp_invoice_id;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoices' and column_name = 'b2brouter_status'
  ) then
    alter table public.invoices rename column b2brouter_status to pdp_status;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoices' and column_name = 'b2brouter_last_event'
  ) then
    alter table public.invoices rename column b2brouter_last_event to pdp_last_event;
  end if;
end $$;

-- 7. Garantir les colonnes pdp_* sur invoices (cas où elles n'existaient pas du tout)
alter table public.invoices
  add column if not exists pdp_invoice_id text,
  add column if not exists pdp_status     text,
  add column if not exists pdp_last_event timestamptz,
  add column if not exists pdp_status_raw text;

-- 8. Renommer ou créer l'index sur pdp_invoice_id
do $$
begin
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'invoices_b2b_idx'
  ) then
    alter index public.invoices_b2b_idx rename to invoices_pdp_idx;
  end if;
end $$;
create index if not exists invoices_pdp_idx on public.invoices(pdp_invoice_id);

-- 9. RLS + policies (DROP/CREATE pour être indépendant de PG version)
alter table public.pdp_accounts enable row level security;

drop policy if exists "b2b_accounts_select_own" on public.pdp_accounts;
drop policy if exists "b2b_accounts_insert_own" on public.pdp_accounts;
drop policy if exists "b2b_accounts_update_own" on public.pdp_accounts;
drop policy if exists "pdp_accounts_select_own" on public.pdp_accounts;
drop policy if exists "pdp_accounts_insert_own" on public.pdp_accounts;
drop policy if exists "pdp_accounts_update_own" on public.pdp_accounts;

create policy "pdp_accounts_select_own" on public.pdp_accounts
  for select using (auth.uid() = owner_id);

create policy "pdp_accounts_insert_own" on public.pdp_accounts
  for insert with check (auth.uid() = owner_id);

create policy "pdp_accounts_update_own" on public.pdp_accounts
  for update using (auth.uid() = owner_id);

-- 10. Trigger updated_at
drop trigger if exists t_b2b_accounts_updated on public.pdp_accounts;
drop trigger if exists t_pdp_accounts_updated on public.pdp_accounts;
create trigger t_pdp_accounts_updated before update on public.pdp_accounts
  for each row execute function public.touch_updated_at();

-- 11. Table d'état global du polling (single-row, sentinelle id=1)
--     En v0 on a un seul curseur partagé pour toute l'instance Zenbat ;
--     en v1 (multi-tenant) on stockera un curseur par pdp_accounts.owner_id.
create table if not exists public.pdp_state (
  id              int primary key check (id = 1),
  last_event_id   bigint not null default 0,
  last_synced_at  timestamptz,
  updated_at      timestamptz not null default now()
);

insert into public.pdp_state (id, last_event_id) values (1, 0)
  on conflict (id) do nothing;

drop trigger if exists t_pdp_state_updated on public.pdp_state;
create trigger t_pdp_state_updated before update on public.pdp_state
  for each row execute function public.touch_updated_at();

-- pdp_state est lu/écrit uniquement côté serveur (service_role) — on n'expose
-- pas de policy pour les utilisateurs authentifiés.
alter table public.pdp_state enable row level security;
