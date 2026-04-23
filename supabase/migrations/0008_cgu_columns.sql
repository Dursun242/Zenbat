-- Migration 0008 : colonnes CGU sur la table profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cgu_accepted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cgu_version     TEXT        DEFAULT NULL;
