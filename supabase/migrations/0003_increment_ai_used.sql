-- RPC atomique pour incrémenter le compteur d'utilisation de l'IA.
-- Appelé depuis le client après chaque réponse réussie de l'Agent IA.
-- security definer : contourne RLS pour écrire uniquement sa propre ligne (auth.uid()).

create or replace function public.increment_ai_used()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
     set ai_used = coalesce(ai_used, 0) + 1
   where id = auth.uid();
$$;

revoke all on function public.increment_ai_used() from public;
grant execute on function public.increment_ai_used() to authenticated;
