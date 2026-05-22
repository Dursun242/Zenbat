-- Migration 0054 : journal des connexions (lecture admin).
--
-- Supabase journalise déjà chaque connexion dans la table système
-- auth.audit_log_entries (IP, horodatage, email, action). Ce schéma `auth`
-- n'est pas exposé via l'API REST — on crée donc une fonction de lecture
-- SECURITY DEFINER pour que l'endpoint admin (service_role) puisse en
-- extraire les événements `login` sans rien ajouter au flux de connexion.
--
-- Aucune table custom, aucun code côté login : on expose juste ce que
-- GoTrue enregistre nativement.

create or replace function public.admin_login_history(limit_n integer default 500)
returns table (
  id             uuid,
  created_at     timestamptz,
  ip_address     text,
  actor_id       text,
  actor_username text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    e.id,
    e.created_at,
    e.ip_address::text             as ip_address,
    e.payload->>'actor_id'         as actor_id,
    e.payload->>'actor_username'   as actor_username
  from auth.audit_log_entries e
  where e.payload->>'action' = 'login'
  order by e.created_at desc
  limit greatest(1, least(coalesce(limit_n, 500), 2000));
$$;

-- SECURITY DEFINER → s'exécute avec les droits du créateur (postgres),
-- seul habilité à lire le schéma auth. On retire l'accès à tous les rôles
-- clients et on ne le rouvre qu'au service_role utilisé par l'API admin.
revoke all on function public.admin_login_history(integer) from public;
grant execute on function public.admin_login_history(integer) to service_role;

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0054', 'admin_login_history', now())
on conflict (version) do nothing;
