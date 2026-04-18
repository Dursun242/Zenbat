-- =========================================================
-- Zenbat — Schéma initial
-- À exécuter dans Supabase → SQL Editor, OU via la CLI :
--   supabase db push
-- =========================================================

-- Extensions
create extension if not exists "pgcrypto";

-- =========================================================
-- 1. PROFILES (lié à auth.users)
-- =========================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  full_name    text,
  phone        text,
  plan         text not null default 'free' check (plan in ('free', 'pro')),
  ai_used      int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Création auto du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- 2. CLIENTS
-- =========================================================
create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  type           text not null check (type in ('entreprise', 'particulier')),
  -- Entreprise
  raison_sociale text,
  siret          text,
  -- Particulier
  nom            text,
  prenom         text,
  -- Commun
  email          text,
  telephone      text,
  adresse        text,
  code_postal    text,
  ville          text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists clients_owner_idx on public.clients(owner_id);

-- =========================================================
-- 3. DEVIS
-- =========================================================
create table if not exists public.devis (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  numero          text not null,
  objet           text,
  ville_chantier  text,
  statut          text not null default 'brouillon'
                    check (statut in ('brouillon','envoye','en_signature','accepte','refuse')),
  montant_ht      numeric(14,2) not null default 0,
  tva_rate        numeric(5,2)  not null default 20.00,
  date_emission   date,
  date_validite   date,
  -- Signature Odoo
  odoo_sign_id    text,
  odoo_sign_url   text,
  signed_at       timestamptz,
  -- PDF dans le bucket
  pdf_path        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, numero)
);

create index if not exists devis_owner_idx  on public.devis(owner_id);
create index if not exists devis_client_idx on public.devis(client_id);
create index if not exists devis_statut_idx on public.devis(statut);

-- =========================================================
-- 4. LIGNES DE DEVIS
-- =========================================================
create table if not exists public.lignes_devis (
  id            uuid primary key default gen_random_uuid(),
  devis_id      uuid not null references public.devis(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  position      int  not null default 0,
  type_ligne    text not null check (type_ligne in ('lot','ouvrage')),
  lot           text,
  designation   text not null,
  unite         text,
  quantite      numeric(12,3) default 0,
  prix_unitaire numeric(14,2) default 0,
  created_at    timestamptz not null default now()
);

create index if not exists lignes_devis_idx on public.lignes_devis(devis_id, position);

-- =========================================================
-- 5. updated_at auto
-- =========================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists t_profiles_updated on public.profiles;
create trigger t_profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();

drop trigger if exists t_clients_updated on public.clients;
create trigger t_clients_updated before update on public.clients
  for each row execute function public.tg_set_updated_at();

drop trigger if exists t_devis_updated on public.devis;
create trigger t_devis_updated before update on public.devis
  for each row execute function public.tg_set_updated_at();

-- =========================================================
-- 6. ROW LEVEL SECURITY (chaque user ne voit que ses données)
-- =========================================================
alter table public.profiles     enable row level security;
alter table public.clients      enable row level security;
alter table public.devis        enable row level security;
alter table public.lignes_devis enable row level security;

-- profiles : lecture/modif de son propre profil
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);

-- clients
drop policy if exists "clients_select_own" on public.clients;
create policy "clients_select_own" on public.clients
  for select using (auth.uid() = owner_id);

drop policy if exists "clients_insert_own" on public.clients;
create policy "clients_insert_own" on public.clients
  for insert with check (auth.uid() = owner_id);

drop policy if exists "clients_update_own" on public.clients;
create policy "clients_update_own" on public.clients
  for update using (auth.uid() = owner_id);

drop policy if exists "clients_delete_own" on public.clients;
create policy "clients_delete_own" on public.clients
  for delete using (auth.uid() = owner_id);

-- devis
drop policy if exists "devis_select_own" on public.devis;
create policy "devis_select_own" on public.devis
  for select using (auth.uid() = owner_id);

drop policy if exists "devis_insert_own" on public.devis;
create policy "devis_insert_own" on public.devis
  for insert with check (auth.uid() = owner_id);

drop policy if exists "devis_update_own" on public.devis;
create policy "devis_update_own" on public.devis
  for update using (auth.uid() = owner_id);

drop policy if exists "devis_delete_own" on public.devis;
create policy "devis_delete_own" on public.devis
  for delete using (auth.uid() = owner_id);

-- lignes_devis
drop policy if exists "lignes_select_own" on public.lignes_devis;
create policy "lignes_select_own" on public.lignes_devis
  for select using (auth.uid() = owner_id);

drop policy if exists "lignes_insert_own" on public.lignes_devis;
create policy "lignes_insert_own" on public.lignes_devis
  for insert with check (auth.uid() = owner_id);

drop policy if exists "lignes_update_own" on public.lignes_devis;
create policy "lignes_update_own" on public.lignes_devis
  for update using (auth.uid() = owner_id);

drop policy if exists "lignes_delete_own" on public.lignes_devis;
create policy "lignes_delete_own" on public.lignes_devis
  for delete using (auth.uid() = owner_id);

-- =========================================================
-- 7. STORAGE — bucket privé pour les PDF de devis
-- =========================================================
insert into storage.buckets (id, name, public)
values ('devis-pdfs', 'devis-pdfs', false)
on conflict (id) do nothing;

-- Policies sur storage.objects (path : {owner_id}/{devis_id}.pdf)
drop policy if exists "devis_pdf_select_own" on storage.objects;
create policy "devis_pdf_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'devis-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "devis_pdf_insert_own" on storage.objects;
create policy "devis_pdf_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'devis-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "devis_pdf_update_own" on storage.objects;
create policy "devis_pdf_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'devis-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "devis_pdf_delete_own" on storage.objects;
create policy "devis_pdf_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'devis-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
