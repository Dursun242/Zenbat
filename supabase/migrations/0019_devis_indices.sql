-- Indices de devis : permet de créer des variantes (A, B, C...) d'un même devis
-- sans changer de numéro de base, pour présenter plusieurs hypothèses au client.

-- 1. Colonnes
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS root_devis_id uuid REFERENCES public.devis(id),
  ADD COLUMN IF NOT EXISTS indice        text;   -- NULL = version initiale, 'A', 'B', 'C'...

-- 2. Étendre la contrainte statut pour inclure 'remplace'
ALTER TABLE public.devis DROP CONSTRAINT IF EXISTS devis_statut_check;
ALTER TABLE public.devis
  ADD CONSTRAINT devis_statut_check
  CHECK (statut IN ('brouillon','envoye','en_signature','accepte','refuse','remplace'));

-- 3. Index pour retrouver les versions d'un même groupe rapidement
CREATE INDEX IF NOT EXISTS idx_devis_root ON public.devis(root_devis_id)
  WHERE root_devis_id IS NOT NULL;
