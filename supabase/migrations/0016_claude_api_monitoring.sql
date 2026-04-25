-- Table de monitoring des appels Claude API
-- Logs latence, tokens, erreurs, modèle utilisé
create table if not exists public.claude_api_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  model text not null,
  use_case text, -- "devis" ou "contact"
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  status_code integer,
  error_message text,
  stream_enabled boolean default false
);

-- Index pour requêtes rapides
create index if not exists claude_api_logs_created_idx
  on public.claude_api_logs(created_at desc);

create index if not exists claude_api_logs_model_idx
  on public.claude_api_logs(model, created_at desc);

create index if not exists claude_api_logs_use_case_idx
  on public.claude_api_logs(use_case, created_at desc);

create index if not exists claude_api_logs_error_idx
  on public.claude_api_logs(status_code, created_at desc)
  where status_code != 200;

-- RLS : lecture admin uniquement
alter table public.claude_api_logs enable row level security;

drop policy if exists "admin read claude logs" on public.claude_api_logs;
create policy "admin read claude logs" on public.claude_api_logs
  for select
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

drop policy if exists "system insert claude logs" on public.claude_api_logs;
create policy "system insert claude logs" on public.claude_api_logs
  for insert
  with check (true); -- Les appels serveur peuvent insérer
