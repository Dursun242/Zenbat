-- CRM de prospection admin (usage interne, pas exposé aux utilisateurs)
-- Tables sans RLS : accès uniquement via service_role key dans l'API

create table if not exists public.prospects (
  id          uuid        primary key default gen_random_uuid(),
  nom         text        not null,
  entreprise  text,
  email       text        not null,
  telephone   text,
  ville       text,
  secteur     text,
  statut      text        not null default 'a_contacter'
                check (statut in ('a_contacter','contacte','repondu','converti','sans_suite')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.prospect_emails (
  id           uuid        primary key default gen_random_uuid(),
  prospect_id  uuid        not null references public.prospects(id) on delete cascade,
  sujet        text        not null,
  corps        text        not null,
  sent_at      timestamptz not null default now()
);

-- Index pour tris courants
create index if not exists prospects_statut_idx    on public.prospects(statut);
create index if not exists prospects_created_idx   on public.prospects(created_at desc);
create index if not exists prospect_emails_pid_idx on public.prospect_emails(prospect_id, sent_at desc);

insert into public.schema_migrations (version, label, applied_at)
values ('0044', 'crm_prospects', now())
on conflict (version) do nothing;
