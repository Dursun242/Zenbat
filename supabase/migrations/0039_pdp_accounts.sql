-- ═══════════════════════════════════════════════════════════════════
-- Migration B2Brouter → Super PDP (v0 — single shared sandbox)
--
-- Renames :
--   - table  b2b_accounts                 → pdp_accounts
--   - column b2brouter_account_id         → pdp_account_id
--   - column invoices.b2brouter_invoice_id → invoices.pdp_invoice_id
--   - column invoices.b2brouter_status    → invoices.pdp_status
--   - column invoices.b2brouter_last_event → invoices.pdp_last_event
--   - index  invoices_b2b_idx             → invoices_pdp_idx
--
-- Ajouts :
--   - colonnes pour le multi-tenant v1 (provider, client_id,
--     encrypted_client_secret/iv/tag, access_token cache, company_siren/env).
--     Toutes nullables — pas utilisées en v0.
--   - colonne invoices.pdp_status_raw (code AFNOR fr:200..fr:212)
--   - table  pdp_state    : curseur global du polling /v1.beta/invoice_events
-- ═══════════════════════════════════════════════════════════════════

-- 1. Renommer la table
alter table public.b2b_accounts rename to pdp_accounts;

alter table public.pdp_accounts rename column b2brouter_account_id to pdp_account_id;

-- 2. Ajouter les colonnes utiles dès maintenant + celles destinées à v1 (nullable)
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

-- pdp_account_id devient nullable car en v0 on n'en a pas pour chaque artisan
alter table public.pdp_accounts alter column pdp_account_id drop not null;

-- 3. Renommer les colonnes de invoices et ajouter pdp_status_raw
alter table public.invoices rename column b2brouter_invoice_id to pdp_invoice_id;
alter table public.invoices rename column b2brouter_status     to pdp_status;
alter table public.invoices rename column b2brouter_last_event to pdp_last_event;

alter table public.invoices
  add column if not exists pdp_status_raw text;

-- 4. Renommer l'index
alter index public.invoices_b2b_idx rename to invoices_pdp_idx;

-- 5. Renommer les policies RLS (ALTER POLICY ... RENAME nécessite PG 15+,
--    on fait DROP/CREATE pour rester compatible).
drop policy if exists "b2b_accounts_select_own" on public.pdp_accounts;
drop policy if exists "b2b_accounts_insert_own" on public.pdp_accounts;
drop policy if exists "b2b_accounts_update_own" on public.pdp_accounts;

create policy "pdp_accounts_select_own" on public.pdp_accounts
  for select using (auth.uid() = owner_id);

create policy "pdp_accounts_insert_own" on public.pdp_accounts
  for insert with check (auth.uid() = owner_id);

create policy "pdp_accounts_update_own" on public.pdp_accounts
  for update using (auth.uid() = owner_id);

-- 6. Renommer le trigger updated_at
drop trigger if exists t_b2b_accounts_updated on public.pdp_accounts;
create trigger t_pdp_accounts_updated before update on public.pdp_accounts
  for each row execute function public.touch_updated_at();

-- 7. Table d'état global du polling (single-row, sentinelle id=1)
--    En v0 on a un seul curseur partagé pour toute l'instance Zenbat ;
--    en v1 (multi-tenant) on stockera un curseur par pdp_accounts.owner_id.
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
