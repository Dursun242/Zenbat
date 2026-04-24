-- Complète 0014 : handle_new_user() copie aussi les métiers (trades)
-- depuis les métadonnées d'inscription vers brand_data.
-- Le tableau trades est stocké sous forme de jsonb array dans brand_data.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company text;
  v_full    text;
  v_trades  jsonb;
  v_brand   jsonb;
begin
  v_company := coalesce(nullif(trim(new.raw_user_meta_data->>'company_name'), ''), null);
  v_full    := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), new.email);
  v_trades  := coalesce(new.raw_user_meta_data->'trades', '[]'::jsonb);

  v_brand := jsonb_build_object(
    'companyName', coalesce(v_company, ''),
    'trades',      v_trades
  );

  insert into public.profiles (id, full_name, company_name, brand_data)
  values (new.id, v_full, v_company, v_brand);

  return new;
end;
$$;
