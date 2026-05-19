-- Ajoute la colonne `naf` (code APE normalisé, ex: '43.32A') sur la table clients.
--
-- Contexte : l'intégration INSEE (recherche-entreprises.api.gouv.fr) renvoie
-- le code activité principal sous forme NAF/APE normalisé. La colonne
-- `activite` existante stocke le libellé humain (ex: "Travaux de menuiserie
-- bois et PVC") — on garde les deux pour distinguer code et libellé.
--
-- Code Postgres défensif : si cette migration n'est pas encore appliquée
-- côté DB de l'utilisateur, `src/lib/api.js` createClient/updateClient
-- catchent le 42703 et retentent sans la colonne `naf`. Voir le pattern
-- déjà en place pour `signed_by` (devis) dans le même fichier.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS naf text;

insert into public.schema_migrations (version, label, applied_at)
values ('0048', 'clients.naf code APE', now())
on conflict (version) do nothing;
