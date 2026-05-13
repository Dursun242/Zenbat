-- 0041_fix_devis_week_count_null.sql
--
-- Fix critique : la fonction public.devis_week_count(uid) renvoyait NULL
-- (et non 0) pour un utilisateur sans ligne dans devis_weekly_counters —
-- typiquement un nouvel inscrit qui n'a encore créé aucun devis cette
-- semaine.
--
-- La policy RLS d'insert sur devis (créée par 0039) évaluait alors :
--
--     user_plan(owner_id) = 'pro'  OR  devis_week_count(owner_id) < 5
--     ──────────────────────────       ─────────────────────────────
--           false (free)                       NULL < 5  → NULL
--
--     false OR NULL  →  NULL
--
-- WITH CHECK rejette tout ce qui n'est pas TRUE → l'INSERT échouait avec
-- Postgres 42501 (row-level security violation). Côté front (useDevis.js),
-- ce code est traité comme un quota dépassé → paywall affiché.
--
-- Chicken-and-egg parfait : la policy bloquait le 1er INSERT, donc le
-- trigger devis_incr_weekly_counter (after insert) ne se déclenchait
-- jamais → la ligne dans devis_weekly_counters n'était jamais créée →
-- devis_week_count continuait à renvoyer NULL → 2e essai échoue pareil.
-- Aucun nouveau freemium n'avait pu créer son tout premier devis depuis
-- l'application de 0039.
--
-- Fix : envelopper le SELECT dans un COALESCE pour qu'absence de ligne
-- = 0 devis créés cette semaine (ce qui était l'intention initiale).
--
-- À appliquer manuellement dans le SQL Editor Supabase (cf. CLAUDE.md).

create or replace function public.devis_week_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select count from public.devis_weekly_counters
     where owner_id = uid
       and week_start = public.current_week_start()),
    0
  );
$$;

revoke all on function public.devis_week_count(uuid) from public;
grant execute on function public.devis_week_count(uuid) to authenticated;
