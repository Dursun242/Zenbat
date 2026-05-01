-- ═══════════════════════════════════════════════════════════════════
-- Correctif 0028 : inclure l'email dans le log d'inscription.
--
-- profiles ne porte pas d'email (c'est auth.users.email). Le trigger
-- était limité à id/full_name/company_name, ce qui rendait la notif
-- Telegram inutile (UUID brut).
--
-- On va lire auth.users.email depuis le trigger SECURITY DEFINER.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.log_profile_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = new.id;

  insert into public.activity_log (owner_id, table_name, row_id, action, old_data, new_data)
  values (
    new.id,
    'profiles',
    new.id,
    'insert',
    null,
    jsonb_build_object(
      'id',           new.id,
      'email',        v_email,
      'full_name',    new.full_name,
      'company_name', new.company_name,
      'created_at',   new.created_at
    )
  );
  return new;
end;
$$;
