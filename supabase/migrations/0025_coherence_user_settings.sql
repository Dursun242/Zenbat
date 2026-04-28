-- Paramètres de cohérence par utilisateur : fourchettes personnalisées et règles désactivées.
-- À appliquer dans le SQL Editor de Supabase.

create table if not exists coherence_user_settings (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete cascade not null unique,
  settings   jsonb       not null default '{"global_disabled":false,"typology_overrides":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table coherence_user_settings enable row level security;

create policy "users select own coherence settings"
  on coherence_user_settings for select
  using (auth.uid() = user_id);

create policy "users insert own coherence settings"
  on coherence_user_settings for insert
  with check (auth.uid() = user_id);

create policy "users update own coherence settings"
  on coherence_user_settings for update
  using (auth.uid() = user_id);
