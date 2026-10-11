-- ═══════════════════════════════════════════════════════════════════
-- 0059 — Quotas journaliers comptés côté serveur (audit du 2026-10-11)
--
-- Avant : le quota IA de /api/claude comptait les lignes ia_conversations…
-- insérées par le navigateur. Appeler /api/claude directement ne consommait
-- donc rien (coût IA illimité pour un compte gratuit). Les envois d'emails
-- (devis, facture, export comptable) n'avaient aucune limite : un compte
-- pouvait épuiser la boîte d'envoi partagée (codes OTP de tout le monde).
--
-- daily_quota_consume(user, kind, limit) réserve une unité de façon atomique
-- (INSERT … ON CONFLICT DO UPDATE … WHERE calls < limit) : des requêtes
-- parallèles ne dépassent jamais la limite. Renvoie le nouveau total, ou NULL
-- si la limite est atteinte. daily_quota_refund rend une unité quand l'action
-- a échoué. Kinds utilisés : 'ai', 'email'. Jour = date UTC.
--
-- Réservé au service_role (API Vercel, cf api/_quota.js) : RLS sans policy
-- sur la table, EXECUTE retiré à public / anon / authenticated.
-- Idempotente : peut être rejouée sans erreur.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.daily_quotas (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  kind    text not null,
  calls   int  not null default 0,
  primary key (user_id, day, kind)
);

alter table public.daily_quotas enable row level security;

create or replace function public.daily_quota_consume(p_user uuid, p_kind text, p_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calls int;
begin
  if p_limit is null or p_limit < 1 then
    return null;
  end if;
  insert into public.daily_quotas as q (user_id, day, kind, calls)
  values (p_user, (now() at time zone 'utc')::date, p_kind, 1)
  on conflict (user_id, day, kind) do update
    set calls = q.calls + 1
    where q.calls < p_limit
  returning q.calls into v_calls;
  return v_calls;
end;
$$;

create or replace function public.daily_quota_refund(p_user uuid, p_kind text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.daily_quotas
     set calls = greatest(calls - 1, 0)
   where user_id = p_user
     and kind = p_kind
     and day = (now() at time zone 'utc')::date;
$$;

revoke all on function public.daily_quota_consume(uuid, text, int) from public, anon, authenticated;
revoke all on function public.daily_quota_refund(uuid, text)       from public, anon, authenticated;
grant execute on function public.daily_quota_consume(uuid, text, int) to service_role;
grant execute on function public.daily_quota_refund(uuid, text)       to service_role;

-- ─── Vérifications (à lancer après application) ─────────────────────
--   select has_function_privilege('authenticated', 'public.daily_quota_consume(uuid,text,int)', 'execute');  -- false
--   select * from public.daily_quotas order by day desc limit 20;   -- consommation du jour par utilisateur

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0059', 'daily_quotas', now())
on conflict (version) do nothing;
