-- Stockage du profil brand complet (SIRET, adresse, logo, couleur, IBAN, etc.)
-- directement en base pour qu'il survive à une déconnexion / changement de navigateur.
alter table public.profiles
  add column if not exists brand_data jsonb;
