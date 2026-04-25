-- Ajout du type de facture pour distinguer factures normales et acomptes
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'normale';

-- Contrainte : valeurs autorisées
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IN ('normale', 'acompte'));

-- Index pour filtrer par type
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type
  ON public.invoices (owner_id, invoice_type);

-- Pour les avoirs existants, on garde 'normale' (avoirs identifiés par avoir_of_invoice_id)
