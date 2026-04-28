-- Feedback utilisateur sur les réponses de l'agent IA
-- vote = 1 (pouce en l'air) ou -1 (pouce en bas)
-- reason = raison optionnelle (texte libre ou tag prédéfini)

create table if not exists ia_feedback (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        default auth.uid() references auth.users(id) on delete cascade not null,
  vote          smallint    not null check (vote in (1, -1)),
  reason        text,
  user_message  text,
  lignes_count  integer     default 0,
  trades        jsonb,
  created_at    timestamptz default now()
);

alter table ia_feedback enable row level security;

create policy "insert own feedback"
  on ia_feedback for insert to authenticated
  with check (auth.uid() = user_id);

create policy "read own feedback"
  on ia_feedback for select to authenticated
  using (auth.uid() = user_id);

-- Les admins lisent via service_role (bypass RLS), pas besoin de policy supplémentaire.
