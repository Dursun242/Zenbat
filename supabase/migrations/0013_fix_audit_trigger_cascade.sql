-- ═══════════════════════════════════════════════════════════════════
-- Correctif : trigger log_activity() ne doit pas bloquer la suppression
-- de compte en cascade.
--
-- Problème : lors de admin.auth.admin.deleteUser(), PostgreSQL déclenche
-- une cascade depuis auth.users. Les triggers AFTER DELETE sur devis /
-- invoices / lignes appellent log_activity() qui tente d'INSERT dans
-- activity_log avec owner_id = <id_du_compte_supprimé>. Si la contrainte
-- FK owner_id → auth.users(id) ON DELETE SET NULL n'a pas encore traité
-- les nouvelles lignes insérées par le trigger (timing de cascade), la
-- transaction échoue avec une violation FK.
--
-- Correctif : on encapsule l'INSERT dans un bloc BEGIN/EXCEPTION.
-- En cas d'erreur (FK, RLS, autre), on émet un WARNING dans les logs
-- Postgres mais on ne lève pas d'exception → la cascade peut continuer.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner  uuid;
  v_row_id uuid;
begin
  if tg_op = 'DELETE' then
    v_owner  := coalesce(old.owner_id, null);
    v_row_id := coalesce((old.id)::uuid, null);
  else
    v_owner  := coalesce(new.owner_id, null);
    v_row_id := coalesce((new.id)::uuid, null);
  end if;

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
    -- Ne pas bloquer la cascade (ex : suppression de compte).
    raise warning 'log_activity: échec insert pour %.% op=% : %',
                  tg_table_name, v_row_id, tg_op, sqlerrm;
  end;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
