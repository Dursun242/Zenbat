# Migration B2Brouter → Super PDP

Plan de migration de l'intégration de facturation électronique de B2Brouter vers Super PDP (PDP — Plateforme de Dématérialisation Partenaire).

> Statut : **plan uniquement, aucun code écrit**.
> Bloqué sur : doc API Super PDP + credentials sandbox (token, URL, format payload, format webhook).
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

## 4. Plan détaillé — Option A (swap direct)

### Phase 1 — Migration DB

Nouvelle migration `0039_pdp_rename.sql` :

```sql
-- 1. Renommer la table
alter table public.b2b_accounts rename to pdp_accounts;
alter table public.pdp_accounts rename column b2brouter_account_id to pdp_account_id;
-- Optionnel : ajouter colonne `provider text default 'superpdp'` pour anticiper multi-PDP

-- 2. Renommer les colonnes invoices
alter table public.invoices rename column b2brouter_invoice_id to pdp_invoice_id;
alter table public.invoices rename column b2brouter_status     to pdp_status;
alter table public.invoices rename column b2brouter_last_event to pdp_last_event;

-- 3. Renommer l'index
alter index public.invoices_b2b_idx rename to invoices_pdp_idx;

-- 4. Renommer les policies RLS
alter policy "b2b_accounts_select_own" on public.pdp_accounts rename to "pdp_accounts_select_own";
alter policy "b2b_accounts_insert_own" on public.pdp_accounts rename to "pdp_accounts_insert_own";
alter policy "b2b_accounts_update_own" on public.pdp_accounts rename to "pdp_accounts_update_own";

-- 5. Renommer le trigger
drop trigger if exists t_b2b_accounts_updated on public.pdp_accounts;
create trigger t_pdp_accounts_updated before update on public.pdp_accounts
  for each row execute function public.touch_updated_at();
```

> ⚠️ **Application manuelle Supabase** — comme toutes les migrations du projet (cf. CLAUDE.md). Prévenir l'utilisateur de copier-coller dans le SQL Editor.

### Phase 2 — Backend

Renommer `api/b2brouter.js` → `api/superpdp.js`. Réécrire avec :

```js
// api/superpdp.js
// Routage interne :
//   - Header `x-superpdp-signature` (ou équivalent — à confirmer doc) → webhook
//   - Sinon → POST authentifié { action, payload }
//
// Variables d'env : SUPERPDP_API_KEY, SUPERPDP_API_URL, SUPERPDP_WEBHOOK_SECRET
//
// URL externe webhook (à configurer côté Super PDP) :
//   /api/superpdp-webhook → rewrite vers /api/superpdp?route=webhook
```

Actions (mêmes noms, payload à adapter selon doc) :
- `ensure_account` — créer/synchroniser le compte Super PDP de l'artisan
- `send_invoice` — envoyer une facture (probablement format **UBL 2.1** ou **Factur-X** selon Super PDP)
- `get_invoice_status` — interroger le statut côté PDP
- `list_received` — lister les factures reçues sur l'annuaire Peppol de l'utilisateur

**Points à clarifier avec la doc Super PDP :**

| Question | Impact |
|---|---|
| Auth : Bearer token, API key header, OAuth2 ? | en-têtes du `fetch()` |
| URL base sandbox vs production | `SUPERPDP_API_URL` |
| Format payload facture : JSON propriétaire ? UBL XML ? Factur-X PDF/A-3 ? | `buildInvoicePayload()` à réécrire — possiblement utiliser `api/facturx.js` qui génère déjà le XML CII embarqué |
| Webhook : algo HMAC, header signature, payload format | `handleWebhook()` |
| Mapping statuts Super PDP → statuts Zenbat | `mapStatus()` |
| Création compte : SIREN suffit ? Nécessite enregistrement annuaire Peppol séparé ? | `ensure_account` |
| Adresse Peppol (`0225:SIREN_ID`) : auto-générée ou à fournir ? | DB : ajouter colonne `peppol_address` ? |

### Phase 3 — Frontend

`src/lib/api.js:488-510` — renommage simple :

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
  ensureAccount: (info) => callPDP('ensure_account', info),
  sendInvoice:   (id)   => callPDP('send_invoice', { invoice_id: id }),
  getStatus:     (id)   => callPDP('get_invoice_status', { pdp_invoice_id: id }),
  listReceived:  ()     => callPDP('list_received'),
}
```

Garder un alias `export const b2b = pdp;` **temporairement** si quelqu'un dépend du nom (probablement non, vu qu'aucun composant ne l'appelle), puis supprimer en phase 5.

### Phase 4 — Config

`vercel.json` :
```diff
- { "source": "/api/b2brouter-webhook", "destination": "/api/b2brouter?route=webhook" },
+ { "source": "/api/superpdp-webhook",  "destination": "/api/superpdp?route=webhook" },
```

> ⚠️ Si l'URL webhook B2Brouter actuelle est déjà configurée chez B2Brouter, garder l'ancienne rewrite **temporairement** (elle pointera vers `/api/superpdp` qui n'aura plus de logique B2Brouter — donc à supprimer une fois la migration validée).

Variables d'env Vercel :
- **Ajouter** : `SUPERPDP_API_KEY`, `SUPERPDP_API_URL`, `SUPERPDP_WEBHOOK_SECRET`
- **Supprimer** (après validation) : `B2B_API_KEY`, `B2B_API_URL`, `B2B_API_VERSION`, `B2B_WEBHOOK_SECRET`

### Phase 5 — Tests & doc

- Renommer `api/b2brouter.webhook.test.js` → `api/superpdp.webhook.test.js`, adapter signature header + payload
- Mettre à jour `CLAUDE.md` :
  - section « Vercel : limite 12 fonctions » : `b2brouter.js` → `superpdp.js`, recompter (11/12 → 11/12 inchangé)
  - section « API Vercel » : remplacer ligne B2Brouter
  - section « Variables d'environnement » : remplacer les 4 vars
  - section « Bugs connus » : pas de changement (les bugs B2Brouter listés ne s'appliquent plus)
- Mettre à jour le commentaire `src/lib/api.js:334` (« B2Brouter » → « Super PDP / PDP »)
- Mettre à jour `src/lib/constants.js:54` (commentaire)

### Phase 6 — Cleanup

Une fois la migration validée en prod :
- Supprimer la rewrite `/api/b2brouter-webhook` de `vercel.json`
- Supprimer les vars d'env `B2B_*` côté Vercel
- Supprimer l'alias `b2b = pdp` de `src/lib/api.js` (s'il a été ajouté)
- Supprimer `MIGRATION_PDP.md`

---

## 5. Risques et points d'attention

### 5.1 Verrouillage des factures émises

Le code B2Brouter pose `locked=true` après envoi (ligne 235). C'est ce qui a causé le bug `0035` (RLS rejetait l'UPDATE). La nouvelle implémentation Super PDP **doit** :
- Soit garder `locked=true` (et la policy `0035` continue de fonctionner)
- Soit ne pas verrouiller (auquel cas la RLS reste cohérente sans changement)

À ne **pas** modifier sans réfléchir aux implications RLS (cf. CLAUDE.md « Bugs connus »).

### 5.2 Format de facture

Si Super PDP exige du **Factur-X** (PDF/A-3 + XML CII embarqué), on a déjà `api/facturx.js` qui le produit. Il faudra appeler ce générateur depuis `superpdp.js` au lieu de construire un payload JSON. Cela simplifie : le PDF est généré et envoyé directement à Super PDP plutôt que reconstruit côté PDP.

Si Super PDP veut juste de l'**UBL 2.1 XML** : à écrire (pas encore présent dans Zenbat).

### 5.3 Compte Peppol

La capture montre que l'enregistrement à l'annuaire Peppol est une étape distincte (« Nouvelle ligne d'annuaire » + status « En cours »). Il faudra peut-être :
- Soit que l'utilisateur le fasse manuellement dans Super PDP avant de pouvoir envoyer
- Soit que `ensure_account` déclenche aussi l'enregistrement Peppol côté API
- Soit ajouter une action `register_peppol` séparée

À clarifier avec la doc.

### 5.4 SIREN vs SIRET

`b2b_accounts.siren` ne stocke que les 9 chiffres. La capture montre `315143296_6591` qui ressemble à un SIREN + suffixe. Vérifier si Super PDP a besoin du SIRET complet (14 chiffres) ou juste du SIREN.

### 5.5 Migration DB irréversible

La migration `0039_pdp_rename.sql` est **destructive en termes de schéma** (renames). Pour rollback, il faudrait une migration `0040_pdp_rollback.sql` qui inverse. Tester sur la base sandbox avant production.

---

## 6. Ce dont j'ai besoin pour avancer

Avant de coder quoi que ce soit, il me faut côté Super PDP :

1. **Documentation API** (endpoints, méthodes, payload, codes d'erreur)
2. **Schéma d'authentification** (Bearer ? API Key header ? OAuth ?)
3. **URL sandbox** + **URL production**
4. **Credentials sandbox** : token/clé pour les tests
5. **Format de facture attendu** (JSON / UBL XML / Factur-X PDF)
6. **Spec webhook** : header de signature, algo HMAC, format event
7. **Liste des statuts retournés** (pour adapter `mapStatus()`)
8. **Règles enregistrement Peppol** : auto ou manuel ?

Sans ces éléments, tout code écrit est de la spéculation et risque d'être jeté.

---

## 7. Checklist d'exécution (à dérouler une fois la doc reçue)

- [ ] Créer migration `0039_pdp_rename.sql`, prévenir l'utilisateur
- [ ] Renommer `api/b2brouter.js` → `api/superpdp.js`, réécrire avec endpoints Super PDP
- [ ] Renommer `b2b` → `pdp` dans `src/lib/api.js`
- [ ] Mettre à jour `vercel.json` (rewrite)
- [ ] Renommer le test `b2brouter.webhook.test.js` → `superpdp.webhook.test.js`, adapter
- [ ] Mettre à jour `CLAUDE.md` (3 sections)
- [ ] Ajouter env vars `SUPERPDP_*` dans Vercel
- [ ] Tester en sandbox : `ensure_account` → `send_invoice` → vérifier statut webhook
- [ ] Configurer URL webhook côté Super PDP : `https://<vercel-url>/api/superpdp-webhook`
- [ ] Une fois validé : supprimer env vars `B2B_*`, supprimer rewrite `/api/b2brouter-webhook`, supprimer alias `b2b`
- [ ] Supprimer ce fichier `MIGRATION_PDP.md`
