-- Journal des erreurs de l'Agent IA, consultable par l'admin.
-- Les utilisateurs peuvent insérer leurs propres erreurs (best-effort
-- côté client), mais seul l'admin peut lire l'ensemble.

create table if not exists public.ia_error_logs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references auth.users(id) on delete set null,
  error         text not null,
  user_message  text,
  history_len   int,
  stream_tried  boolean default false,
  created_at    timestamptz not null default now()
);

create index if not exists ia_error_logs_created_idx on public.ia_error_logs(created_at desc);

alter table public.ia_error_logs enable row level security;

-- Chaque utilisateur peut insérer une erreur pour lui-même.
drop policy if exists "insert own ia log" on public.ia_error_logs;
create policy "insert own ia log" on public.ia_error_logs
  for insert with check (auth.uid() = owner_id or owner_id is null);

-- Trigger : renseigne owner_id automatiquement à l'insertion.
create or replace function public.set_ia_error_owner()
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

drop trigger if exists before_insert_ia_error on public.ia_error_logs;
create trigger before_insert_ia_error
  before insert on public.ia_error_logs
  for each row execute function public.set_ia_error_owner();
