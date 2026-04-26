create table if not exists newsletter_subscribers (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null unique,
  source     text        not null default 'landing',
  created_at timestamptz not null default now()
);

alter table newsletter_subscribers enable row level security;

-- Tout le monde peut s'inscrire (formulaire public)
create policy "public_insert" on newsletter_subscribers
  for insert with check (true);

-- Lecture interdite pour les rôles anon/authenticated (admin passe via service role)
create policy "no_select" on newsletter_subscribers
  for select using (false);
