-- ═══════════════════════════════════════════════════════════════════
-- Intégration B2Brouter — comptes artisans + factures électroniques
-- ═══════════════════════════════════════════════════════════════════

-- 1. Compte B2Brouter de l'artisan (créé au premier passage sur Factures)
create table if not exists public.b2b_accounts (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null unique references auth.users(id) on delete cascade,
  b2brouter_account_id text not null,
  siren                text,
  environment          text not null default 'staging' check (environment in ('staging','production')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.b2b_accounts enable row level security;

drop policy if exists "b2b_accounts_select_own" on public.b2b_accounts;
create policy "b2b_accounts_select_own" on public.b2b_accounts
  for select using (auth.uid() = owner_id);

drop policy if exists "b2b_accounts_insert_own" on public.b2b_accounts;
create policy "b2b_accounts_insert_own" on public.b2b_accounts
  for insert with check (auth.uid() = owner_id);

drop policy if exists "b2b_accounts_update_own" on public.b2b_accounts;
create policy "b2b_accounts_update_own" on public.b2b_accounts
  for update using (auth.uid() = owner_id);

-- 2. Factures émises
create table if not exists public.invoices (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references auth.users(id) on delete cascade,
  devis_id               uuid references public.devis(id) on delete set null,
  client_id              uuid references public.clients(id) on delete set null,
  numero                 text not null,
  objet                  text,
  operation_type         text not null default 'service' check (operation_type in ('vente','service','mixte')),
  statut                 text not null default 'brouillon' check (statut in ('brouillon','envoyee','recue','payee','rejetee','annulee')),
  locked                 boolean not null default false,
  montant_ht             numeric(12,2) not null default 0,
  montant_tva            numeric(12,2) not null default 0,
  montant_ttc            numeric(12,2) not null default 0,
  retenue_garantie_pct   numeric(5,2) default 0,
  retenue_garantie_eur   numeric(12,2) default 0,
  date_emission          date not null default current_date,
  date_echeance          date,
  ville_chantier         text,
  notes                  text,
  pdf_path               text,
  b2brouter_invoice_id   text,
  b2brouter_status       text,
  b2brouter_last_event   timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (owner_id, numero)
);

create index if not exists invoices_owner_idx   on public.invoices(owner_id);
create index if not exists invoices_client_idx  on public.invoices(client_id);
create index if not exists invoices_statut_idx  on public.invoices(statut);
create index if not exists invoices_b2b_idx     on public.invoices(b2brouter_invoice_id);

alter table public.invoices enable row level security;

drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own" on public.invoices
  for select using (auth.uid() = owner_id);

drop policy if exists "invoices_insert_own" on public.invoices;
create policy "invoices_insert_own" on public.invoices
  for insert with check (auth.uid() = owner_id);

drop policy if exists "invoices_update_own" on public.invoices;
create policy "invoices_update_own" on public.invoices
  for update using (auth.uid() = owner_id and not locked)
  with check (auth.uid() = owner_id);

drop policy if exists "invoices_delete_own" on public.invoices;
create policy "invoices_delete_own" on public.invoices
  for delete using (auth.uid() = owner_id and not locked);

-- 3. Lignes de facture
create table if not exists public.lignes_invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  position       int  not null default 0,
  type_ligne     text not null default 'ouvrage' check (type_ligne in ('lot','ouvrage')),
  lot            text,
  designation    text not null,
  unite          text,
  quantite       numeric(12,3) default 0,
  prix_unitaire  numeric(12,2) default 0,
  tva_rate       numeric(5,2)  default 20,
  created_at     timestamptz not null default now()
);

create index if not exists lignes_invoices_idx on public.lignes_invoices(invoice_id, position);

alter table public.lignes_invoices enable row level security;

drop policy if exists "lignes_invoices_all_own" on public.lignes_invoices;
create policy "lignes_invoices_all_own" on public.lignes_invoices
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 4. Trigger updated_at pour invoices et b2b_accounts
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists t_invoices_updated on public.invoices;
create trigger t_invoices_updated before update on public.invoices
  for each row execute function public.touch_updated_at();

drop trigger if exists t_b2b_accounts_updated on public.b2b_accounts;
create trigger t_b2b_accounts_updated before update on public.b2b_accounts
  for each row execute function public.touch_updated_at();

-- 5. Séquence de numérotation : FAC-YYYY-NNNN par utilisateur
create or replace function public.next_invoice_number(p_year int default extract(year from now())::int)
returns text language plpgsql security definer set search_path = public as $$
declare
  next_seq int;
  result   text;
begin
  select coalesce(max(substring(numero from 'FAC-\d{4}-(\d+)')::int), 0) + 1
    into next_seq
    from invoices
   where owner_id = auth.uid()
     and numero like 'FAC-' || p_year || '-%';
  result := 'FAC-' || p_year || '-' || lpad(next_seq::text, 4, '0');
  return result;
end;
$$;

revoke all on function public.next_invoice_number(int) from public;
grant execute on function public.next_invoice_number(int) to authenticated;
