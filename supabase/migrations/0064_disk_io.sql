-- ═══════════════════════════════════════════════════════════════════
-- 0064 — Budget d'E/S disque (alerte Supabase du 2026-11-03)
--
-- 1. Index owner_id sur lignes_devis et lignes_invoices.
--    Au chargement de l'app (et à chaque retour sur l'onglet), le front
--    lit toutes SES lignes : `select * from lignes_devis order by position`,
--    filtré par la RLS `auth.uid() = owner_id`. Sans index sur owner_id,
--    Postgres parcourait la table entière (les lignes de TOUS les
--    artisans) à chaque fois : la lecture grossissait avec la base.
--
-- 2. log_activity() ignore les UPDATE qui ne changent rien (hors
--    updated_at). Les sauvegardes automatiques de la fiche devis
--    réécrivaient la ligne à l'identique et ajoutaient à chaque fois
--    deux copies jsonb complètes dans activity_log. Les vraies
--    modifications restent journalisées comme avant.
--
-- 3. admin_last_activity_per_owner() : même résultat, mais un accès
--    par index (owner_id, created_at desc) par compte au lieu d'un
--    parcours complet d'activity_log à chaque ouverture des stats admin.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Index ─────────────────────────────────────────────────────────────
create index if not exists lignes_devis_owner_idx    on public.lignes_devis(owner_id);
create index if not exists lignes_invoices_owner_idx on public.lignes_invoices(owner_id);

-- ─── 2. Journal d'audit sans UPDATE à vide ────────────────────────────────
-- Reprend log_activity() de 0013 à l'identique, plus la sortie anticipée.
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner  uuid;
  v_row_id uuid;
  v_rec    jsonb;
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_rec := to_jsonb(old);
  else
    v_rec := to_jsonb(new);
  end if;

  v_owner  := (v_rec->>'owner_id')::uuid;
  v_row_id := (v_rec->>'id')::uuid;

  begin
    insert into public.activity_log (owner_id, table_name, row_id, action, old_data, new_data)
    values (
      coalesce(v_owner, auth.uid()),
      tg_table_name,
      v_row_id,
      lower(tg_op),
      case when tg_op = 'INSERT' then null else to_jsonb(old) end,
      case when tg_op = 'DELETE' then null else to_jsonb(new) end
    );
  exception when others then
    raise warning 'log_activity: echec insert %.% op=% : %',
                  tg_table_name, v_row_id, tg_op, sqlerrm;
  end;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- ─── 3. Dernière activité par compte, par index ──────────────────────────
-- Les comptes sans aucune entrée sont exclus, comme avant (group by).
create or replace function public.admin_last_activity_per_owner()
returns table(owner_id uuid, last_activity_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, la.last_activity_at
  from public.profiles p
  cross join lateral (
    select a.created_at as last_activity_at
    from public.activity_log a
    where a.owner_id = p.id
    order by a.created_at desc
    limit 1
  ) la
$$;

revoke all on function public.admin_last_activity_per_owner() from public;
revoke all on function public.admin_last_activity_per_owner() from authenticated;
revoke all on function public.admin_last_activity_per_owner() from anon;

-- ─── Diagnostic (à lancer quand on veut, lecture seule) ───────────────────
--   Requêtes qui lisent le plus de blocs (extension pg_stat_statements,
--   active par défaut sur Supabase) :
--   select calls, shared_blks_read, shared_blks_hit, round(total_exec_time) ms,
--          left(query, 120) q
--     from pg_stat_statements order by shared_blks_read desc limit 15;
--
--   Tables les plus lourdes :
--   select relname, pg_size_pretty(pg_total_relation_size(relid)) taille,
--          seq_scan, idx_scan, n_live_tup
--     from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 15;

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0064', 'disk_io', now())
on conflict (version) do nothing;
