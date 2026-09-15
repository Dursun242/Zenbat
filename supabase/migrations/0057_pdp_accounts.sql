-- ═══════════════════════════════════════════════════════════════════
-- 0057 — Super PDP (Plateforme Agréée DGFiP) : comptes, curseur de polling,
--        colonnes de suivi sur invoices.
--
-- Contexte : reprise de l'intégration Super PDP (étape 1 = sandbox v0,
-- admin-only). Le schéma hérité B2Brouter a été supprimé par 0040, on
-- repart donc de zéro. Idempotente (IF NOT EXISTS partout) : re-jouable.
--
-- Le schéma est déjà prêt pour la v1 multi-tenant (credentials chiffrés
-- par artisan, token + curseur par utilisateur) — colonnes nullables.
--
-- Objets créés :
--   - Table public.pdp_accounts  (1 ligne par utilisateur, RLS owner)
--   - Table public.pdp_state     (curseur global de polling, row id=1, service_role only)
--   - Colonnes invoices.pdp_invoice_id / pdp_status / pdp_status_raw / pdp_last_event
--   - Index invoices_pdp_idx
-- ═══════════════════════════════════════════════════════════════════

begin;

-- 0. Fonction utilitaire updated_at (créée par 0005, redéfinie ici par sécurité)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

-- 1. Comptes Super PDP
create table if not exists public.pdp_accounts (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid not null unique references auth.users(id) on delete cascade,
  provider                text not null default 'superpdp' check (provider in ('superpdp')),
  -- v0 : identité renvoyée par GET /v1.beta/companies/me (SIREN + env sandbox/prod)
  company_siren           text,
  company_env             text,
  -- v1 (multi-tenant) : app OAuth propre à l'artisan, secret chiffré AES-GCM
  client_id               text,
  encrypted_client_secret bytea,
  secret_iv               bytea,
  secret_tag              bytea,
  access_token            text,
  token_expires_at        timestamptz,
  -- v1 : curseur de polling par utilisateur (remplacera pdp_state)
  last_event_id           bigint not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.pdp_accounts enable row level security;

drop policy if exists "pdp_accounts_select_own" on public.pdp_accounts;
drop policy if exists "pdp_accounts_insert_own" on public.pdp_accounts;
drop policy if exists "pdp_accounts_update_own" on public.pdp_accounts;

create policy "pdp_accounts_select_own" on public.pdp_accounts
  for select using (auth.uid() = owner_id);
create policy "pdp_accounts_insert_own" on public.pdp_accounts
  for insert with check (auth.uid() = owner_id);
create policy "pdp_accounts_update_own" on public.pdp_accounts
  for update using (auth.uid() = owner_id);

drop trigger if exists t_pdp_accounts_updated on public.pdp_accounts;
create trigger t_pdp_accounts_updated before update on public.pdp_accounts
  for each row execute function public.touch_updated_at();

-- 2. Suivi PA sur les factures
alter table public.invoices
  add column if not exists pdp_invoice_id text,
  add column if not exists pdp_status     text,
  add column if not exists pdp_status_raw text,
  add column if not exists pdp_last_event timestamptz;

create index if not exists invoices_pdp_idx on public.invoices(pdp_invoice_id);

-- 3. Curseur global de polling (v0 : un seul compte sandbox partagé)
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

-- Lu/écrit uniquement côté serveur (service_role) : RLS activée sans policy.
alter table public.pdp_state enable row level security;

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0057', 'pdp_accounts', now())
on conflict (version) do nothing;

commit;

-- Vérification après application :
--   SELECT * FROM public.pdp_state;
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'invoices' AND column_name LIKE 'pdp_%';
