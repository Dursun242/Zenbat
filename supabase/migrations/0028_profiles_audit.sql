-- ═══════════════════════════════════════════════════════════════════
-- Audit des inscriptions : log INSERT sur profiles dans activity_log
--
-- Pourquoi : le trigger générique log_activity (cf 0012) suppose que la
-- table porte une colonne owner_id, ce qui n'est pas le cas de profiles
-- (la PK id EST l'utilisateur). On utilise donc une fonction dédiée.
--
-- Seul l'INSERT est loggé : on ne veut pas spammer le journal à chaque
-- modif de profil (changement de logo, RIB, etc.).
--
-- Ce log alimente la notification Telegram via le DB Webhook configuré
-- côté Supabase UI sur public.activity_log INSERT.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.log_profile_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (owner_id, table_name, row_id, action, old_data, new_data)
  values (
    new.id,
    'profiles',
    new.id,
    'insert',
    null,
    jsonb_build_object(
      'id',           new.id,
      'full_name',    new.full_name,
      'company_name', new.company_name,
      'created_at',   new.created_at
    )
  );
  return new;
end;
$$;

drop trigger if exists t_profiles_signup_audit on public.profiles;
create trigger t_profiles_signup_audit
  after insert on public.profiles
  for each row execute function public.log_profile_signup();
