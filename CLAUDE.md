# Zenbat — Guide développement pour Claude

SaaS de devis et facturation pour artisans français (TPE/indépendants).
Stack : React + Vite (frontend) · Vercel Serverless Functions (API) · Supabase (auth + DB) · Claude API (agent IA).

---

## Règles critiques — lire avant tout changement

### Vercel : limite 12 fonctions serverless
Le plan Hobby de Vercel autorise **maximum 12 fichiers** dans `/api/`.
Fichiers actuels (10/12 — `_cors.js` est un helper non déployé, `*.test.js` ignorés, `fonts/` est un dossier d'assets) :
```
account.js             admin-delete-user.js   admin-stats.js     admin-user-detail.js
b2brouter.js           claude.js              facturx.js         newsletter.js
odoo-sign.js           stripe.js
```
→ Ne jamais créer un nouveau fichier `/api/` sans en supprimer un autre ou fusionner des endpoints.

**Convention de fusion** : quand on doit fusionner des endpoints, on regroupe par domaine (Stripe, B2Brouter…) dans un seul fichier qui route en interne :
- soit par méthode HTTP (`account.js` : GET = export, POST = suppression)
- soit par paramètre de requête (`admin-stats.js` : `?type=conversations|logs|...`)
- soit par champ `action` dans le body (`b2brouter.js`, `stripe.js`)
- soit par présence d'un header de signature (`stripe.js` détecte le webhook via `stripe-signature`, `b2brouter.js` via `x-b2b-signature`)

Les anciennes URL externes (Stripe Dashboard, B2Brouter webhook) sont préservées via `vercel.json` rewrites.

### Migrations Supabase : application manuelle
Les fichiers dans `/supabase/migrations/` ne s'appliquent **pas automatiquement**.
L'utilisateur les copie-colle dans le SQL Editor de Supabase.
- Prévenir l'utilisateur à chaque nouvelle migration créée.
- Dernière migration appliquée : `0029_profile_signup_email.sql`
- Migration en attente d'application : `0030_support_tickets.sql` (créée, à coller dans le SQL Editor avant le déploiement du bot Telegram support).
- Prochaine migration : préfixer avec `0031_`.

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
| `b2brouter.js` | Proxy B2Brouter eDocExchange + webhook entrant (détection par header `x-b2b-signature`) |
| `claude.js` | Proxy Claude API avec timeout 28s + AbortController |
| `facturx.js` | Génération PDF Factur-X (XML CII embarqué) |
| `newsletter.js` | Inscription newsletter |
| `odoo-sign.js` | Proxy Odoo Sign (signature électronique) |
| `stripe.js` | Stripe checkout/portal/info (POST authentifié) + webhook (détection par header `stripe-signature`) |

### Architecture Telegram

Le bot Telegram est volontairement éclaté en **deux fonctions Edge** distinctes pour des raisons d'authentification :

| Fonction | Sens | Auth | Rôle |
|----------|------|------|------|
| `supabase/functions/notify-telegram/` | sortant | `verify_jwt: true` | Reçoit des événements (DB webhooks, API Vercel, front) et les pousse en HTML formaté vers le chat admin (`TELEGRAM_CHAT_ID`). Existe déjà. |
| `supabase/functions/telegram-bot/`    | entrant | `verify_jwt: false` + `TELEGRAM_WEBHOOK_SECRET` (header `X-Telegram-Bot-Api-Secret-Token`) | Reçoit le webhook Telegram (commandes admin `/stats`, `/user`, `/reply`, et messages de support relayés). À créer. |

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
Autres : `b2b_accounts`, `activity_log`, `cgu_acceptances`, `newsletter_subscribers`, `app_logs`

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
| `B2B_API_KEY` | Clé B2Brouter |
| `B2B_API_URL` | URL B2Brouter (défaut: staging) |
| `B2B_WEBHOOK_SECRET` | Secret HMAC webhook B2Brouter |
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

## Bugs connus et correctifs appliqués

- **Doublons lignes devis** : l'IA génère toujours un devis complet → remplacer `setLignes` au lieu d'accumuler. Corrigé dans `AgentIA.jsx`.
- **Drawer admin invisible** : `className="fu"` sur le wrapper AdminPanel piégeait `position:fixed`. Corrigé en retirant la classe.
- **Token périmé admin** : utiliser `getToken()` au lieu de `session?.access_token`. Corrigé dans `AdminPanel.jsx`.
- **app bloquée si Supabase indisponible** : `getSession()` sans `.catch()` laissait `loading=true` à jamais. Corrigé dans `auth.jsx`.
