-- Correctif : handle_new_user() ne copiait pas company_name depuis les
-- métadonnées d'inscription vers profiles.company_name.
-- La colonne brand_data est aussi initialisée avec companyName pour que
-- l'onboarding retrouve le nom saisi à l'inscription.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company  text;
  v_full     text;
begin
  v_company := coalesce(
    nullif(trim(new.raw_user_meta_data->>'company_name'), ''),
    null
  );
  v_full := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    new.email
  );

  insert into public.profiles (id, full_name, company_name, brand_data)
  values (
    new.id,
    v_full,
    v_company,
    case
      when v_company is not null
      then jsonb_build_object('companyName', v_company)
      else '{}'::jsonb
    end
  );
  return new;
end;
$$;
