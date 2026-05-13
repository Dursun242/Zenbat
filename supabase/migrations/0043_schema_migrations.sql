-- Tracking des migrations appliquées.
--
-- Supabase n'a pas de mécanisme natif de suivi (contrairement à Rails
-- ActiveRecord ou Knex). Conséquence : aucune source de vérité fiable
-- sur ce qui est réellement appliqué en prod — un trou est possible et
-- silencieux (cf bug vécu sur 0007_signed_by sauté alors que 0032+
-- étaient appliquées, qui faisait échouer le SELECT signed_by côté
-- devis-public).
--
-- Cette table est alimentée à l'application de chaque NOUVELLE
-- migration. Convention à partir de 0043 : chaque fichier .sql termine
-- par un INSERT idempotent qui s'enregistre lui-même (cf bas de fichier
-- pour 0043).
--
-- Les migrations antérieures (0001-0042) ne sont PAS rétro-marquées :
-- on ne ment pas à la table. Pour rattraper, l'utilisateur peut INSERT
-- manuellement les versions qu'il a déjà appliquées via une commande
-- du genre :
--   INSERT INTO public.schema_migrations (version, applied_at, label)
--   VALUES
--     ('0040', '2026-01-15 00:00+00', 'drop_odoo_b2b'),
--     ('0041', '2026-05-13 17:00+00', 'fix_devis_week_count_null'),
--     ('0042', '2026-05-13 18:00+00', 'stripe_webhook_idempotency')
--   ON CONFLICT (version) DO NOTHING;
--
-- Diagnostic depuis le panel admin ou le SQL Editor :
--   SELECT version, label, applied_at
--   FROM public.schema_migrations
--   ORDER BY version DESC LIMIT 20;

create table if not exists public.schema_migrations (
  version    text primary key,
  label      text,
  applied_at timestamptz not null default now()
);

-- RLS : seul le service_role écrit. Le client anon peut lire (utile pour
-- un futur health-check côté front qui afficherait "migration X manquante").
alter table public.schema_migrations enable row level security;

drop policy if exists schema_migrations_read_all on public.schema_migrations;
create policy schema_migrations_read_all
  on public.schema_migrations for select
  to authenticated, anon
  using (true);

-- 0043 s'auto-enregistre.
insert into public.schema_migrations (version, label, applied_at)
values ('0043', 'schema_migrations', now())
on conflict (version) do nothing;
