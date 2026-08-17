# Sauvegardes de la base Supabase (plan Free)

Le plan Free de Supabase n'a **aucun backup natif**. Le workflow GitHub Actions
[`db-backup.yml`](../.github/workflows/db-backup.yml) comble ce trou :
chaque nuit à 03:17 UTC, un `pg_dump` exporte la base et stocke le fichier en
**artefact GitHub privé, conservé 30 jours** (~1-2 min de CI/jour, gratuit).

## Mise en place (une fois)

1. **Récupérer la chaîne de connexion** : Supabase → bouton **Connect** (barre
   du haut) → onglet **Session pooler** → copier l'URI et remplacer
   `[YOUR-PASSWORD]` par le mot de passe DB (Settings → Database →
   *Reset database password* si oublié).
   - ⚠ Bien prendre **Session pooler** (`…pooler.supabase.com:5432`).
     La connexion directe `db.<ref>.supabase.co` est IPv6-only (injoignable
     depuis GitHub Actions) et le Transaction pooler (port 6543) est
     incompatible `pg_dump`.
2. **GitHub → repo Zenbat → Settings → Secrets and variables → Actions** :
   - `SUPABASE_DB_URL` (obligatoire) = l'URI ci-dessus.
   - `BACKUP_PASSPHRASE` (optionnel) = une phrase secrète ; si présente, les
     dumps sont chiffrés AES-256. **À conserver précieusement** : sans elle,
     les backups chiffrés sont illisibles.
3. **Tester** : onglet **Actions** → « Sauvegarde base Supabase » →
   **Run workflow**. Le run doit être vert et produire un artefact
   `zenbat-db-backup-…`.

En cas d'échec d'un run planifié, GitHub envoie un email au propriétaire du
repo — ne pas l'ignorer : un backup qui échoue en silence ne protège rien.

## Contenu

| Fichier | Contenu |
|---|---|
| `zenbat-public-<date>.dump` | Tout le schéma `public` : profils, clients, devis, lignes, factures, logs, tickets… (format `pg_dump -Fc`, compressé) |
| `zenbat-auth-<date>.dump` | Schéma `auth` (comptes utilisateurs) — best-effort : peut manquer selon les permissions, les données métier restent complètes |

Suffixe `.gpg` si `BACKUP_PASSPHRASE` est configurée.

## Restaurer

1. Télécharger l'artefact (Actions → le run → Artifacts) et le dézipper.
2. Si chiffré : `gpg --decrypt zenbat-public-<date>.dump.gpg > public.dump`
3. Restaurer vers la base cible (le **même** Session pooler URI, ou un
   nouveau projet Supabase vierge) :

   ```sh
   pg_restore --no-owner --no-privileges --clean --if-exists \
     -d "$SUPABASE_DB_URL" public.dump
   ```

   - `--clean --if-exists` : remplace les tables existantes par la version du
     backup. **Destructif** sur la cible — à utiliser en connaissance de cause.
   - Pour restaurer une seule table :
     `pg_restore --no-owner -d "$URL" -t devis public.dump`
4. Après restauration sur un **nouveau** projet : re-appliquer ce qui ne vit
   pas dans le dump — Edge Functions (`supabase/functions/`), secrets, DB
   Webhooks, jobs pg_cron (cf. CLAUDE.md), et mettre à jour les variables
   d'env Vercel (`VITE_SUPABASE_URL`, clés).

## Limites connues

- **RPO 24 h** : on peut perdre au pire une journée de données (le Free ne
  permet pas mieux sans PITR, réservé au plan Pro).
- Le **Storage** (PDF uploadés dans `devis-pdfs`) n'est **pas** couvert par
  `pg_dump` — les PDF sont régénérables depuis les données, ce n'est pas
  bloquant.
- Rétention 30 jours (limite artefacts GitHub) : pour garder un historique
  plus long, télécharger ponctuellement un artefact et l'archiver ailleurs.
