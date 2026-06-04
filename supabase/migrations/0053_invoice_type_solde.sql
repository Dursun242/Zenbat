-- Étend la CHECK constraint pour autoriser 'solde' (facture de solde)
-- Une facture de solde = dernière échéance après un ou plusieurs acomptes.
-- Montant = devis_ht - somme des acomptes précédents.

ALTER TABLE public.invoices
  DROP CONSTRAINT invoices_invoice_type_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IN ('normale', 'acompte', 'solde'));

insert into public.schema_migrations (version, label, applied_at)
values ('0053', 'invoice_type_solde', now())
on conflict (version) do nothing;
