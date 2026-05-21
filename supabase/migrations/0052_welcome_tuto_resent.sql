-- Tracking du renvoi manuel du mail tuto "bienvenue" depuis le panel admin.
--
-- Cas d'usage : l'admin parcourt la section "Onboarding" du panel et
-- relance individuellement les comptes qui ont créé un profil mais n'ont
-- pas encore créé de devis. On veut éviter de spammer la même personne
-- plusieurs fois (le bouton se grise une fois la relance partie).
--
-- Pas de NOT NULL → la valeur reste NULL pour quelqu'un qui n'a jamais
-- reçu de relance manuelle (différent du mail auto envoyé à l'inscription
-- par la Edge Function welcome-email, qui n'est pas tracé ici).

alter table public.profiles
  add column if not exists welcome_tuto_resent_at timestamptz;

comment on column public.profiles.welcome_tuto_resent_at is
  'Date du dernier renvoi manuel du mail tuto de bienvenue depuis le panel admin. NULL = jamais relancé.';

insert into public.schema_migrations (version, label, applied_at)
values ('0052', 'welcome_tuto_resent_at on profiles', now())
on conflict (version) do nothing;
