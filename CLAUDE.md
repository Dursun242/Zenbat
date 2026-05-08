# Zenbat — Guide développement pour Claude

SaaS de devis et facturation pour artisans français (TPE/indépendants).
Stack : React + Vite (frontend) · Vercel Serverless Functions (API) · Supabase (auth + DB) · Claude API (agent IA).

---

## Règles critiques — lire avant tout changement

### Vercel : limite 12 fonctions serverless
Le plan Hobby de Vercel autorise **maximum 12 fichiers** dans `/api/`.
Fichiers actuels (11/12 — `_*.js` sont des helpers non déployés, `*.test.js` ignorés, `fonts/` est un dossier d'assets) :
```
account.js             admin-delete-user.js   admin-stats.js     admin-user-detail.js
claude.js              devis-public.js        facturx.js         newsletter.js
odoo-sign.js           stripe.js              superpdp.js
```
→ Ne jamais créer un nouveau fichier `/api/` sans en supprimer un autre ou fusionner des endpoints.

**Convention de fusion** : quand on doit fusionner des endpoints, on regroupe par domaine (Stripe, Super PDP…) dans un seul fichier qui route en interne :
- soit par méthode HTTP (`account.js` : GET = export, POST = suppression)
- soit par paramètre de requête (`admin-stats.js` : `?type=conversations|logs|...`, `superpdp.js` : `?route=poll`)
- soit par champ `action` dans le body (`superpdp.js`, `stripe.js`)
- soit par présence d'un header de signature (`stripe.js` détecte le webhook via `stripe-signature`)

Les anciennes URL externes (Stripe Dashboard) sont préservées via `vercel.json` rewrites.

### Migrations Supabase : application manuelle
Les fichiers dans `/supabase/migrations/` ne s'appliquent **pas automatiquement**.
L'utilisateur les copie-colle dans le SQL Editor de Supabase.
- Prévenir l'utilisateur à chaque nouvelle migration créée.
- Dernière migration appliquée : `0038_invoice_auto_liquidation.sql`
- Migration en attente d'application : `0039_pdp_accounts.sql` (rename b2b_accounts → pdp_accounts, ajout colonnes Super PDP, table pdp_state). `0040_ensure_avoir_column.sql` (filet idempotent pour `invoices.avoir_of_invoice_id` quand 0010 a été partiellement appliquée).
- Prochaine migration : préfixer avec `0041_`.

### position:fixed et animations CSS transform
Tout composant React qui contient des enfants `position:fixed` (modales, drawers, toasts)
**ne doit pas** avoir de `transform` CSS actif sur lui-même ou ses ancêtres directs.
Un `transform` (même `translateY(0)`) crée un *containing block* qui piège les éléments `position:fixed`.
→ Ne jamais mettre `className="fu"` (animation fadeUp avec transform) sur un composant contenant des `position:fixed`.

### Token d'authentification Supabase
Ne jamais utiliser `session?.access_token` depuis le state React dans les appels fetch API.
Le token peut être périmé si Supabase l'a rafraîchi silencieusement.
Toujours utiliser le helper `getToken()` :
```js
async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}
```

### safe-area-inset-top
`env(safe-area-inset-top)` s'applique uniquement sur le **padding-top** des éléments fixés en haut de l'écran.
Ne jamais l'appliquer sur le padding-bottom (3e valeur du shorthand padding).
Rappel : `padding: top right bottom left`.

---

## Architecture

### Frontend (`/src`)
```
src/
  lib/
    auth.jsx        — AuthProvider, useAuth(), supabase.auth.getSession()
    api.js          — CRUD Supabase (devis, clients, factures, profil)
    supabase.js     — client Supabase (clé publique)
    constants.js    — CLAUDE_MODEL, STATUT, DEFAULT_BRAND, TX (i18n)
    trades.js       — ALL_TRADES, searchTrades(), TRADE_EXAMPLES
    brandCompleteness.js — score de complétion du profil
  pages/
    Signup.jsx      — inscription 2 étapes (infos + métiers)
    Onboarding.jsx  — 6 étapes de configuration du profil
    AdminPanel.jsx  — panel admin (accès réservé à ADMIN_EMAIL)
  components/
    AgentIA.jsx     — agent IA de génération de devis (Claude API)
    Dashboard.jsx   — tableau de bord KPIs
    DevisDetail.jsx — détail + PDF d'un devis
    InvoiceDetail.jsx — détail + PDF d'une facture
```

### API Vercel (`/api`)
Tous les endpoints vérifient le CORS via `ALLOWED_ORIGINS` et authentifient via `supabase.auth.getUser(token)`.
Les endpoints admin vérifient en plus que `caller.email === ADMIN_EMAIL`.

| Fichier | Rôle |
|---------|------|
| `account.js` | RGPD libre-service — `GET` = export portabilité, `POST` = suppression compte |
| `admin-delete-user.js` | Suppression compte par l'admin |
| `admin-stats.js` | Stats globales + logs IA (conversations, erreurs, négatifs, feedback, newsletter, cohérence) — paramètre `?type=` |
| `admin-user-detail.js` | Données complètes d'un utilisateur (profil, devis, factures, clients, IA) |
| `claude.js` | Proxy Claude API avec timeout 28s + AbortController |
| `facturx.js` | Génération PDF Factur-X (XML CII embarqué) |
| `newsletter.js` | Inscription newsletter |
| `odoo-sign.js` | Proxy Odoo Sign (signature électronique) |
| `stripe.js` | Stripe checkout/portal/info (POST authentifié) + webhook (détection par header `stripe-signature`) |
| `superpdp.js` | Proxy Super PDP (PA agréée DGFiP) — actions authentifiées (`test_connection`, `send_invoice`, `get_invoice_status`) + polling des statuts AFNOR via `?route=poll` (auth `CRON_SECRET`). V0 single-tenant : credentials sandbox partagés en env vars |

### Architecture Telegram

Le bot Telegram est volontairement éclaté en **deux fonctions Edge** distinctes pour des raisons d'authentification :

| Fonction | Sens | Auth | Rôle |
|----------|------|------|------|
| `supabase/functions/notify-telegram/` | sortant | `verify_jwt: true` | Reçoit des événements (DB webhooks, API Vercel, front) et les pousse en HTML formaté vers le chat admin (`TELEGRAM_CHAT_ID`). |
| `supabase/functions/telegram-bot/`    | entrant | `verify_jwt: false` + `TELEGRAM_WEBHOOK_SECRET` (header `X-Telegram-Bot-Api-Secret-Token`) | Reçoit le webhook Telegram et exécute les commandes admin : `/stats`, `/user`, `/tickets`, `/reply`. Validation à deux étages (secret + chat_id whitelisté). |

Pourquoi deux fonctions :
- `notify-telegram` est appelée par des sources authentifiées Supabase (DB triggers, service_role keys) → JWT obligatoire pour la sécurité.
- Le webhook Telegram entrant est public (Telegram ne sait pas envoyer de JWT Supabase) → on doit désactiver `verify_jwt` et valider à la place le secret token Telegram.
- Mélanger les deux = devoir baisser `verify_jwt` partout, ce qui exposerait les notifications.

Ces fonctions Edge n'occupent **pas** de slot Vercel (limite 12) — les Edge Functions Supabase sont gratuites et illimitées.

Variables d'env Edge Functions (Supabase Dashboard → Project Settings → Edge Functions) :
- `TELEGRAM_BOT_TOKEN` (token @BotFather)
- `TELEGRAM_CHAT_ID` (chat_id admin via @userinfobot)
- `TELEGRAM_WEBHOOK_SECRET` (à venir — secret aléatoire passé à `setWebhook`)
- `TELEGRAM_ADMIN_CHAT_ID` (à venir — alias plus explicite si besoin de filtrer commandes admin)

### Base de données (Supabase)
Tables principales : `profiles`, `clients`, `devis`, `lignes_devis`, `invoices`, `lignes_invoices`
Tables IA : `ia_conversations`, `ia_error_logs`, `ia_negative_logs`, `ia_feedback`
Tables support : `support_tickets`, `support_messages` (migration `0030`)
Tables Super PDP : `pdp_accounts` (ex-`b2b_accounts`), `pdp_state` (curseur global polling) — migration `0039`
Autres : `activity_log`, `cgu_acceptances`, `newsletter_subscribers`, `app_logs`

RLS activé sur toutes les tables — les endpoints admin contournent via `SUPABASE_SERVICE_ROLE_KEY`.

---

## Variables d'environnement Vercel

| Variable | Usage |
|----------|-------|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publique Supabase (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service Supabase (API — bypass RLS) |
| `ANTHROPIC_KEY` | Clé API Anthropic (Claude) |
| `ADMIN_EMAIL` | Email de l'administrateur |
| `ALLOWED_ORIGINS` | Origines CORS autorisées (séparées par virgule) |
| `PDP_API_BASE` | URL Super PDP (défaut `https://api.superpdp.tech`) |
| `PDP_CLIENT_ID` | Identifiant OAuth Super PDP (sandbox v0 partagé, v1 = par-tenant) |
| `PDP_CLIENT_SECRET` | Secret OAuth Super PDP (idem) |
| `PDP_SANDBOX_RECEIVER_PEPPOL` | (sandbox v0) Adresse Peppol complète enrôlée en réception côté Super PDP, format `<scheme>:<id>` (ex `0225:315143296_6591`). Récupérée sur "lignes d'annuaire" du compte Super PDP, status receiver OK. Le scheme `0225` est l'identifiant FR-SIRENE Super PDP — l'identifiant n'est pas un SIRET classique. Sans ça, l'envoi est bloqué côté front avec message d'aide. Fallback rétrocompat : si seul `PDP_SANDBOX_RECEIVER_SIREN` est posé, on construit `0225:<siren>`. |
| `CRON_SECRET` | Secret partagé Vercel Cron / pg_cron pour `/api/superpdp?route=poll` |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (checkout / portal / abonnements) |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature webhook Stripe |
| `ODOO_URL` / `ODOO_DB` / `ODOO_USERNAME` / `ODOO_API_KEY` | Odoo Sign |

---

## Modèle IA
Défini dans `src/lib/constants.js` :
```js
export const CLAUDE_MODEL = import.meta.env.VITE_CLAUDE_MODEL || "claude-haiku-4-5-20251001"
```
Pour changer de modèle : modifier la variable d'env `VITE_CLAUDE_MODEL` dans Vercel, pas le code.

---

## Architecture Super PDP (PA / DGFiP)

Zenbat est intégré à **Super PDP** (PA agréée DGFiP) pour la facturation électronique B2B obligatoire à partir de septembre 2026.

### V0 — single shared sandbox
- Tous les artisans partagent **un seul compte sandbox Zenbat** sur Super PDP (credentials dans `PDP_CLIENT_ID` / `PDP_CLIENT_SECRET` côté Vercel env)
- Les factures de test partent avec le SIREN de la sandbox (Burger Queen `000000002`)
- Aucun mandat SEPA artisan en v0 (sandbox = gratuit)
- Permet de valider tout le flow technique avant la mise en prod

### V1 — multi-tenant (à venir)
- Chaque artisan aura sa propre application OAuth Super PDP (le SIREN est lié à l'app)
- Credentials chiffrés AES-GCM dans `pdp_accounts.encrypted_client_secret` (colonnes déjà créées en `0039`, non utilisées en v0)
- Modèle de facturation à confirmer avec Super PDP : 1 mandat SEPA Zenbat centralisé OU 1 mandat par artisan

### API Super PDP (confirmée)
- Endpoint : `https://api.superpdp.tech` (prod + sandbox = même URL, distinction via `env` retourné par `/v1.beta/companies/me`)
- Auth : OAuth 2.1 `client_credentials` sur `POST /oauth2/token`
- Envoi facture : `POST /v1.beta/invoices` avec **PDF Factur-X brut** (`Content-Type: application/pdf`) — `api/facturx.js` produit déjà le bon format
- Statuts : codes AFNOR `fr:200` à `fr:212` retournés via `GET /v1.beta/invoice_events?starting_after_id=N` (polling, **pas de webhook**)
- Polling : Vercel Cron (`vercel.json` `crons`) à `0 6 * * *` (Hobby = 1/jour). Pour 15 min : Pro requis OU pg_cron Supabase.

### Mapping statuts AFNOR → Zenbat (`api/superpdp.js#mapStatus`)
- `fr:200` → `envoyee`
- `fr:201`, `fr:203`, `fr:210` → `rejetee`
- `fr:202`, `fr:204`, `fr:206` → `recue`
- `fr:212` → `payee`
- Autres codes (`fr:205`, `fr:207`, `fr:208`) : intermédiaires, le statut Zenbat reste inchangé

### Plan de migration complet
Voir `MIGRATION_PDP.md` (sera supprimé après bascule prod réussie).

---

## Bugs connus et correctifs appliqués

- **Doublons lignes devis** : l'IA génère toujours un devis complet → remplacer `setLignes` au lieu d'accumuler. Corrigé dans `AgentIA.jsx`.
- **Drawer admin invisible** : `className="fu"` sur le wrapper AdminPanel piégeait `position:fixed`. Corrigé en retirant la classe.
- **Token périmé admin** : utiliser `getToken()` au lieu de `session?.access_token`. Corrigé dans `AdminPanel.jsx`.
- **app bloquée si Supabase indisponible** : `getSession()` sans `.catch()` laissait `loading=true` à jamais. Corrigé dans `auth.jsx`.
- **Factures émises qui repassent en brouillon à chaque session** : la migration `0022` avait ajouté `and not locked` au `WITH CHECK` de la policy `invoices_update_own`, ce qui rejetait l'UPDATE d'émission (le trigger `BEFORE UPDATE` posait `new.locked := true` avant l'évaluation du `WITH CHECK`, qui exigeait `not locked`). UPDATE rejeté silencieusement, DB inchangée, listInvoices() relisait le brouillon à la session suivante. Corrigé dans `0035_fix_rls_invoices_lock_transition.sql` — la sécurité reste assurée par le `USING` et le trigger.
