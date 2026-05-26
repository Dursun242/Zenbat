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

### Migrations Supabase : application manuelle + tracking depuis 0043
Les fichiers dans `/supabase/migrations/` ne s'appliquent **pas automatiquement**.
L'utilisateur les copie-colle dans le SQL Editor de Supabase.
- Prévenir l'utilisateur à chaque nouvelle migration créée.
- Dernière migration appliquée connue : `0042_stripe_webhook_idempotency.sql`.
- **Migrations en attente d'application** :
  - `0041_fix_devis_week_count_null.sql` — fix critique qui empêche tout nouveau freemium de créer son tout premier devis (bug RLS sur la policy `devis_insert_freemium_weekly_limit`, cf. section Bugs connus).
  - `0043_schema_migrations.sql` — crée la table de tracking (cf ci-dessous).
  - `0047_devis_negociation_status.sql` — étend la CHECK constraint `devis_statut_check` pour autoriser `'en_negociation'`. Sans cette migration, toute négociation client échoue silencieusement à mettre à jour le statut du devis (cf. section Bugs connus).
  - `0049_invoices_sent_to_client.sql` — ajoute `invoices.sent_to_client_at` + `sent_to_client_count` pour tracker l'envoi par email du PDF Factur-X au client (action `send` de `api/facturx.js`). `api/facturx.js` catche le 42703 si la migration n'est pas appliquée — l'email part quand même, seul le tracking en DB est sauté.
  - `0050_support_notif_purge.sql` — ajoute `support_tickets.user_last_seen_at` (badge "non lu" côté front, lu par `useSupportUnread`) + fonction `purge_old_support_tickets()` planifiée toutes les heures via pg_cron pour effacer les tickets dont `last_message_at` remonte à plus de 36h (CASCADE sur `support_messages`). ⚠ Prérequis : activer l'extension `pg_cron` côté Dashboard Supabase (Database → Extensions) avant d'appliquer la migration, sinon le `create extension` échoue. Diagnostic du job : `SELECT * FROM cron.job WHERE jobname = 'purge-support-tickets-36h';` et `SELECT * FROM cron.job_run_details WHERE jobname = 'purge-support-tickets-36h' ORDER BY start_time DESC LIMIT 10;`.
  - `0052_welcome_tuto_resent.sql` — ajoute `profiles.welcome_tuto_resent_at` pour tracker le renvoi manuel du mail tuto de bienvenue depuis le panel admin (section "Onboarding — comptes sans devis", composant `AdminOnboardingTargets`). Sans cette migration, l'UPDATE en fin de POST `send_welcome_tuto` (dans `admin-stats.js`) échoue silencieusement — le mail part quand même mais le bouton "✓ Envoyé" ne reste pas mémorisé entre les rechargements.
- Prochaine migration à créer : préfixer avec `0053_`.

**Tracking depuis 0043** : la table `public.schema_migrations(version, label, applied_at)` est créée par la migration `0043`. À partir de là, chaque nouvelle migration **doit** se terminer par un INSERT idempotent qui s'auto-enregistre :
```sql
insert into public.schema_migrations (version, label, applied_at)
values ('0044', 'libellé court', now())
on conflict (version) do nothing;
```
Diagnostic à tout moment : `SELECT version, label, applied_at FROM public.schema_migrations ORDER BY version DESC LIMIT 20;`. Les migrations 0001-0042 ne sont pas rétro-marquées (on ne ment pas à la table) — l'utilisateur peut backfiller manuellement les versions qu'il a déjà appliquées s'il veut un historique complet (cf en-tête de `0043_schema_migrations.sql`).

**Historique antérieur à 0043 non fiable** : Supabase n'a pas de mécanisme natif qui tracke ce que l'utilisateur a appliqué avant 0043. Un trou est possible — exemple vécu : la migration `0007_signed_by.sql` avait été sautée alors que `0032`→`0040` étaient appliquées, ce qui faisait silencieusement échouer toute requête SQL qui sélectionnait `signed_by`.

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
| `facturx.js` | Génération PDF Factur-X (XML CII embarqué). Multi-actions par champ `action` du body : par défaut = assemble + uploade en Storage ; `action: 'send'` = télécharge le PDF depuis Storage et l'envoie par email au client (au nom de `brand.companyName`, avec Reply-To = `brand.email`), met à jour `invoices.sent_to_client_at`. |
| `newsletter.js` | Inscription newsletter |
| `stripe.js` | Stripe checkout/portal/info (POST authentifié) + webhook (détection par header `stripe-signature`) |

### Architecture Telegram

Le bot Telegram est volontairement éclaté en **deux fonctions Edge** distinctes pour des raisons d'authentification :

| Fonction | Sens | Auth | Rôle |
|----------|------|------|------|
| `supabase/functions/notify-telegram/` | sortant | `verify_jwt: true` | Reçoit des événements (DB webhooks, API Vercel, front) et les pousse en HTML formaté vers le chat admin (`TELEGRAM_CHAT_ID`). |
| `supabase/functions/telegram-bot/`    | entrant | `verify_jwt: false` + `TELEGRAM_WEBHOOK_SECRET` (header `X-Telegram-Bot-Api-Secret-Token`) | Reçoit le webhook Telegram et exécute les commandes admin : `/stats`, `/user`, `/tickets`, `/reply`. Validation à deux étages (secret + chat_id whitelisté). |
| `supabase/functions/welcome-email/`   | sortant | `verify_jwt: true` | Déclenché par DB Webhook sur `INSERT INTO profiles`. Récupère l'email depuis `auth.users`, envoie l'email de bienvenue via Resend (template HTML : mini-tuto 4 étapes + mention conformité Factur-X 2026). |

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
- `RESEND_API_KEY` (clé API Resend pour `welcome-email`)
- `RESEND_FROM` (optionnel — expéditeur, ex. `"Zenbat <onboarding@zenbat.fr>"`, fallback `onboarding@resend.dev`)
- `ZENBAT_APP_URL` (optionnel — URL du dashboard dans le CTA de l'email, fallback `https://zenbat.vercel.app`)

**Setup DB Webhook pour `welcome-email`** (à faire une fois côté Supabase Dashboard) :
1. Database → Webhooks → Create a new hook
2. Table : `profiles`, Events : `INSERT`
3. Type : HTTP Request, Method : POST
4. URL : `https://<project-ref>.supabase.co/functions/v1/welcome-email`
5. HTTP Headers : `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (Supabase l'ajoute automatiquement si on coche "Use service role key")
6. HTTP Params : laisser vide

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

## Travail en attente — intégration Super PDP (réforme facturation B2B 2026/2027)

**État : code écrit, testé en sandbox, jamais mergé sur `main`.**

L'intégration **Super PDP** (Plateforme Agréée DGFiP) a été développée lors d'une grosse séance et validée en preview Vercel (envoi de factures sandbox fonctionnel). Elle vit aujourd'hui sur 3 branches non-mergées du remote :

| Branche origin | Rôle |
|---|---|
| `claude/audit-einvoicing-integration-awnev` | Audit faisabilité 850 lignes (`audit-einvoicing.md`) |
| `claude/add-dpd-integration-x5GRw` | 1ʳᵉ itération + fixes Peppol BT-34/BT-49 |
| `claude/integrate-superdpd-ZpSGG` | **Version la plus avancée** : superpdp.js (361 lignes) + tests (159 lignes, 13 cas) + migration `0039_pdp_accounts.sql` + bouton UI |

**Plan de reprise complet** : voir [`docs/superpdp/REPRISE.md`](docs/superpdp/REPRISE.md). Il contient :
- spec API SuperPDP confirmée (OAuth 2.1, `POST /v1.beta/invoices` binaire, polling `/v1.beta/invoice_events`, mapping AFNOR `fr:2xx` → statuts Zenbat)
- variables d'env à poser (`PDP_CLIENT_ID`, `PDP_CLIENT_SECRET`, `PDP_API_BASE`, `PDP_SANDBOX_RECEIVER_PEPPOL`, `CRON_SECRET`)
- conflits à résoudre au rebase (migrations à renuméroter `0039`→`0044` et `0040`→`0045`, `InvoiceDetail.jsx` à fusionner avec PRs #28/#60/#61/#69, `vercel.json` cron + maxDuration)
- plan d'exécution en 10 étapes

→ **Ne pas relancer cette intégration sans relire `docs/superpdp/REPRISE.md` d'abord.** Et confirmer avec l'utilisateur que les credentials sandbox Super PDP sont toujours valides.

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
- **Factures émises qui repassent en brouillon à chaque session** : la migration `0022` avait ajouté `and not locked` au `WITH CHECK` de la policy `invoices_update_own`, ce qui rejetait l'UPDATE d'émission (le trigger `BEFORE UPDATE` posait `new.locked := true` avant l'évaluation du `WITH CHECK`, qui exigeait `not locked`). UPDATE rejeté silencieusement, DB inchangée, listInvoices() relisait le brouillon à la session suivante. Première correction : `0035_fix_rls_invoices_lock_transition.sql`. **Récidive observée** sur certaines installations (probablement 0035 non appliqué, ou regression d'une autre policy) → toast "Impossible de sauvegarder la facture" affiché en plus de la perte d'état. **Fix défensif** : la transition `brouillon → envoyee + locked=true` est désormais faite server-side dans `api/facturx.js` via `admin` (service_role) qui bypasse la RLS. Côté client, `useInvoices.js` accepte un 3ᵉ argument `skipPersist=true` à `onSaveInvoice` pour synchroniser le state local sans ré-UPDATE (qui échouerait sur USING `not locked` puisque la ligne vient d'être verrouillée). Le serveur retourne `{ locked, statut }` dans la réponse pour que le client se synchronise sur l'état réel de la DB.
- **Page publique devis 404 "Lien introuvable" sur DB sans migration 0007** : le `GET /api/devis-public?token=...` sélectionnait la colonne `signed_by` (migration `0007_signed_by.sql`), absente de la DB de l'utilisateur alors que toutes les migrations 0032+ étaient appliquées. Postgres renvoyait `42703 column does not exist` → supabase-js renvoyait `error` truthy → handler retournait 404. Corrigé dans `api/devis-public.js` par un fallback `42703` qui retente le SELECT et l'UPDATE sans `signed_by` (et la signature manuscrite tombe en fallback sur `client_name`).
- **Nouvel inscrit freemium bloqué sur son 1er devis** : la fonction SQL `public.devis_week_count(uid)` créée par la migration `0039` faisait `SELECT coalesce(count, 0) FROM devis_weekly_counters WHERE owner_id = uid AND week_start = ...`. Pour un nouvel inscrit sans ligne dans cette table, le SELECT renvoyait 0 row → la fonction renvoyait NULL (pas 0). La policy RLS `devis_insert_freemium_weekly_limit` évaluait alors `(user_plan = 'pro' OR NULL < 5)` = `(false OR NULL)` = NULL, et WITH CHECK rejetait l'INSERT (NULL ≠ TRUE) avec le code Postgres 42501. Côté front, `useDevis.js` catchait ce code comme un quota dépassé et affichait le paywall. Chicken-and-egg : le trigger d'incrément `devis_incr_weekly_counter` ne tournait jamais (after insert, mais l'insert était bloqué), donc la ligne dans `devis_weekly_counters` n'était jamais créée → le bug se reproduisait à l'infini. Conséquence directe : impossible pour tout nouveau freemium de créer un devis depuis le déploiement de 0039. Bonus : un compteur localStorage sticky non-scopé par user.id faisait également hériter le compteur de l'utilisateur précédent (5/5 affiché pour un nouvel inscrit). Corrigé par : (1) migration `0041_fix_devis_week_count_null.sql` qui enveloppe le SELECT dans un COALESCE externe pour qu'absence de ligne = 0 ; (2) `src/lib/appShell.js` scope la clé localStorage par user.id.
- **Négociation client invisible côté artisan (email reçu, statut figé à "Envoyé")** : la migration `0019_devis_indices.sql` redéfinit la contrainte `devis_statut_check` avec la liste `('brouillon','envoye','en_signature','accepte','refuse','remplace')` — `'en_negociation'` y a été oublié alors que le statut est utilisé partout dans le code (`api/devis-public.js` action `negotiate`, `src/lib/constants.js`, badge nav, filtre liste). Quand le client envoyait une demande de modification, l'UPDATE `statut = 'en_negociation'` était rejeté côté Postgres par check violation, mais supabase-js renvoie ce genre d'erreur dans `.error` sans throw — et le code n'inspectait pas ce champ. La négociation s'insérait correctement dans `devis_negotiations` + `devis_audit_log`, l'email partait à l'artisan, le webhook Telegram aussi, mais le devis restait à `'envoye'` côté DB. Conséquence : aucun badge "Négociation" dans la navigation, pas de bannière dans la liste, le devis ne change pas de statut dans l'app. Corrigé par : (1) migration `0047_devis_negociation_status.sql` qui ajoute `'en_negociation'` à la CHECK constraint ; (2) `api/devis-public.js` log explicitement les erreurs d'UPDATE désormais pour éviter qu'un futur enum ajouté à un endroit retombe dans le piège ; (3) `src/hooks/useDevis.js` refetch les devis sur `visibilitychange/focus` pour que l'artisan voie le nouveau statut sans avoir à recharger la page (cas typique : il revient sur l'onglet après avoir lu l'email).
- **Émission facture silencieusement bloquée par un logo trop lourd** : symptôme prêteur à confusion — l'utilisateur clique « Émettre », voit la notification Telegram `pdf_generated` partir (« X a envoyé facture FAC-XXX à Y »), pense que c'est émis, mais la facture reste en `brouillon` en DB et **aucune notif `🧾 Facture FAC-XXX : brouillon → envoyée`** n'apparaît dans Telegram. Cause : le user a uploadé une photo iPhone non redimensionnée (4000×3000 px ≈ 3-10 Mo en data:image/jpeg;base64,…) comme logo via l'onboarding. La fonction `loadImgAsPng` de `src/lib/pdfBuilder.js` créait un canvas aux dimensions natives → `canvas.toDataURL("image/png")` produisait un PNG de plusieurs Mo → jsPDF embarquait → PDF final 3-10 Mo → base64 dans le body JSON de `POST /api/facturx` ≈ 4-13 Mo → **dépasse la limite body Vercel** (4,5 Mo Hobby / 4 Mo Edge) → la requête est rejetée par Vercel **avant** que la fonction ne tourne → l'UPDATE `brouillon → envoyée` ne s'exécute jamais. La notif Telegram `pdf_generated` part quand même parce qu'elle est émise *avant* l'appel API depuis `notifyAdminPdf` côté client. Corrigé par : (1) `src/lib/pdfBuilder.js:loadImgAsPng` borne désormais à 800×300 px max (ratio préservé, bicubique) — couvre largement les 50×14 mm du PDF à 300 DPI ; (2) `src/components/onboarding/BrandingStep.jsx:handleLogo` downscale + recompresse à l'upload (PNG si transparence, JPEG quality 0.88 sinon) → la photo est stockée petite directement dans `brand_data`. Diagnostic facile pour la prochaine fois : si la taille du PDF dans Telegram dépasse 1 Mo, c'est suspect.
- **Émission facture impossible sur iOS Safari : « Erreur génération Factur-X : The string did not match the expected pattern. »** : symptôme spécifique à iOS Safari (le dev voyait l'émission marcher sur desktop Chrome). Le bouton « 🔒 Émettre » dans `InvoiceDetail.jsx` faisait `Uint8Array.from(atob(data.pdf_base64), c => c.charCodeAt(0))` pour décoder le PDF Factur-X renvoyé par `/api/facturx`. Or l'implémentation `atob()` de WebKit (iOS Safari) est plus stricte que celle de V8 (Chrome) : elle rejette toute chaîne contenant le moindre caractère hors alphabet base64 strict (espace, tab, retour à la ligne, etc.) avec ce message exact. La cause précise du whitespace côté serveur n'a pas été reproduite localement (Node `Buffer.toString('base64')` ne devrait pas en insérer), mais le fix défensif est appliqué aux deux extrémités : (1) `src/components/InvoiceDetail.jsx:82` remplace `atob()` par `fetch(\`data:application/pdf;base64,${cleanB64}\`).then(r => r.blob())` — le décodeur interne du navigateur via data: URL est plus tolérant et n'a pas la limite de taille de String, et un `.replace(/\s/g, "")` préalable nettoie tout whitespace résiduel ; (2) `src/lib/pdfBuilder.js:575` strip le whitespace de `dataUri.split(",")[1]` avant de retourner la base64 (ceinture et bretelles côté client, au cas où jsPDF en injecterait sur certains UAs). Bonus : check `if (!data?.pdf_base64)` ajouté pour éviter de passer `undefined` au décodeur si le serveur renvoie une réponse incomplète.
