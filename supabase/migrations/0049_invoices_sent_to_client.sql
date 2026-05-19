-- Ajoute le suivi d'envoi par email d'une facture émise au client.
--
-- Contexte : le bouton "🔒 Émettre" (cf src/components/InvoiceDetail.jsx)
-- verrouille la facture (statut 'envoyee' + locked=true) et génère le PDF
-- Factur-X mais n'envoie aucun email. Le label UI a été renommé "Émise"
-- (cf src/lib/constants.js) car "Envoyée" était trompeur.
--
-- La nouvelle action 'send' de api/facturx.js télécharge le PDF Factur-X
-- depuis Supabase Storage et l'envoie en pièce jointe à l'email du client,
-- au nom de la marque artisan (brand.companyName). Ce timestamp note la
-- dernière date d'envoi, et le compteur permet d'afficher "envoyée 3 fois"
-- dans le futur si besoin.
--
-- Code Postgres défensif : api/facturx.js catche 42703 et continue (l'email
-- est parti, seul le tracking en DB échoue) si la migration n'est pas encore
-- appliquée côté DB de l'utilisateur.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS sent_to_client_at    timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_client_count integer NOT NULL DEFAULT 0;

insert into public.schema_migrations (version, label, applied_at)
values ('0049', 'invoices.sent_to_client_at + count', now())
on conflict (version) do nothing;
