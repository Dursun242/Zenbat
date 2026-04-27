-- Migration : moteur de cohérence — table de logs de validation
-- À appliquer dans le SQL Editor de Supabase.

create table if not exists coherence_validations (
  id              uuid        primary key default gen_random_uuid(),
  typology_id     text        not null,
  overall_status  text        not null check (overall_status in ('pass', 'warn', 'fail')),
  checks          jsonb       not null default '[]'::jsonb,
  iteration_count int         not null default 1,
  created_at      timestamptz not null default now()
);

alter table coherence_validations enable row level security;

-- Les utilisateurs authentifiés peuvent insérer leurs propres logs
create policy "anon insert coherence_validations"
  on coherence_validations for insert
  with check (true);

-- Lecture réservée à l'admin (via service role key)
-- Les utilisateurs normaux ne lisent pas ces logs depuis le client

create index coherence_validations_typology_idx   on coherence_validations(typology_id);
create index coherence_validations_status_idx     on coherence_validations(overall_status);
create index coherence_validations_created_at_idx on coherence_validations(created_at desc);
