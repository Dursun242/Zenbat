# Zenbat — Guide développement pour Claude

SaaS de devis et facturation pour artisans français (TPE/indépendants).
Stack : React + Vite (frontend) · Vercel Serverless Functions (API) · Supabase (auth + DB) · Claude API (agent IA).

---

## Règles critiques — lire avant tout changement

### Vercel : limite 12 fonctions serverless
Le plan Hobby de Vercel autorise **maximum 12 fichiers** dans `/api/`.
Fichiers actuels (10/12 — les helpers `_cors.js`, `_email.js`, `_rateLimit.js`, `_withAuth.js` ne comptent pas, `*.test.js` ignorés via `.vercelignore`, `fonts/` est un dossier d'assets) :
```
account.js             admin-delete-user.js   admin-stats.js     admin-user-detail.js
claude.js              contact.js             devis-public.js    facturx.js
newsletter.js          stripe.js
```
→ Avant tout nouvel endpoint : vérifier la marge restante et préférer fusionner par domaine (header de signature, paramètre `?route=`, champ `action` du body).

**Convention de fusion** : quand on doit fusionner des endpoints, on regroupe par domaine dans un seul fichier qui route en interne :
- soit par méthode HTTP (`account.js` : GET = export, POST = suppression)
- soit par paramètre de requête (`admin-stats.js` : `?type=conversations|logs|...`)
- soit par champ `action` dans le body (`stripe.js`, `devis-public.js`)
- soit par présence d'un header de signature (`stripe.js` détecte le webhook via `stripe-signature`)

L'ancienne URL externe (Stripe Dashboard `/api/stripe-checkout`, `/api/stripe-webhook`) est préservée via `vercel.json` rewrites.

### Migrations Supabase : application manuelle
Les fichiers dans `/supabase/migrations/` ne s'appliquent **pas automatiquement**.
L'utilisateur les copie-colle dans le SQL Editor de Supabase.
- Prévenir l'utilisateur à chaque nouvelle migration créée.
- Dernière migration appliquée : `0040_drop_odoo_b2b.sql` (destructif — drop des colonnes et table héritées des intégrations Odoo Sign / B2Brouter retirées).
- Aucune migration en attente.
- Prochaine migration à créer : préfixer avec `0041_`.

**Pas d'historique fiable des migrations effectivement passées** : Supabase n'a pas de mécanisme natif (type `schema_migrations`) qui tracke ce que l'utilisateur a appliqué. Un trou est possible — exemple vécu : la migration `0007_signed_by.sql` avait été sautée alors que `0032`→`0040` étaient appliquées, ce qui faisait silencieusement échouer toute requête SQL qui sélectionnait `signed_by`.

→ **Règle défensive pour le code serveur** : quand une requête lit ou écrit une colonne ajoutée par une migration ancienne, l'envelopper dans un fallback qui catch le code Postgres `42703` (column does not exist) et retente sans cette colonne. Le pattern existe déjà dans `src/lib/api.js` (`updateDevis`) et `api/devis-public.js` (GET `select` + action `accept`).

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
    pdfBuilder.js   — générateur PDF côté navigateur (jsPDF). Polices DejaVu Sans + Caveat (cursive) embarquées via VFS pour conformité PDF/A-3 et tracé manuscrit du nom signataire dans le bloc "Bon pour accord".
  pages/
    Signup.jsx      — inscription 2 étapes (infos + métiers)
    Onboarding.jsx  — 6 étapes de configuration du profil
    AdminPanel.jsx  — panel admin (accès réservé à ADMIN_EMAIL)
    DevisPublicPage.jsx — page publique de signature client. Phases : `loading` → `verify` (OTP) → `view` → `signing` (loader pendant génération + envoi PDF) → `accepted` / `refused`. Le PDF signé est généré côté navigateur (pdfBuilder) puis posté en base64 à `/api/devis-public` action `send_signed_pdf`.
  components/
    AgentIA.jsx     — agent IA de génération de devis (Claude API)
    Dashboard.jsx   — tableau de bord KPIs
    DevisDetail.jsx — détail + PDF d'un devis
    InvoiceDetail.jsx — détail + PDF d'une facture
```

Polices embarquées dans `/public/fonts/` (servies en TTF) :
- `DejaVuSans.ttf` + `DejaVuSans-Bold.ttf` — police principale du PDF (Latin étendu, requise pour PDF/A-3 Factur-X).
- `Caveat-Regular.ttf` — police manuscrite (OFL) utilisée uniquement pour le tracé du nom dans le cartouche signature client. Auto-shrink 22pt → 14pt si le nom déborde. Servie aussi en `@font-face` dans `src/index.css` pour que l'aperçu HTML matche le PDF exporté.

### API Vercel (`/api`)
Tous les endpoints vérifient le CORS via `ALLOWED_ORIGINS` et authentifient via `supabase.auth.getUser(token)`.
Les endpoints admin vérifient en plus que `caller.email === ADMIN_EMAIL`.

Helpers non déployés (préfixés `_`, importés par les endpoints) :
- `_cors.js` — gestion CORS centralisée
- `_email.js` — envoi email (Gmail SMTP via nodemailer, fallback Brevo)
- `_withAuth.js` — middleware `authenticate(req, res, { adminOnly? })`
- `_rateLimit.js` — rate-limiter in-memory par IP (utilisé sur `contact.js`, `newsletter.js`, `devis-public.js` action `request_otp`). Désactivé en env test (`VITEST`).

| Fichier | Rôle |
|---------|------|
| `account.js` | RGPD libre-service — `GET` = export portabilité, `POST` = suppression compte ou envoi comptable |
| `admin-delete-user.js` | Suppression compte par l'admin |
| `admin-stats.js` | Stats globales + logs IA (conversations, erreurs, négatifs, feedback, newsletter, cohérence) — paramètre `?type=` |
| `admin-user-detail.js` | Données complètes d'un utilisateur (profil, devis, factures, clients, IA) |
| `claude.js` | Proxy Claude API avec timeout 28s + AbortController |
| `contact.js` | Formulaire de contact public — POST avec honeypot anti-bot, envoie un email à l'admin |
| `devis-public.js` | Endpoint public pour signature client de devis — token + OTP 8 chiffres + audit, multi-routes par `action` (`send`, `request_otp`, `verify_otp`, `accept`, `refuse`, `negotiate`, `artisan_respond`, `send_signed_pdf`). `send_signed_pdf` reçoit le PDF généré côté navigateur en base64 et l'email en pièce jointe au client + à l'artisan ; idempotence via audit log (`event = 'signed_pdf_sent'`). |
| `facturx.js` | Génération PDF Factur-X (XML CII embarqué) |
| `newsletter.js` | Inscription newsletter |
| `stripe.js` | Stripe checkout/portal/info (POST authentifié) + webhook (détection par header `stripe-signature`) |

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
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (checkout / portal / abonnements) |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature webhook Stripe |

> Variables d'env caduques (à supprimer côté Vercel) : `B2B_API_KEY`, `B2B_API_URL`, `B2B_WEBHOOK_SECRET`, `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`.

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
- **Factures émises qui repassent en brouillon à chaque session** : la migration `0022` avait ajouté `and not locked` au `WITH CHECK` de la policy `invoices_update_own`, ce qui rejetait l'UPDATE d'émission (le trigger `BEFORE UPDATE` posait `new.locked := true` avant l'évaluation du `WITH CHECK`, qui exigeait `not locked`). UPDATE rejeté silencieusement, DB inchangée, listInvoices() relisait le brouillon à la session suivante. Corrigé dans `0035_fix_rls_invoices_lock_transition.sql` — la sécurité reste assurée par le `USING` et le trigger.
- **Page publique devis 404 "Lien introuvable" sur DB sans migration 0007** : le `GET /api/devis-public?token=...` sélectionnait la colonne `signed_by` (migration `0007_signed_by.sql`), absente de la DB de l'utilisateur alors que toutes les migrations 0032+ étaient appliquées. Postgres renvoyait `42703 column does not exist` → supabase-js renvoyait `error` truthy → handler retournait 404. Corrigé dans `api/devis-public.js` par un fallback `42703` qui retente le SELECT et l'UPDATE sans `signed_by` (et la signature manuscrite tombe en fallback sur `client_name`).
