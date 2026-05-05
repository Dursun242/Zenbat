-- ═══════════════════════════════════════════════════════════════════
-- 0034 — Email du comptable sur le profil utilisateur
--
-- Permet à chaque user d'enregistrer l'email de son comptable pour
-- déclencher l'envoi périodique d'un export factures (CSV) depuis le
-- menu hamburger.
--
-- Pas de validation forte côté DB (l'app fait un check email basique
-- côté formulaire). NULL = comptable non configuré.
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists comptable_email text;

comment on column public.profiles.comptable_email is
  'Email du comptable destinataire des exports factures (libre-service).';
