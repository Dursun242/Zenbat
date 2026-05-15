# Reprise intégration Super PDP — plan d'action

> Document de reprise pour quand on relancera l'intégration **Super PDP**
> (Plateforme Agréée DGFiP pour la facturation électronique B2B, réforme
> 09/2026 / 09/2027).
>
> **Statut actuel sur `main` : aucune intégration.** Tout le travail vit
> sur 3 branches non-mergées du remote `origin`. Cette doc sert à
> retrouver ce qui a été fait et à le rebaser proprement le moment venu.

---

## 1. Où est le code

Trois branches sur `origin`, **jamais mergées** :

| Branche | Rôle | Commit clé |
|---|---|---|
| `claude/audit-einvoicing-integration-awnev` | Audit faisabilité (850 lignes) | `2087252` |
| `claude/add-dpd-integration-x5GRw` | 1ʳᵉ itération SuperPDP v0 + fixes BT-34/BT-49 | `b076a07`, `acb2ab4` |
| `claude/integrate-superdpd-ZpSGG` | **Version la plus avancée** : reprend tout, ajoute fixes EN 16931 catégories AE/E, 13 tests | `23e6022` → `33fce92` |

La copie complète de l'audit est sauvegardée dans
[`audit-einvoicing.md`](./audit-einvoicing.md) (même contenu que la
branche, conservé ici pour ne pas dépendre d'`origin`).

Pour repartir :

```bash
git fetch origin claude/integrate-superdpd-ZpSGG
git checkout -b superpdp-reprise origin/claude/integrate-superdpd-ZpSGG
git rebase origin/main
# … résoudre les conflits ci-dessous …
```

## 2. Ce que la branche `integrate-superdpd-ZpSGG` apporte

```
api/superpdp.js                                  | +361
api/superpdp.test.js                             | +159   (13 tests : mapStatus + routing)
src/components/InvoiceDetail.jsx                 | +147   (bouton "📡 PDP test" + bandeau statut AFNOR)
src/hooks/useInvoices.js                         |  +16
src/lib/api.js                                   |  +25   (pdp.testConnection / sendInvoice / getStatus)
src/lib/constants.js                             |   +2
src/lib/supportPrompts.js                        |   +2
supabase/migrations/0039_pdp_accounts.sql        | +153
supabase/migrations/0040_ensure_avoir_column.sql |  +19
CLAUDE.md                                        |  +67
vercel.json                                      |   +4
api/b2brouter.js                                 | -326   (supprimé)
api/b2brouter.webhook.test.js                    | -195   (supprimé)
```

Slots Vercel : la branche **remplace** `b2brouter.js` par `superpdp.js`,
donc occupation nette inchangée. Depuis, la PR #86 (mai 2026) a viré
B2Brouter sans le remplacer → 10/12 slots utilisés aujourd'hui →
**marge confortable de 2 slots** pour réintroduire `superpdp.js`.

## 3. Spec API Super PDP — confirmée

Sources de la spec : exemples officiels Super PDP (Go + Node.js) + module
Dolibarr `LemonSuperPDP` en production.

| Élément | Valeur |
|---|---|
| Base URL prod + sandbox | `https://api.superpdp.tech` |
| Distinction env | `GET /v1.beta/companies/me` → champ `env` |
| Auth | OAuth 2.1 `client_credentials` sur `POST /oauth2/token` |
| Body OAuth | `application/x-www-form-urlencoded` : `grant_type=client_credentials`, `client_id`, `client_secret` |
| Envoi facture | `POST /v1.beta/invoices`, body = **PDF Factur-X binaire brut** (`Content-Type: application/pdf`) — **pas de wrapper JSON** |
| Statut facture | `GET /v1.beta/invoices/{id}` → champ `invoice_events[]` |
| Polling global | `GET /v1.beta/invoice_events?starting_after_id=<cursor>` (curseur monotone, pagination via `has_after`) |
| Pas de webhook | Super PDP n'expose pas de webhook entrant. Tout passe par polling. |
| Token cache | En mémoire process (Vercel chaud), refresh 30 s avant `expires_in` |

### Mapping statuts AFNOR → Zenbat

Codes AFNOR `fr:2xx`, mappés dans `api/superpdp.js` `mapStatus()` :

| Code AFNOR | Sens | Statut Zenbat |
|---|---|---|
| `fr:200` | Déposée | `envoyee` |
| `fr:201`, `fr:203`, `fr:210` | Refus / rejet | `rejetee` |
| `fr:202`, `fr:204`, `fr:206` | Acceptée par destinataire | `recue` |
| `fr:205`, `fr:207`, `fr:208` | États intermédiaires | (statut local inchangé) |
| `fr:212` | Encaissée | `payee` |

Le code brut est aussi persisté dans `invoices.pdp_status_raw` pour
debug + traçabilité.

## 4. Variables d'environnement Vercel à configurer

| Variable | Usage |
|---|---|
| `PDP_API_BASE` | Défaut `https://api.superpdp.tech` |
| `PDP_CLIENT_ID` | App OAuth Super PDP sandbox (v0) |
| `PDP_CLIENT_SECRET` | App OAuth Super PDP sandbox (v0) |
| `PDP_SANDBOX_RECEIVER_PEPPOL` | Adresse Peppol du receiver enrôlé pour les tests (format `<scheme>:<id>`, ex `0225:315143296_6591`). Fallback : `PDP_SANDBOX_RECEIVER_SIREN` (construit `0225:<siren>`). |
| `CRON_SECRET` | Auth Bearer du cron `/api/superpdp?route=poll` |

## 5. Architecture v0 vs v1 (multi-tenant)

**v0 (POC sandbox)** — *ce qui est codé dans `integrate-superdpd-ZpSGG`* :
- Compte sandbox **Zenbat unique** (credentials en env vars Vercel).
- Tous les artisans qui cliquent "Envoyer via PDP" partent avec **le SIREN sandbox Zenbat**, pas leur SIREN réel.
- Un seul curseur de polling global (`pdp_state` table, row sentinelle `id=1`).
- Une seule ligne `pdp_accounts` par user (suivi du SIREN/env retourné par `companies/me`).

**v1 (multi-tenant prod)** — *préparé mais pas activé* :
- Chaque artisan crée sa propre app OAuth Confidentielle sur Super PDP
  (le SIREN est lié à l'app côté Super PDP).
- Zenbat stocke `client_id` + `client_secret` **chiffré AES-GCM**
  (colonnes `encrypted_client_secret` + `secret_iv` + `secret_tag`,
  déjà présentes dans la migration).
- Token cache passe en DB (`access_token` + `token_expires_at` sur
  `pdp_accounts`).
- Curseur de polling **par user** (à migrer depuis `pdp_state` partagé).

→ Le schéma DB de la migration `0039_pdp_accounts.sql` est **déjà
prêt pour v1** (colonnes nullables ajoutées dès v0).

## 6. Conflits attendus à la reprise

### 6.1. Migrations à renuméroter

Quand la branche a été écrite, la dernière migration en `main` était
`0038`. Depuis, `main` est passé à `0043` :

| Branche | À renommer en | Raison |
|---|---|---|
| `0039_pdp_accounts.sql` | `0044_pdp_accounts.sql` | `0039` occupé par freemium weekly limit, `0040` par drop Odoo/B2B, etc. |
| `0040_ensure_avoir_column.sql` | `0045_ensure_avoir_column.sql` | idem |

**Ajouter** à la fin de chaque migration renumérotée (depuis la
convention `0043_schema_migrations.sql`) :

```sql
insert into public.schema_migrations (version, label, applied_at)
values ('0044', 'pdp_accounts', now())
on conflict (version) do nothing;
```

(idem pour `0045 / ensure_avoir_column`).

### 6.2. `CLAUDE.md`

- La branche dit "12/12 functions" — `main` aujourd'hui dit "10/12".
  Après réintro de `superpdp.js` → "11/12".
- La section *Architecture Super PDP* peut s'insérer telle quelle après
  *Architecture Telegram* (même format).
- Variables d'env à ajouter dans la table existante.

### 6.3. `InvoiceDetail.jsx`

PRs intervenues entre-temps qui touchent ce fichier :
- #28 (Factur-X EN 16931)
- #60 / #61 (no-op sur factures verrouillées, `useRef` anti-stale-closure)
- #69 (auto-liquidation BTP)
- #86 (audit)
- `claude/agent-response-behavior-LUDQs` (récent)

Le bouton "📡 PDP test" + bandeau de transmission doivent être
réintroduits, **gated derrière `ADMIN_EMAIL`** (ou un feature flag
`VITE_PDP_SANDBOX=true`) pendant toute la durée de la v0.

### 6.4. `vercel.json`

- La branche supprime le rewrite `/api/b2brouter-webhook` → déjà fait par
  PR #86. **Conflit auto-résolu**.
- La branche ajoute un cron Vercel quotidien 06:00 sur
  `/api/superpdp?route=poll` → à fusionner avec les `maxDuration`
  granulaires actuels.
- `maxDuration: 60s` requis pour `superpdp.js` (OAuth + envoi peut
  cumuler 50s côté Super PDP).

### 6.5. `src/lib/api.js`

Le helper `pdp.*` remplace l'ancien `b2b.*`. Depuis PR #86, `b2b.*` a été
supprimé. **Pas de conflit** — il suffit d'ajouter le bloc `pdp` au
fichier actuel.

## 7. Plan d'exécution propre (estimation : 1 grosse séance)

1. **Avant code** : confirmer que les credentials sandbox Super PDP sont
   encore valides. Si oui, récupérer `PDP_CLIENT_ID`, `PDP_CLIENT_SECRET`,
   `PDP_SANDBOX_RECEIVER_PEPPOL` côté Super PDP.
2. **Branche** : `git checkout -b superpdp-reprise origin/claude/integrate-superdpd-ZpSGG && git rebase origin/main`.
3. **Migrations** : renommer `0039`→`0044` et `0040`→`0045`, ajouter le
   `insert into schema_migrations` à chacune.
4. **CLAUDE.md** : fusionner la section *Architecture Super PDP*,
   mettre à jour le compteur 10/12 → 11/12, lister `PDP_*` + `CRON_SECRET`.
5. **vercel.json** : merger le cron + maxDuration `superpdp.js`.
6. **InvoiceDetail.jsx** : réintroduire bouton + bandeau, **gater derrière
   admin** (`useAuth().user?.email === ADMIN_EMAIL`).
7. **Env vars Vercel** : poser les 5 vars (cf §4).
8. **DB Supabase** : appliquer `0044_pdp_accounts.sql` puis
   `0045_ensure_avoir_column.sql` via SQL Editor.
9. **Smoke test** :
   - Cliquer "🔌 Test connexion PDP" → doit retourner `env` + `siren` sandbox.
   - Créer facture test → cliquer "📡 Envoyer via PDP" → vérifier
     `pdp_invoice_id` + `pdp_status_raw=fr:200` en DB.
   - Attendre le cron 06:00 (ou kicker manuellement avec `curl -H "Authorization: Bearer $CRON_SECRET" .../api/superpdp?route=poll`) → vérifier transition de statut.
10. **Tests** : `npm test api/superpdp.test.js` — les 13 tests doivent passer.

## 8. Pourquoi ce travail n'a jamais été mergé

Hypothèse : c'était une grosse session d'exploration en preview Vercel
(sandbox SuperPDP avait répondu OK pour les premiers envois). Le merge
sur `main` impliquait :
- Migrer en prod la DB des utilisateurs déjà inscrits
- Gérer un compte sandbox partagé (donc visible publiquement) ou
  attendre la v1 multi-tenant
- Calage avec le calendrier de la réforme (réception obligatoire
  01/09/2026, émission 01/09/2027)

Décision raisonnable : on a poussé Factur-X EN 16931 / PDF-A3 conforme
en prod (PR #28-31, #69) — ce qui est **suffisant** pour la phase
réception 09/2026 — et on a parqué l'envoi via PDP pour plus tard.

---

**Dernière mise à jour** : 2026-05-15 (session de revue avant calage
du timing de relance).
