-- Journal COMPLET des conversations Agent IA, pour consultation admin
-- compte-par-compte (debug, support, qualité). On stocke :
--   - user_message : ce que l'utilisateur a tapé (sans les pièces jointes)
--   - ai_response  : le texte visible de la réponse IA (sans le bloc <DEVIS> JSON)
--   - had_devis    : TRUE si la réponse contenait un <DEVIS> exploitable
--   - trade_names  : métiers déclarés du compte au moment de l'échange (contexte)
--   - model        : modèle Claude utilisé (pour traçabilité après migrations)

create table if not exists public.ia_conversations (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references auth.users(id) on delete set null,
  user_message  text,
  ai_response   text,
  had_devis     boolean default false,
  trade_names   text,
  model         text,
  created_at    timestamptz not null default now()
);

create index if not exists ia_conversations_owner_created_idx
  on public.ia_conversations(owner_id, created_at desc);
create index if not exists ia_conversations_created_idx
  on public.ia_conversations(created_at desc);

alter table public.ia_conversations enable row level security;

-- Insertion : chacun peut logger ses propres conversations (best-effort client).
drop policy if exists "insert own ia conversation" on public.ia_conversations;
create policy "insert own ia conversation" on public.ia_conversations
  for insert with check (auth.uid() = owner_id or owner_id is null);

-- Lecture pour l'utilisateur lui-même (optionnel, utile pour un futur "Mes
-- conversations"). L'admin lit via la service_role côté serveur.
drop policy if exists "read own ia conversation" on public.ia_conversations;
create policy "read own ia conversation" on public.ia_conversations
  for select using (auth.uid() = owner_id);

create or replace function public.set_ia_conversation_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists before_insert_ia_conversation on public.ia_conversations;
create trigger before_insert_ia_conversation
  before insert on public.ia_conversations
  for each row execute function public.set_ia_conversation_owner();
