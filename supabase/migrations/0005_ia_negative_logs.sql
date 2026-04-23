-- Journal des interactions "négatives" avec l'Agent IA.
-- kind = 'ai_refusal'   : l'IA a refusé de générer un devis (hors périmètre métier, ambiguïté, etc.)
-- kind = 'user_negative': le message utilisateur contient des marqueurs de frustration / critique.
-- Consultable uniquement par l'admin ; insertion best-effort par chaque utilisateur.

create table if not exists public.ia_negative_logs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references auth.users(id) on delete set null,
  kind          text not null check (kind in ('ai_refusal', 'user_negative')),
  user_message  text,
  ai_response   text,
  created_at    timestamptz not null default now()
);

create index if not exists ia_negative_logs_created_idx on public.ia_negative_logs(created_at desc);
create index if not exists ia_negative_logs_kind_idx    on public.ia_negative_logs(kind, created_at desc);

alter table public.ia_negative_logs enable row level security;

drop policy if exists "insert own ia negative" on public.ia_negative_logs;
create policy "insert own ia negative" on public.ia_negative_logs
  for insert with check (auth.uid() = owner_id or owner_id is null);

create or replace function public.set_ia_negative_owner()
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

drop trigger if exists before_insert_ia_negative on public.ia_negative_logs;
create trigger before_insert_ia_negative
  before insert on public.ia_negative_logs
  for each row execute function public.set_ia_negative_owner();
