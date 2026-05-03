-- Ajout de user_id dans claude_api_logs pour le suivi des coûts par utilisateur
alter table public.claude_api_logs
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists claude_api_logs_user_idx
  on public.claude_api_logs(user_id, created_at desc);
