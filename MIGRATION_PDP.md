# Migration B2Brouter → Super PDP

Plan de migration de l'intégration de facturation électronique de B2Brouter vers Super PDP (PDP — Plateforme de Dématérialisation Partenaire).

> Statut : **plan uniquement, aucun code écrit**.
> Spec API Super PDP : **confirmée** (sources : OAuth example officiel `pimeo/superpdp-nodejs-oauth-example`, exemple Go officiel `superpdp/examples/erp.go`, module Dolibarr de production `hello-lemon/module-dolibarr-lemonsuperpdp`, doc `https://www.superpdp.tech/documentation`).
> Bloqué sur : credentials sandbox Zenbat (à créer sur `https://www.superpdp.tech/app/users/create` puis créer une « Application Confidentielle »).
> Branche cible : `claude/add-dpd-integration-x5GRw`.

---

## 1. Contexte

La réforme française de la facturation électronique (généralisation septembre 2026) impose de passer par une **PDP immatriculée** ou par le PPF (Portail Public de Facturation). Zenbat utilisait B2Brouter (eDocExchange via Peppol) en sandbox. L'utilisateur souhaite remplacer B2Brouter par **Super PDP** (`superpdp.tech`), qui est une PDP française.

Ce que la capture sandbox confirme :
- Numéro entreprise (test) : `000000002` — Burger Queen
- Adresse Peppol : `0225:315143296_6591` (status OK + `_r` en cours)
- Modes : Bac à sable (sandbox) et production
- L'utilisateur peut créer des « lignes d'annuaire » Peppol côté Super PDP

---

## 1-bis. Spec API Super PDP (confirmée)

Sources : exemples officiels (Go, Node.js) + module Dolibarr `LemonSuperPDP` v0.3.0 en production.

### Endpoint et environnements

- **Base URL unique** : `https://api.superpdp.tech` — production et sandbox utilisent **le même endpoint**. La distinction se fait au niveau de l'application OAuth (champ `env: "production" | "sandbox"` retourné par `/v1.beta/companies/me`).
- Doc HTML : `https://www.superpdp.tech/documentation`

### Authentification — OAuth 2.1

Deux flows possibles :

| Flow | Quand | Notes |
|---|---|---|
| **`client_credentials`** | Server-to-server (notre cas) | Pas de redirect URI utilisée. Application = type **Confidentielle**. |
| **`authorization_code` + `refresh_token`** | UI navigateur (cas de l'exemple Node.js) | Redirect URI requise (`/oauth2/authorize` → `/callback`). |

Pour Zenbat (proxy serveur Vercel), on utilise **`client_credentials`**.

```
POST https://api.superpdp.tech/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=<CLIENT_ID>
&client_secret=<CLIENT_SECRET>
```

Réponse :
```json
{
  "access_token": "...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

Toutes les autres requêtes → header `Authorization: Bearer <access_token>`.

⚠ **Une application OAuth = un SIREN**. Le SIREN du sender d'une facture envoyée via cette app **doit matcher** celui lié à l'app, sinon rejet par la PA. Conséquence pour Zenbat (multi-tenant) : voir §4.

### Endpoints utilisés

| Méthode | Path | Rôle | Body |
|---|---|---|---|
| `POST` | `/oauth2/token` | Obtenir un access_token | form-urlencoded |
| `GET`  | `/v1.beta/companies/me` | Info entreprise liée à l'app OAuth (SIREN, env) | — |
| `POST` | `/v1.beta/invoices` | Envoyer une facture | **PDF Factur-X brut** ou **XML UBL/CII brut** (pas de JSON wrapper) |
| `GET`  | `/v1.beta/invoices/{id}` | Récupérer une facture (avec `expand=invoice_events` si supporté) | — |
| `GET`  | `/v1.beta/invoice_events?starting_after_id={N}` | Lister les events depuis un curseur | — |
| `POST` | `/v1.beta/invoice_events` | Soumettre manuellement un statut (ex : encaissée) | JSON |

### Format payload — envoi facture

Trois formats supportés via le `Content-Type` :

| Format | Content-Type | Body |
|---|---|---|
| **Factur-X** (recommandé) | `application/pdf` | Bytes du PDF/A-3 avec XML CII embarqué |
| **UBL** | `application/xml` | XML UBL 2.1 |
| **CII** | `application/xml` | XML Cross-Industry Invoice |

Réponse :
```json
{ "id": 12345, ... }   // l'id côté Super PDP (à stocker)
```

> **Bonne nouvelle pour Zenbat** : `api/facturx.js` produit déjà du Factur-X (PDF/A-3 + XML CII). Pas besoin de générer un autre format.

### Format payload — submit event manuel

```json
POST /v1.beta/invoice_events
{
  "invoice_id": 12345,
  "status_code": "fr:212",
  "details": {
    "amounts": [
      { "net_amount": "100.00", "currency_code": "EUR", "type_code": "MEN", "vat_rate": "20.0", "date": "2026-05-07" }
    ]
  }
}
```

Le bloc `details.amounts` est requis pour `fr:207` et `fr:212` (ventilation TVA par taux).

### Codes statut AFNOR `fr:200`–`fr:212`

| Code | Mapping local | Sens |
|---|---|---|
| `fr:200` | `envoyee` | Facture déposée |
| `fr:201`, `fr:203`, `fr:210` | `rejetee` | Refus / rejet |
| `fr:202`, `fr:204`, `fr:206` | `recue` (acceptée) | Réception / approbation |
| `fr:212` | `payee` | Encaissée |
| `fr:207` | (intermédiaire) | Mise à disposition (avec amounts) |

### Synchronisation des statuts — POLLING (pas de webhook)

⚠ **Super PDP n'expose pas de webhook**. La synchro se fait par **polling** :

```
GET /v1.beta/invoice_events?starting_after_id={dernier_id_vu}
→ { data: [{ id, status_code, invoice_id, ... }, ...], has_after: true|false }
```

- On stocke le curseur (max id vu) dans une constante DB
- Tant que `has_after === true`, on enchaîne les pages
- Recommandation Lemon : cron toutes les **15 minutes**
- Sécurité : limiter à un nombre max de pages par run (50 chez Lemon) pour éviter les boucles infinies

### Erreurs courantes documentées

| Erreur | Cause |
|---|---|
| `pre-check: receiver address does not exist in peppol directory` (HTTP 400) | Destinataire pas inscrit dans Peppol — il doit s'inscrire chez une PA. C'est le cas le plus fréquent en phase transitoire. |
| `invalid_client` (HTTP 401 sur `/oauth2/token`) | `client_id` ou `client_secret` incorrect |
| SIREN incohérent | SIREN du sender ≠ SIREN de l'app OAuth |
| `pdf not found` | Le module n'a pas trouvé de PDF Factur-X à envoyer |

### Pricing

Frais d'API prélevés via **mandat SEPA** (IBAN à fournir lors de la création de l'application). Grille tarifaire publique chez Super PDP — modèle pay-per-call.

---

## 2. État actuel — surface B2Brouter

### 2.1 Backend

`api/b2brouter.js` (327 lignes) — endpoint unifié :

| Mode | Détection | Rôle |
|---|---|---|
| Webhook entrant | header `x-b2b-signature` ou `x-b2brouter-signature` | Validation HMAC SHA-256, mise à jour `invoices.statut` + `b2brouter_status` |
| Action authentifiée | header absent, body `{ action, payload }` | Bearer JWT Supabase + `service_role` |

Actions supportées :
- `ensure_account` — `POST /accounts` côté B2Brouter, persistance dans `b2b_accounts`
- `send_invoice` — `POST /invoices` côté B2Brouter, mise à jour `invoices.b2brouter_*` + `locked=true`
- `get_invoice_status` — `GET /invoices/{id}`
- `list_received` — `GET /accounts/{id}/received`

Mapping de statut (`mapStatus`) :
- `sent|dispatched|transmitted` → `envoyee`
- `delivered|received` → `recue`
- `paid|settled` → `payee`
- `rejected|failed|error` → `rejetee`
- `cancel` → `annulee`

### 2.2 Frontend

`src/lib/api.js:488-510` :
```js
async function callB2B(action, payload = {}) { /* fetch /api/b2brouter */ }

export const b2b = {
  ensureAccount: (info) => callB2B('ensure_account', info),
  sendInvoice:   (invoice_id) => callB2B('send_invoice', { invoice_id }),
  getStatus:     (b2brouter_id) => callB2B('get_invoice_status', { b2brouter_id }),
  listReceived:  () => callB2B('list_received'),
}
```

**Observation importante** : `b2b.*` est exporté mais **aucun composant/page ne l'appelle**. L'intégration est plumbée côté backend mais pas branchée dans l'UI. Aucune migration UI requise.

### 2.3 Base de données

Migration `0005_b2brouter_invoices.sql` :

```sql
-- table dédiée
create table b2b_accounts (
  id, owner_id, b2brouter_account_id, siren,
  environment text check (environment in ('staging','production')),
  created_at, updated_at
);

-- colonnes sur invoices
alter table invoices add column b2brouter_invoice_id   text;
alter table invoices add column b2brouter_status       text;
alter table invoices add column b2brouter_last_event   timestamptz;
create index invoices_b2b_idx on invoices(b2brouter_invoice_id);
```

### 2.4 Config & infra

| Fichier | Élément |
|---|---|
| `vercel.json` | rewrite `/api/b2brouter-webhook` → `/api/b2brouter?route=webhook` |
| Env Vercel | `B2B_API_KEY`, `B2B_API_URL`, `B2B_API_VERSION`, `B2B_WEBHOOK_SECRET` |
| Tests | `api/b2brouter.webhook.test.js` |
| CLAUDE.md | section « Architecture / API Vercel » + ligne `b2brouter.js` |

### 2.5 Contrainte Vercel

Plan Hobby = 12 fonctions max. Compté actuellement (fichiers déployés, hors helpers `_*.js` et tests `*.test.js`) :
```
account, admin-delete-user, admin-stats, admin-user-detail,
b2brouter, claude, devis-public, facturx, newsletter, odoo-sign, stripe
= 11/12
```
> Note : la valeur « 10/12 » dans CLAUDE.md ne compte pas `devis-public.js` — à mettre à jour.

**Renommer** `b2brouter.js` → `superpdp.js` est un swap, pas une création. Toujours 11/12.

---

## 3. Stratégie de migration

Deux options selon la doc Super PDP (à confirmer une fois la doc reçue) :

### Option A — Swap direct (recommandée si Super PDP a une API REST classique)

Renommer / réécrire `b2brouter.js` → `superpdp.js` en gardant la même architecture (un endpoint, deux modes, 4 actions). Migration DB qui renomme les tables/colonnes.

**Pour** : code uniforme, pas de doublon, pas de surcoût Vercel.
**Contre** : pas de coexistence — bascule en un coup. Nécessite que tout l'envoi de factures soit refait sur Super PDP.

### Option B — Coexistence temporaire

Ajouter `superpdp.js` à côté de `b2brouter.js` (12/12 = saturation Vercel) ou fusionner les deux dans `einvoicing.js` avec routage par champ `provider`. Migration DB additive (`pdp_*` à côté de `b2brouter_*`).

**Pour** : permet de basculer utilisateur par utilisateur, rollback facile.
**Contre** : sature les fonctions Vercel, double maintenance, double colonnes DB.

> **Recommandation** : **Option A**, vu que B2Brouter n'est pas branché dans l'UI et qu'on est en sandbox. Risque utilisateur quasi nul.

---

## 4. Plan détaillé — Option A (swap direct, multi-tenant)

### Architecture multi-tenant — point critique

⚠ Différence majeure avec B2Brouter : **chaque artisan doit avoir sa propre application OAuth Super PDP** (parce que l'app est liée à un SIREN unique). Conséquences :

1. Zenbat **ne peut pas** avoir une seule clé API partagée comme avec B2Brouter
2. Chaque artisan doit s'inscrire sur `https://www.superpdp.tech` et créer une « Application Confidentielle » avec son entreprise
3. L'artisan colle ensuite `client_id` + `client_secret` dans son profil Zenbat
4. Zenbat stocke ces credentials par utilisateur dans la table `pdp_accounts`
5. Zenbat fait `client_credentials` au runtime pour obtenir un `access_token` pour cet artisan
6. Les access_tokens sont mis en cache (table ou Supabase KV) avec leur `expires_at` (3600s par défaut)

**Sécurité du `client_secret`** : il est **équivalent à un mot de passe**. Trois options :
- **A** : stockage clair dans `pdp_accounts.client_secret` + RLS (l'artisan n'accède qu'à son secret) — simple, mais admin DB voit tout
- **B** : chiffrement AES-GCM avec une clé symétrique stockée dans Vercel env (`PDP_SECRET_ENCRYPTION_KEY`) — recommandé
- **C** : Supabase Vault (pgsodium) — meilleur, demande la fonctionnalité Vault sur le projet

> **Recommandation** : Option **B** au premier jet (simple, robuste), Option C si l'utilisateur veut activer Vault.

### Phase 1 — Migration DB

Nouvelle migration `0039_pdp_accounts.sql` :

```sql
-- ═══════════════════════════════════════════════════════════════════
-- Migration B2Brouter → Super PDP
--   - Renomme b2b_accounts en pdp_accounts
--   - Ajoute les colonnes OAuth (client_id, encrypted_client_secret)
--   - Ajoute les colonnes de cache du token (access_token, expires_at)
--   - Ajoute le curseur de polling des invoice_events
--   - Renomme les colonnes invoices.b2brouter_* en pdp_*
--   - Ajoute pdp_status_raw (code AFNOR fr:NNN)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Renommer la table et ajouter les colonnes Super PDP
alter table public.b2b_accounts rename to pdp_accounts;
alter table public.pdp_accounts rename column b2brouter_account_id to pdp_account_id;

alter table public.pdp_accounts
  add column if not exists provider text not null default 'superpdp'
    check (provider in ('superpdp')),
  add column if not exists client_id text,
  add column if not exists encrypted_client_secret bytea, -- AES-GCM (option B)
  add column if not exists secret_iv bytea,                 -- IV AES-GCM
  add column if not exists secret_tag bytea,                -- tag authentification
  add column if not exists access_token text,               -- cache du dernier token
  add column if not exists token_expires_at timestamptz,    -- expiration du cache
  add column if not exists last_event_id bigint not null default 0,  -- curseur polling
  add column if not exists last_synced_at timestamptz,
  add column if not exists company_siren text,              -- SIREN renvoyé par /companies/me
  add column if not exists company_env   text;              -- 'production' | 'sandbox'

-- 2. Renommer les colonnes invoices et ajouter pdp_status_raw
alter table public.invoices rename column b2brouter_invoice_id to pdp_invoice_id;
alter table public.invoices rename column b2brouter_status     to pdp_status;
alter table public.invoices rename column b2brouter_last_event to pdp_last_event;

alter table public.invoices
  add column if not exists pdp_status_raw text;  -- code AFNOR brut (fr:200..fr:212)

-- 3. Renommer l'index
alter index public.invoices_b2b_idx rename to invoices_pdp_idx;

-- 4. Renommer les policies RLS (le bloc DROP/CREATE est plus sûr qu'ALTER POLICY ... RENAME
--    qui n'existe que depuis PG 15)
drop policy if exists "b2b_accounts_select_own" on public.pdp_accounts;
drop policy if exists "b2b_accounts_insert_own" on public.pdp_accounts;
drop policy if exists "b2b_accounts_update_own" on public.pdp_accounts;

create policy "pdp_accounts_select_own" on public.pdp_accounts
  for select using (auth.uid() = owner_id);
create policy "pdp_accounts_insert_own" on public.pdp_accounts
  for insert with check (auth.uid() = owner_id);
create policy "pdp_accounts_update_own" on public.pdp_accounts
  for update using (auth.uid() = owner_id);

-- 5. Renommer le trigger
drop trigger if exists t_b2b_accounts_updated on public.pdp_accounts;
create trigger t_pdp_accounts_updated before update on public.pdp_accounts
  for each row execute function public.touch_updated_at();

-- 6. Index sur le curseur (pour le cron de polling)
create index if not exists pdp_accounts_last_event_idx on public.pdp_accounts(last_event_id);
```

> ⚠️ **Application manuelle Supabase** — comme toutes les migrations du projet (cf. CLAUDE.md). Prévenir l'utilisateur de copier-coller dans le SQL Editor.

### Phase 2 — Backend

Renommer `api/b2brouter.js` → `api/superpdp.js`. Architecture cible :

```js
// api/superpdp.js
// Endpoint unifié Super PDP — routage interne :
//   - URL contient ?route=poll → tâche de polling des invoice_events (auth Bearer secret cron)
//   - Sinon → POST authentifié { action, payload } pour les actions utilisateur
//
// Variables d'env :
//   PDP_API_BASE                    = https://api.superpdp.tech
//   PDP_SECRET_ENCRYPTION_KEY       = clé AES-256 hex (32 bytes) pour chiffrer les client_secret
//   PDP_CRON_SECRET                 = secret partagé pour authentifier le cron
//
// Plus de webhook entrant : Super PDP n'expose pas de webhook (polling uniquement).
```

#### Actions utilisateur (POST `/api/superpdp` avec Bearer JWT Supabase)

| Action | Rôle | Détail |
|---|---|---|
| `save_credentials` | L'artisan paste son `client_id` + `client_secret` issus de superpdp.tech | Chiffre le secret avec AES-GCM, appelle `/v1.beta/companies/me` pour valider, stocke `company_siren` + `company_env` |
| `test_connection` | Bouton « Tester ma connexion » | Force un refresh OAuth + appel `/companies/me`, retourne `{ siren, env, ok }` |
| `send_invoice` | Envoie une facture | Génère le PDF Factur-X via `api/facturx.js`, fait `POST /v1.beta/invoices` avec `Content-Type: application/pdf`, stocke l'`id` retourné dans `invoices.pdp_invoice_id`, met `statut=envoyee` + `locked=true` |
| `get_invoice_status` | Rafraîchir le statut d'une facture | `GET /v1.beta/invoices/{id}`, met à jour `pdp_status` + `pdp_status_raw` |
| `submit_event` | Soumettre manuellement un statut (ex : encaissée fr:212) | `POST /v1.beta/invoice_events` avec `details.amounts` ventilé par taux TVA |
| `disconnect` | Supprimer les credentials de l'artisan | Met à NULL `client_id`, `encrypted_client_secret`, `access_token` |

#### Tâche de polling (`?route=poll`)

Boucle :
```
pour chaque pdp_accounts ayant un client_id :
  obtenir un access_token (cache ou refresh)
  appeler GET /v1.beta/invoice_events?starting_after_id={last_event_id}
  pour chaque event { id, status_code, invoice_id } :
    UPDATE invoices SET pdp_status = mapStatus(status_code), pdp_status_raw = status_code, pdp_last_event = now()
    WHERE pdp_invoice_id = event.invoice_id AND owner_id = pdp_accounts.owner_id
    last_event_id = max(last_event_id, event.id)
  si has_after, boucler (max 50 pages par run pour éviter le runaway)
  persister last_event_id, last_synced_at
```

Mapping `status_code` → `statut` Zenbat (cf. §1-bis) :
```js
function mapStatus(code) {
  if (code === 'fr:200')                                    return 'envoyee'
  if (['fr:201','fr:203','fr:210'].includes(code))          return 'rejetee'
  if (['fr:202','fr:204','fr:206'].includes(code))          return 'recue'
  if (code === 'fr:212')                                    return 'payee'
  return null  // fr:207, fr:205, etc. : intermédiaires, ne pas changer le statut
}
```

#### Helpers chiffrement (option B retenue)

`api/_pdp_crypto.js` (nouveau helper, non déployé Vercel car commence par `_`) :
```js
import crypto from 'node:crypto';
const KEY = Buffer.from(process.env.PDP_SECRET_ENCRYPTION_KEY, 'hex'); // 32 bytes

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { ciphertext: ct, iv, tag: cipher.getAuthTag() };
}

export function decrypt({ ciphertext, iv, tag }) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
```

#### Helpers OAuth + API

`api/_pdp_client.js` :
```js
async function getAccessToken(account, admin) {
  // Si cache valide (>30s avant expiration), retourner directement
  if (account.access_token && new Date(account.token_expires_at) > new Date(Date.now() + 30_000)) {
    return account.access_token;
  }
  // Sinon refresh
  const secret = decrypt({
    ciphertext: account.encrypted_client_secret,
    iv:         account.secret_iv,
    tag:        account.secret_tag,
  });
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     account.client_id,
    client_secret: secret,
  });
  const res = await fetch(`${process.env.PDP_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`OAuth HTTP ${res.status}`);
  const data = await res.json();
  // Persister le cache
  await admin.from('pdp_accounts').update({
    access_token:      data.access_token,
    token_expires_at:  new Date(Date.now() + (data.expires_in - 30) * 1000).toISOString(),
  }).eq('owner_id', account.owner_id);
  return data.access_token;
}
```

### Phase 3 — Frontend

`src/lib/api.js:488-510` :

```js
async function callPDP(action, payload = {}) {
  const token = await getToken()
  if (!token) throw new Error('Session expirée — reconnectez-vous')
  const res = await fetch('/api/superpdp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, payload }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Super PDP HTTP ${res.status}`)
  return data
}

export const pdp = {
  saveCredentials: (creds)        => callPDP('save_credentials', creds),
  testConnection:  ()             => callPDP('test_connection'),
  sendInvoice:     (id)           => callPDP('send_invoice',     { invoice_id: id }),
  getStatus:       (id)           => callPDP('get_invoice_status', { invoice_id: id }),
  submitEvent:     (id, code, d)  => callPDP('submit_event',     { invoice_id: id, status_code: code, details: d }),
  disconnect:      ()             => callPDP('disconnect'),
}
```

**Nouvelle UI minimale** — page de configuration PDP dans le profil utilisateur :
- Champ `client_id` + `client_secret`
- Bouton « Tester » → `pdp.testConnection()` → affiche SIREN + env retournés
- Bouton « Déconnecter » → `pdp.disconnect()`
- Lien « Comment obtenir mes credentials ? » → ouvre superpdp.tech avec instructions

Bouton « Envoyer via Super PDP » à ajouter sur `InvoiceDetail.jsx` (à plumber séparément, pas couvert par la migration de base).

> Pas d'alias `b2b = pdp` — le helper actuel n'est pas appelé dans l'UI, suppression nette.

### Phase 4 — Config

`vercel.json` :
```diff
- { "source": "/api/b2brouter-webhook", "destination": "/api/b2brouter?route=webhook" },
```
La rewrite est **supprimée purement** : Super PDP n'a pas de webhook. Si on veut un trigger pour le cron, ajouter un cron Vercel ou Supabase pg_cron (cf. Phase 5).

Variables d'env Vercel :
- **Ajouter** :
  - `PDP_API_BASE=https://api.superpdp.tech`
  - `PDP_SECRET_ENCRYPTION_KEY=<32 bytes hex>` — généré une fois (`openssl rand -hex 32`), à conserver, **toute perte ou rotation rend les `client_secret` stockés inaccessibles**
  - `PDP_CRON_SECRET=<aléatoire>` — secret partagé pour authentifier l'endpoint de polling
- **Supprimer** (après validation) : `B2B_API_KEY`, `B2B_API_URL`, `B2B_API_VERSION`, `B2B_WEBHOOK_SECRET`

### Phase 5 — Polling des statuts (NOUVELLE PHASE)

⚠ Sans webhook, on **doit** lancer un job de polling régulier. Trois options :

| Option | Plan | Fréquence min | Avantages | Inconvénients |
|---|---|---|---|---|
| **Vercel Cron** | Pro requis pour <1/jour | 1/min sur Pro, 1/jour sur Hobby | Simple, dans Vercel | Requiert Pro pour 15min |
| **Supabase pg_cron** | Inclus tous plans | 1/min | Gratuit, dans la DB | Doit appeler `/api/superpdp?route=poll` via `pg_net` |
| **Cron externe** (ex: cron-job.org) | Gratuit | 1/min | Indépendant | Service tiers à monitorer |

> **Recommandation** : **Supabase pg_cron** + `pg_net` pour appeler l'endpoint Vercel toutes les 15min. Pas de coût supplémentaire, intégré au stack Zenbat.

Côté `vercel.json`, ajouter (si on retient Vercel Cron) :
```json
"crons": [
  { "path": "/api/superpdp?route=poll", "schedule": "*/15 * * * *" }
]
```

Côté Supabase (alternative) — extrait à inclure dans la migration `0039` :
```sql
-- Activer pg_net si non déjà actif
create extension if not exists pg_net with schema extensions;

-- pg_cron (déjà activé dans la plupart des projets Supabase)
select cron.schedule(
  'superpdp_poll_events',
  '*/15 * * * *',
  $$
    select net.http_post(
      url     := current_setting('app.vercel_url') || '/api/superpdp?route=poll',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.pdp_cron_secret'))
    );
  $$
);
```

Endpoint `/api/superpdp?route=poll` :
- N'autorise que les requêtes avec `Authorization: Bearer <PDP_CRON_SECRET>`
- Lit tous les `pdp_accounts` configurés, fait le polling pour chacun
- Timeout maxDuration: 60s (cf. vercel.json) — si trop d'utilisateurs, paginer et stocker un curseur de boucle

### Phase 6 — Tests & doc

- Renommer `api/b2brouter.webhook.test.js` → `api/superpdp.test.js`, adapter (plus de webhook, mais tester `save_credentials`, `getAccessToken` cache, `mapStatus`)
- Mettre à jour `CLAUDE.md` :
  - section « Vercel : limite 12 fonctions » : `b2brouter.js` → `superpdp.js`, mettre à jour le compteur réel (11/12)
  - section « API Vercel » : remplacer ligne B2Brouter par Super PDP avec description (multi-tenant OAuth, polling)
  - section « Variables d'environnement » : remplacer les vars
  - section « Bugs connus » : laisser le bug `0035` (toujours pertinent — `locked=true` est conservé après envoi)
  - **Ajouter une section « Architecture multi-tenant Super PDP »** expliquant le modèle un-artisan-une-app-OAuth
- Mettre à jour le commentaire `src/lib/api.js:334` et `src/lib/constants.js:54`

### Phase 7 — Cleanup

Une fois la migration validée en prod :
- Supprimer les vars d'env `B2B_*` côté Vercel
- Supprimer ce fichier `MIGRATION_PDP.md`
- Supprimer le test `b2brouter.webhook.test.js` (déjà renommé en phase 6)
- Vérifier qu'il ne reste plus aucune référence à `b2brouter` dans le repo : `grep -rn b2b ./src ./api`

---

## 5. Risques et points d'attention

### 5.1 Multi-tenant OAuth — chaque artisan crée sa propre app

C'est la différence d'architecture la plus impactante par rapport à B2Brouter. Conséquences :
- L'onboarding de l'artisan ajoute une étape : créer un compte sur superpdp.tech, créer une « Application Confidentielle », copier `client_id`/`client_secret` dans Zenbat
- Zenbat doit stocker des secrets — chiffrement obligatoire (cf. §4 option B)
- En cas de perte de `PDP_SECRET_ENCRYPTION_KEY`, les `client_secret` chiffrés sont **irrécupérables** — il faudra demander à chaque artisan de re-saisir ses credentials

**Mitigation** : sauvegarder `PDP_SECRET_ENCRYPTION_KEY` dans un gestionnaire de secrets externe (1Password, etc.) avant de l'ajouter à Vercel.

### 5.2 Verrouillage des factures émises

Le code B2Brouter pose `locked=true` après envoi. La policy RLS `0035` autorise la transition `locked=false → true` mais bloque l'inverse. La nouvelle implémentation Super PDP **garde le même comportement** (locked=true après `POST /v1.beta/invoices` réussi) — donc la policy `0035` reste valide. Pas de nouvelle migration RLS nécessaire.

### 5.3 Format de facture — Factur-X déjà en place

Super PDP accepte Factur-X, UBL ou CII. Zenbat dispose déjà de `api/facturx.js` qui produit du PDF/A-3 avec XML CII embarqué. **On envoie le PDF Factur-X tel quel**, content-type `application/pdf`. Aucun nouveau générateur à écrire.

### 5.4 Vérification SIREN

Au runtime de chaque envoi, vérifier que `invoice.owner.siren == pdp_accounts.company_siren` (récupéré via `/v1.beta/companies/me`). Si désaccord, refuser localement avec un message explicite plutôt que de se faire rejeter par Super PDP.

Le profil Zenbat (`profiles`) a-t-il déjà un champ SIREN ? À vérifier.

### 5.5 Polling vs webhooks — délai de remontée des statuts

Avec un cron 15min, les statuts (acceptée, refusée, encaissée) remontent avec un délai max de 15min. C'est **acceptable pour Zenbat** (vs. la latence webhook B2Brouter d'~quelques secondes), mais à mentionner dans l'UI (« mise à jour toutes les 15 minutes »).

L'utilisateur peut forcer un refresh manuel via le bouton « Rafraîchir » qui appelle `pdp.getStatus(invoiceId)`.

### 5.6 Pré-check Peppol — destinataire non inscrit

Erreur HTTP 400 documentée : `pre-check: receiver address does not exist in peppol directory`. C'est le cas le plus fréquent en phase transitoire (avant 2026/2027). À gérer côté UI :
- Avant l'obligation générale, prévenir l'artisan « Votre client n'est pas encore inscrit sur Peppol — il doit choisir une PA pour recevoir »
- Stocker l'erreur dans `invoices.notes` ou un nouveau champ `pdp_error`

### 5.7 Migration DB — colonnes renommées

La migration `0039_pdp_accounts.sql` renomme des colonnes utilisées par d'autres parties du code (`b2brouter_invoice_id`, etc.). Risque de rupture si autre code les référence. **Fait** : grep confirmé, seul `api/b2brouter.js` y touche. Mais à rejouer avant exécution :
```bash
grep -rn "b2brouter_" src/ api/ supabase/migrations/
```

### 5.8 Coût Super PDP — pay-per-call

Chaque envoi est facturé via mandat SEPA. À documenter dans la page de configuration Zenbat avec un lien vers la grille tarifaire publique. Considérer un compteur d'envois mensuel par artisan dans le dashboard.

---

## 6. Ce qu'il reste à faire / récupérer

Doc API : **OK** (collecte complète depuis exemples officiels et module Dolibarr).
Reste à faire (non-technique, à votre charge) :

1. ✅ ~~Documentation API~~ (récupérée)
2. ✅ ~~Auth scheme~~ (OAuth 2.1 client_credentials)
3. ✅ ~~URLs prod/sandbox~~ (même endpoint)
4. ⏳ **Créer un compte Zenbat sur superpdp.tech** : `https://www.superpdp.tech/app/users/create`, choisir « Je veux intégrer l'API dans un environnement bac à sable avec des données fictives »
5. ⏳ **Créer une Application Confidentielle** sur le compte sandbox : copier `client_id` + `client_secret`
6. ⏳ **Décider du modèle** : (a) chaque artisan a son propre compte Super PDP, ou (b) on commence par tester avec un seul compte test partagé pour la sandbox uniquement
7. ✅ ~~Format de facture~~ (Factur-X PDF — déjà supporté par Zenbat)
8. ✅ ~~Spec webhook~~ (pas de webhook — polling)
9. ✅ ~~Liste des statuts~~ (codes AFNOR fr:200..fr:212)
10. ✅ ~~Règles Peppol~~ (auto via app OAuth, vérifier `company_env` cohérent prod/sandbox émetteur ↔ destinataire)

À faire côté infra Zenbat avant d'attaquer le code :

- Générer `PDP_SECRET_ENCRYPTION_KEY` : `openssl rand -hex 32`, sauvegarder dans un gestionnaire de secrets, l'ajouter à Vercel env
- Générer `PDP_CRON_SECRET` : `openssl rand -hex 32`, ajouter à Vercel env + Supabase `app.pdp_cron_secret`
- Ajouter `PDP_API_BASE=https://api.superpdp.tech` à Vercel env
- (Si on choisit Supabase pg_cron) configurer `app.vercel_url` côté Supabase via `alter database postgres set app.vercel_url = '...'` — ou stocker en table `app_logs.config`

---

## 7. Checklist d'exécution

### Pré-requis (utilisateur)
- [ ] Créer le compte Super PDP sandbox + l'application Confidentielle
- [ ] Récupérer `client_id` + `client_secret` (le secret n'est affiché qu'une fois)
- [ ] Générer `PDP_SECRET_ENCRYPTION_KEY` (32 bytes hex), `PDP_CRON_SECRET`
- [ ] Ajouter les 3 env vars dans Vercel (`PDP_API_BASE`, `PDP_SECRET_ENCRYPTION_KEY`, `PDP_CRON_SECRET`)

### Code (Claude)
- [ ] Créer migration `0039_pdp_accounts.sql` (rename + add columns + RLS), prévenir l'utilisateur de l'appliquer manuellement
- [ ] Créer helpers `api/_pdp_crypto.js`, `api/_pdp_client.js` (préfixe `_` = non déployés Vercel)
- [ ] Renommer `api/b2brouter.js` → `api/superpdp.js`, réécrire avec actions OAuth + polling + Factur-X
- [ ] Mettre à jour `src/lib/api.js` : remplacer `callB2B`/`b2b` par `callPDP`/`pdp`
- [ ] Supprimer la rewrite `/api/b2brouter-webhook` de `vercel.json`
- [ ] (Optionnel) ajouter `crons` dans `vercel.json` ou pg_cron côté Supabase
- [ ] Renommer `api/b2brouter.webhook.test.js` → `api/superpdp.test.js`, adapter
- [ ] Créer page UI minimale de configuration PDP (formulaire credentials + bouton Tester)
- [ ] Ajouter bouton « Envoyer via Super PDP » sur `InvoiceDetail.jsx`
- [ ] Mettre à jour `CLAUDE.md` (4 sections : Vercel limit, API Vercel, env vars, nouvelle section multi-tenant)
- [ ] Mettre à jour les commentaires obsolètes (`src/lib/api.js:334`, `src/lib/constants.js:54`)

### Tests sandbox
- [ ] L'artisan saisit ses credentials → `pdp.testConnection()` retourne `{ ok: true, siren, env: 'sandbox' }`
- [ ] Envoyer une facture test → vérifier l'`id` retourné + statut `envoyee`/`fr:200`
- [ ] Lancer le polling manuellement → vérifier insertion d'events
- [ ] Vérifier la mise à jour `invoices.pdp_status_raw` + `pdp_status`
- [ ] Tester `submit_event` avec `fr:212` (paid) + `details.amounts`

### Cleanup post-validation
- [ ] Supprimer env vars `B2B_*` côté Vercel
- [ ] Supprimer ce fichier `MIGRATION_PDP.md`
- [ ] `grep -rn b2b ./src ./api` → 0 résultat attendu

---

## 8. Sources

- Doc HTML Super PDP : `https://www.superpdp.tech/documentation`
- OpenAPI : `https://www.superpdp.tech/openapi/` (403 sans auth — accessible une fois connecté)
- Exemple Go officiel (Authorization Code) : [`superpdp/examples/erp.go`](https://github.com/superpdp/examples/blob/main/erp.go)
- Exemple Node.js officiel (refresh_token + axios) : [`pimeo/superpdp-nodejs-oauth-example`](https://github.com/pimeo/superpdp-nodejs-oauth-example)
- Module Dolibarr en production (PHP, client HTTP complet, polling cron, mapping AFNOR) : [`hello-lemon/module-dolibarr-lemonsuperpdp`](https://github.com/hello-lemon/module-dolibarr-lemonsuperpdp)
- France Num : [Fiche SUPER PDP](https://www.francenum.gouv.fr/activateurs/super-pdp)
- Article Akretion (intégration Odoo Community) : [Akretion choisit Super PDP](https://akretion.com/fr/blog/facturation-electronique--akretion-choisit-super-pdp-comme-pdp-pour-odoo-community)
