-- 0037_devis_daily_counters.sql
-- Compteur sticky de devis créés par jour, qui ne décrémente PAS à la
-- suppression. Empêche le bypass "créer 5 → supprimer → recréer".
--
-- Réécrit public.devis_today_count() (introduit en 0036) pour qu'il lise
-- ce compteur au lieu de compter les lignes actuelles dans public.devis.
--
-- À appliquer manuellement dans le SQL Editor Supabase APRÈS la 0036
-- (cf. CLAUDE.md).

-- 1. Table compteur (clé composite owner_id + date jour)
create table if not exists public.devis_daily_counters (
  owner_id uuid not null references auth.users(id) on delete cascade,
  day      date not null,
  count    int  not null default 0,
  primary key (owner_id, day)
);

alter table public.devis_daily_counters enable row level security;

-- L'utilisateur peut lire son propre compteur (l'écriture passe par le trigger
-- qui s'exécute en SECURITY DEFINER, pas besoin de policy INSERT/UPDATE).
drop policy if exists "ddc_select_own" on public.devis_daily_counters;
create policy "ddc_select_own" on public.devis_daily_counters
  for select using (auth.uid() = owner_id);

-- 2. Trigger : à chaque INSERT dans devis, incrémente le compteur du jour.
--    SECURITY DEFINER pour bypasser RLS lors de l'upsert.
create or replace function public.incr_devis_daily_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'Europe/Paris')::date;
begin
  insert into public.devis_daily_counters (owner_id, day, count)
  values (new.owner_id, d, 1)
  on conflict (owner_id, day)
    do update set count = public.devis_daily_counters.count + 1;
  return new;
end;
$$;

drop trigger if exists devis_incr_daily_counter on public.devis;
create trigger devis_incr_daily_counter
  after insert on public.devis
  for each row execute function public.incr_devis_daily_counter();

-- 3. Réécriture de devis_today_count() : lit le compteur sticky au lieu de
--    compter les devis actuels (qui peuvent avoir été supprimés).
create or replace function public.devis_today_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count, 0)
  from public.devis_daily_counters
  where owner_id = uid
    and day = (now() at time zone 'Europe/Paris')::date;
$$;

revoke all on function public.devis_today_count(uuid) from public;
grant execute on function public.devis_today_count(uuid) to authenticated;

-- 4. Backfill : initialise le compteur d'aujourd'hui à partir des devis
--    déjà créés aujourd'hui (sinon les utilisateurs qui ont déjà créé des
--    devis pourraient en créer plus que prévu après application de la
--    migration). Ne touche pas aux jours passés (inutile).
insert into public.devis_daily_counters (owner_id, day, count)
select owner_id,
       (now() at time zone 'Europe/Paris')::date as day,
       count(*)
from public.devis
where created_at >= (
  date_trunc('day', (now() at time zone 'Europe/Paris'))
  at time zone 'Europe/Paris'
)
group by owner_id
on conflict (owner_id, day) do update
  set count = greatest(public.devis_daily_counters.count, excluded.count);
