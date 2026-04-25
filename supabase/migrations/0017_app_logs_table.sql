-- Table pour les logs d'erreurs applicatives
-- Utilisée par le système d'auto-inspection (inspect-agent.js)
create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level text not null, -- 'error', 'warn', 'info'
  message text not null,
  stack text,
  context jsonb,
  resolved boolean default false,
  resolved_at timestamptz,
  resolved_by text -- email utilisateur ou 'system'
);

-- Index pour requêtes rapides
create index if not exists app_logs_created_idx
  on public.app_logs(created_at desc);

create index if not exists app_logs_level_idx
  on public.app_logs(level, created_at desc);

create index if not exists app_logs_unresolved_idx
  on public.app_logs(resolved, created_at desc)
  where resolved = false;

-- RLS : logs accessibles par admin uniquement
alter table public.app_logs enable row level security;

drop policy if exists "admin read logs" on public.app_logs;
create policy "admin read logs" on public.app_logs
  for select
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

drop policy if exists "system insert logs" on public.app_logs;
create policy "system insert logs" on public.app_logs
  for insert
  with check (true); -- Applis peuvent insérer

drop policy if exists "admin update logs" on public.app_logs;
create policy "admin update logs" on public.app_logs
  for update
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
