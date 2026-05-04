-- Documents annexes attachés aux devis (assurance, attestation TVA, plaquette…)
-- devis_id NULL = document permanent du profil artisan (joint à tous les devis)

CREATE TABLE IF NOT EXISTS public.devis_documents (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  devis_id     uuid    REFERENCES public.devis(id) ON DELETE SET NULL,
  name         text    NOT NULL,
  category     text,
  -- 'assurance_decennale' | 'attestation_tva_10' | 'attestation_tva_55'
  -- | 'plaquette' | 'fiche_technique' | 'autre'
  storage_path text    NOT NULL,
  size_bytes   integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS docs_owner_idx ON public.devis_documents(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS docs_devis_idx ON public.devis_documents(devis_id);

ALTER TABLE public.devis_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner manage docs" ON public.devis_documents;
CREATE POLICY "owner manage docs" ON public.devis_documents
  FOR ALL USING (owner_id = auth.uid());

-- Bucket Storage : créer manuellement dans Supabase Dashboard
-- Storage > New bucket > "devis-documents" > Private
-- (les URLs signées sont générées côté API)
