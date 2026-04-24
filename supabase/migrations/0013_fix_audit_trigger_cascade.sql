-- Correctif : trigger log_activity() ne doit pas bloquer la suppression
-- de compte en cascade.
--
-- Probleme : lors de admin.auth.admin.deleteUser(), PostgreSQL declenche
-- une cascade depuis auth.users. Les triggers AFTER DELETE sur devis /
-- invoices / lignes appellent log_activity() qui tente d'INSERT dans
-- activity_log avec owner_id = <id_du_compte_supprime>. Si la contrainte
-- FK owner_id vers auth.users(id) ON DELETE SET NULL n'a pas encore traite
-- les nouvelles lignes inserees par le trigger (timing de cascade), la
-- transaction echoue avec une violation FK.
--
-- Correctif : on encapsule l'INSERT dans un bloc BEGIN/EXCEPTION.
-- En cas d'erreur (FK, RLS, autre), on emet un WARNING dans les logs
-- Postgres mais on ne leve pas d'exception -> la cascade peut continuer.
-- On utilise to_jsonb() pour extraire id et owner_id afin d'eviter
-- la syntaxe old.id / new.id qui peut poser probleme dans certains
-- contextes de rendu ou de copier-coller.

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
