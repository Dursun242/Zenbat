# Audit Zenbat — site & app

> Audit complet réalisé le **2026-06-11** sur la branche `claude/application-audit-15sotd` (commit `8cfe447`).
> Remplace l'audit du 2026-05-11. Stack auditée : React + Vite · Vercel Serverless · Supabase · Claude API · Stripe.
> Méthodologie : 4 passes parallèles (sécurité API, frontend, migrations/RLS, config/deps), chaque finding critique re-vérifié manuellement dans le code — les faux positifs écartés sont listés en §7.

---

## 0. Synthèse exécutive

| Domaine | État | Constat |
|---|---|---|
| Sécurité API | 🟡 | Bonne base (auth, OTP, idempotence, CORS), mais rate-limit contournable et durcissements manquants |
| Migrations / DB | 🔴 | **Doublon de numéro 0053** + grosse pile de migrations critiques toujours « en attente » |
| Frontend | 🟢 | Les bugs historiques (token, fu, 42703) sont corrigés ; reste duplication et localStorage non scopé |
| Dépendances | 🟠 | 11 vulnérabilités npm (1 critical, 3 high) dont dompurify via jspdf |
| Config Vercel | 🟠 | Aucun header de sécurité HTTP ; `crm.js` absent de `vercel.json` |
| Tests | 🟠 | `stripe.js`, `facturx.js`, `account.js`, `contact.js` : zéro test |
| Documentation (CLAUDE.md) | 🟠 | Décalée : 11/12 fonctions (pas 10), `crm.js` non documenté, migrations 0053-0055 absentes |

**Top 5 actions urgentes**

1. **Renommer le doublon de migration `0053`** : `0053_invoice_type_solde.sql` et `0053_pro_trial_until.sql` coexistent → collision sur `schema_migrations(version)` (la 2ᵉ ne sera jamais trackée). Renommer `0053_pro_trial_until.sql` → `0056_pro_trial_until.sql` et corriger son INSERT idempotent.
2. **Appliquer les migrations en attente** (0041, 0043, 0047, 0049, 0050, 0052, puis 0053-0055) — 0041 et 0047 corrigent des bugs bloquants documentés (1ᵉʳ devis freemium, négociation invisible).
3. **`npm audit fix`** (+ test après mise à jour de jspdf) : dompurify ≤3.3.3 via jspdf (XSS, high), fast-uri (high), serialize-javascript (high), 1 critical Babel transitif.
4. **Ajouter les headers de sécurité HTTP** dans `vercel.json` (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy).
5. **Mettre à jour CLAUDE.md** : 11/12 fonctions, documenter `crm.js`, `_serverLog.js`, `_ssrf.js`, migrations 0044-0046, 0048, 0051, 0053-0055, prochain préfixe = `0057_` (après renommage).

---

## 1. Migrations & base de données

### 1.1 🔴 Doublon de numéro 0053 (critique)

Deux fichiers portent le préfixe `0053` :
- `0053_invoice_type_solde.sql` (CHECK `invoice_type` + 'solde')
- `0053_pro_trial_until.sql` (colonne `pro_trial_until` + job cron)

Avec le tracking `schema_migrations` (PK sur `version`), les deux INSERT `values ('0053', ...)` entrent en collision : `on conflict do nothing` fait que **la seconde migration appliquée n'est jamais enregistrée**, et le diagnostic `SELECT ... FROM schema_migrations` devient mensonger.

**Action** : renommer `0053_pro_trial_until.sql` → `0056_pro_trial_until.sql`, mettre à jour son INSERT (`'0056'`), et passer le « prochain préfixe » du CLAUDE.md à `0057_`.

### 1.2 🔴 Pile de migrations « en attente » qui s'allonge

Le CLAUDE.md indique `0042` comme dernière appliquée, avec 0041/0043/0047/0049/0050/0052 en attente. Or les fichiers vont désormais jusqu'à `0055` (+ 0044-0046 CRM, 0048, 0051, 0053×2, 0054). Tant que ce n'est pas appliqué :
- **0041** : tout nouveau freemium est bloqué sur son 1ᵉʳ devis (bug NULL documenté).
- **0047** : toute négociation client laisse le devis figé à « Envoyé ».
- **0050** : le badge support ne s'affiche jamais (cf. §1.3) et les tickets ne sont pas purgés.
- **0055** : l'idempotence `send_signed_pdf` n'est protégée que séquentiellement (pas contre la race concurrente).

**Action** : séance d'application dans l'ordre 0043 → 0041 → 0044…0055 (activer `pg_cron` avant 0050), puis vérifier `SELECT version FROM schema_migrations ORDER BY version`.

### 1.3 🟠 `useSupportUnread.js` lit `user_last_seen_at` sans fallback 42703

`src/hooks/useSupportUnread.js:33` sélectionne `user_last_seen_at` (colonne créée par `0050`, en attente). Si la colonne n'existe pas, le SELECT échoue, `maybeSingle()` renvoie `data` vide, le hook conclut « pas de ticket » et **le badge support ne s'affiche jamais — silencieusement**. C'est exactement le piège que la règle défensive 42703 du CLAUDE.md est censée éviter.

**Action** : catcher 42703 et retenter le SELECT sans `user_last_seen_at` (fallback sur `created_at`).

### 1.4 🟡 Divers DB

- `0055_signed_pdf_idempotency.sql` : le DELETE de dédoublonnage est global (tous users). OK pour une exécution one-shot en prod, mais le documenter dans l'en-tête du fichier.
- Migrations ≥ 0043 : toutes contiennent bien l'INSERT idempotent `schema_migrations` ✓. Pas de trou de numérotation (hors doublon 0053).

---

## 2. Sécurité API (`/api` + Edge Functions)

Ce qui est **bien fait** (vérifié) : auth `authenticate()` systématique, `artisan_respond` vérifie `owner_id` (`devis-public.js:560`), OTP généré par `crypto.randomInt` + hashé, sessions OTP limitées (3 tentatives, 3 sessions/15 min), idempotence `send_signed_pdf` avec verrou anti-race, webhook Stripe signé (`constructEvent`) + table de dédup, secrets uniquement en variables d'env, `.env` non commité.

### 2.1 🟠 Rate-limiter in-memory contournable

`_rateLimit.js` ne vit qu'en mémoire d'instance : chaque recyclage Vercel (quelques minutes d'inactivité) remet les compteurs à zéro. Les protections de `contact.js`, `newsletter.js` et `request_otp`/`verify_otp` sont donc best-effort. Combiné à l'OTP : la fenêtre de bruteforce reste très insuffisante pour 10⁸ codes (≈81 essais/15 min), mais un attaquant patient n'est ralenti que par la DB (`devis_otp_sessions`), pas par IP.

**Action** : déplacer le comptage des tentatives OTP et du anti-spam contact vers une table Supabase (ou Vercel KV) ; a minima logger les échecs `verify_otp` dans `app_logs` pour détecter une attaque.

### 2.2 🟠 `send_signed_pdf` : contenu PDF non validé

`devis-public.js:740` accepte n'importe quel `pdf_base64` (≤5 Mo) depuis une session OTP client vérifiée et l'emaile comme « devis signé » au client **et à l'artisan**. Un client malveillant (ou un XSS sur la page publique) peut faire envoyer un PDF arbitraire estampillé du flux officiel. Pas un IDOR (la session OTP authentifie bien le destinataire du devis), mais un risque d'usurpation de contenu.

**Action** : vérifier au minimum le magic number `%PDF-` après décodage, et idéalement régénérer/contrôler les métadonnées côté serveur.

### 2.3 🟠 `crm.js` : `CRON_SECRET` comparé en `===`

`crm.js:84` compare le Bearer au `CRON_SECRET` avec `===` (non timing-safe). Même remarque pour le secret Telegram dans `supabase/functions/telegram-bot/index.ts` (le header `X-Telegram-Bot-Api-Secret-Token` est bien vérifié + chat_id whitelisté ✓, mais comparaison non constante).

**Action** : `crypto.timingSafeEqual` aux deux endroits. Bonus : `crm.js` n'a ni entrée dans `vercel.json > functions` (pas de `maxDuration` explicite) ni documentation CLAUDE.md.

### 2.4 🟠 Webhook Stripe : suppression de la ligne de dédup en cas d'échec

`stripe.js` supprime la ligne `stripe_webhook_events` pour forcer le retry Stripe quand le traitement métier échoue. Si deux livraisons du même event se chevauchent, un double traitement devient possible.

**Action** : ne jamais supprimer la ligne de dédup ; rendre le traitement métier idempotent (UPDATE conditionnel) et laisser Stripe retenter sur 500.

### 2.5 🟡 Divers sécurité

- **Échappement HTML emails incomplet** : la plupart des templates utilisent `esc()`, mais quelques interpolations passent en brut — `devis.objet` et `clientName` dans `send_signed_pdf` (`devis-public.js:800,811-814`), `brand.phone` dans `emailDevis`. Données semi-fiables (saisies par l'artisan/le client), mais appliquer `esc()` partout par principe.
- **`emailArtisanMsg` (`devis-public.js:220-229`) est du code mort** avec un `${message}` non échappé : à supprimer avant qu'un futur appel ne réintroduise l'injection.
- **Validation Content-Length** : présente sur `facturx.js` ✓, absente sur `claude.js` et `stripe.js`.
- **Headers de sécurité** absents des réponses API (cf. §5.1, à régler globalement via `vercel.json`).

---

## 3. Frontend (`/src`)

### 3.1 ✅ Les règles critiques du CLAUDE.md sont respectées (vérifié)

- **Token** : tous les appels passent par une session fraîche (`supabase.auth.getSession()` au moment du fetch), y compris `App.jsx:201-202/227-228`. La régression token signalée en mai est corrigée.
- **42703** : fallbacks en place dans `src/lib/api.js` (4 occurrences) ✓ — sauf `useSupportUnread.js` (cf. §1.3).
- **safe-area-inset**, **XSS** (`dangerouslySetInnerHTML` uniquement pour du JSON-LD stringifié), **cleanup des listeners** : propres.
- **`className="fu"`** : les 5 usages restants (Dashboard, listes, ClientDetail) ne contiennent pas d'enfants `position:fixed` → conformes.

### 3.2 🟠 localStorage non scopé par `user.id`

Le bug « compteur hérité de l'utilisateur précédent » peut se reproduire avec :
- `pending_checkout_plan` (`App.jsx:94,220,237`) — un plan de checkout en attente peut être hérité par un autre compte sur le même navigateur, et déclencher une **redirection Stripe pour le mauvais user**.
- `zenbat_brand` (`src/hooks/useBrand.js:9,20,38`) — le branding (logo, coordonnées) du compte précédent peut fuiter visuellement vers le compte suivant.

**Action** : préfixer ces clés par `user.id` (pattern existant dans `appShell.js:storageKey`).

### 3.3 🟠 Erreurs supabase-js avalées

Le piège qui a causé le bug « négociation invisible » existe encore à :
- `src/lib/api.js:264` (insert `lignes_devis` sans inspection de `error`) et `:269` (update `statut='remplace'`),
- `src/components/SupportChat.jsx:65,185` (`.then(()=>{},()=>{})` sans log).

**Action** : `if (error) throw error` (api.js) / `console.warn` (SupportChat).

### 3.4 🟡 Dette de structure

- `CRM.jsx` : **2 328 lignes** ; `AgentIA.jsx` : 818 ; `AdminPanel.jsx` : 624 (+ 13 fonctions `load*()` copiées-collées à factoriser en `fetchAdminStat(type, setter)`).
- `getToken()` redéfini localement dans `CRM.jsx`, `SubscriptionScreen.jsx`, `PaywallScreen.jsx`, `telegramNotify.js` — l'implémentation est correcte, mais importer `src/lib/getToken.js` éviterait une future divergence.
- `AdminPanel.jsx:78` : dépendance d'effet `[session?.access_token]` → préférer `[user?.id]` (évite un reload à chaque refresh silencieux du JWT).

---

## 4. Dépendances & tests

### 4.1 🟠 11 vulnérabilités npm (1 critical, 3 high)

| Paquet | Via | Risque réel |
|---|---|---|
| `dompurify` ≤3.3.3 | `jspdf` | XSS (7 CVE). jspdf est utilisé pour *générer* des PDF, pas parser du HTML user → risque modéré mais à corriger. **Breaking change possible** : tester la génération PDF après mise à jour. |
| `fast-uri` | transitif | Path traversal / host confusion — `npm audit fix` sans breaking |
| `serialize-javascript` | rollup/terser (dev) | Build-time uniquement, risque faible |
| Babel plugin (critical) | `@rollup/plugin-babel` (dev) | Build-time uniquement |
| `esbuild`/`vite`, `ws`, `brace-expansion` | dev/transitif | Dev server uniquement |

**Action** : `npm audit fix`, puis évaluer `npm audit fix --force` (jspdf, vite) avec `npm run test` + test manuel de génération PDF.

### 4.2 🟠 Zones critiques sans tests

`devis-public.test.js` (~100 assertions) et `claude.test.js` sont solides ✓. En revanche **aucun test** pour : `stripe.js` (paiement + webhook + idempotence), `facturx.js` (facture légale, fallbacks 42703, action `send`), `account.js` (suppression de compte RGPD !), `contact.js`. Ce sont les endpoints où une régression coûte le plus cher.

---

## 5. Configuration Vercel & documentation

### 5.1 🟠 Aucun header de sécurité HTTP

`vercel.json` ne définit ni CSP, ni `X-Frame-Options`, ni `X-Content-Type-Options`, ni HSTS, ni `Referrer-Policy`. Pour une app qui manipule factures et données clients, c'est le durcissement au meilleur ratio effort/gain.

**Action** : ajouter une section `headers` globale (attention à la CSP : autoriser Supabase, Vercel, Trustpilot, fonts ; la tester en `Content-Security-Policy-Report-Only` d'abord).

### 5.2 🟠 CLAUDE.md décalé de la réalité

- **11/12 fonctions** Vercel (pas 10) : `crm.js` existe (338 lignes, prospection CRM admin) mais n'apparaît ni dans la liste, ni dans le tableau des endpoints, ni dans `vercel.json > functions`. **Il ne reste qu'un seul slot.**
- Helpers `_serverLog.js` et `_ssrf.js` non documentés.
- Migrations : fichiers jusqu'à 0055, CLAUDE.md s'arrête à 0052 et annonce `0053_` comme prochain préfixe (faux deux fois : 0053 est déjà pris… deux fois).
- Variables caduques (B2B_*, ODOO_*) : toujours à purger côté Vercel (aucune référence dans le code ✓).

---

## 6. Plan d'action priorisé

| # | Action | Effort |
|---|---|---|
| 1 | Renommer `0053_pro_trial_until.sql` → `0056_` + corriger son INSERT | 5 min |
| 2 | Appliquer les migrations en attente (0043, 0041, 0044→0055) + activer pg_cron | 30 min (manuel) |
| 3 | `npm audit fix` (+ test PDF si `--force`) | 30 min |
| 4 | Headers de sécurité dans `vercel.json` (CSP en report-only d'abord) | 1 h |
| 5 | Fallback 42703 dans `useSupportUnread.js` | 15 min |
| 6 | Scoper `pending_checkout_plan` et `zenbat_brand` par `user.id` | 30 min |
| 7 | Vérifier `error` sur `api.js:264/269` + SupportChat ; supprimer `emailArtisanMsg` ; `esc()` manquants | 1 h |
| 8 | `timingSafeEqual` (crm.js, telegram-bot) + magic number `%PDF-` sur `send_signed_pdf` | 1 h |
| 9 | Mettre à jour CLAUDE.md (11/12, crm.js, helpers, migrations, prochain préfixe `0057_`) | 30 min |
| 10 | Tests `stripe.js` et `facturx.js` (puis `account.js`, `contact.js`) | 1-2 j |
| 11 | Rate-limit OTP persistant (table Supabase) + log des échecs | ½ j |
| 12 | Découper `CRM.jsx` / factoriser `AdminPanel.jsx` | fond de tâche |

---

## 7. Faux positifs écartés pendant l'audit

Pour mémoire (re-vérifiés manuellement, ne pas « corriger ») :
- **« IDOR sur `send_signed_pdf` »** : non — toutes les actions client exigent une session OTP vérifiée (`devis-public.js:717`) et l'action est idempotente. Seul le contenu du PDF est non validé (§2.2).
- **« Régression token `session?.access_token` »** : non — tous les usages relisent `getSession()` au moment de l'appel.
- **« `className="fu"` piège des modales »** : non — les 5 composants concernés ne rendent pas d'enfants `position:fixed`.
- **« `dangerouslySetInnerHTML` = XSS »** : non — JSON-LD stringifié, usage standard.
- **« 25 dépendances UNMET »** : artefact de l'environnement d'audit (node_modules non installé), pas un problème du repo.
