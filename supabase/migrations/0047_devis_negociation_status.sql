-- Étend la contrainte CHECK sur devis.statut pour accepter 'en_negociation'.
--
-- Bug : le statut 'en_negociation' est utilisé partout dans le code
-- (api/devis-public.js action 'negotiate', src/lib/constants.js, badge UI,
-- filtre liste devis) mais la migration 0019_devis_indices.sql qui a
-- redéfini la contrainte ne l'inclut pas. Conséquence : tout UPDATE
-- statut = 'en_negociation' est rejeté par Postgres avec un check
-- violation, mais supabase-js ne throw pas — l'erreur reste silencieuse
-- dans le champ error de la réponse. La négociation est correctement
-- enregistrée dans devis_negotiations + audit_log, l'email part à
-- l'artisan, mais le statut du devis reste bloqué à 'envoye'. Donc :
-- pas de badge "Négociation" dans la nav, pas de bannière dans la liste,
-- pas d'évolution visible dans l'app.

ALTER TABLE public.devis DROP CONSTRAINT IF EXISTS devis_statut_check;
ALTER TABLE public.devis
  ADD CONSTRAINT devis_statut_check
  CHECK (statut IN ('brouillon','envoye','en_signature','en_negociation','accepte','refuse','remplace'));

insert into public.schema_migrations (version, label, applied_at)
values ('0047', 'devis statut en_negociation', now())
on conflict (version) do nothing;
