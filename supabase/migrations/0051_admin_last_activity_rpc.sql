-- ═══════════════════════════════════════════════════════════════════
-- RPC d'agrégation : dernière activité réelle par owner_id.
--
-- Pourquoi : le panel admin et le bot Telegram affichaient
-- `auth.users.last_sign_in_at` comme "dernière connexion", mais cette
-- colonne ne bouge qu'à un vrai login (mot de passe / OTP). Avec une
-- PWA, le refresh token tient des semaines sans re-login → la valeur
-- devient stale pour la quasi-totalité des users actifs (cas observé :
-- user qui a créé un devis le matin même apparaît comme "vu il y a
-- 2 semaines").
--
-- La vraie source de vérité d'activité = `activity_log` (INSERT /
-- UPDATE / DELETE tracés par triggers SECURITY DEFINER depuis 0012).
-- On expose un MAX(created_at) GROUP BY owner_id qui exploite l'index
-- `activity_log_owner_created_idx`.
--
-- Sécurité : SECURITY DEFINER + service_role only (REVOKE PUBLIC).
-- Appelée uniquement par /api/admin-stats côté Vercel.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.admin_last_activity_per_owner()
returns table(owner_id uuid, last_activity_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select owner_id, max(created_at) as last_activity_at
  from public.activity_log
  where owner_id is not null
  group by owner_id
$$;

revoke all on function public.admin_last_activity_per_owner() from public;
revoke all on function public.admin_last_activity_per_owner() from authenticated;
revoke all on function public.admin_last_activity_per_owner() from anon;

insert into public.schema_migrations (version, label, applied_at)
values ('0051', 'admin_last_activity_per_owner RPC', now())
on conflict (version) do nothing;
