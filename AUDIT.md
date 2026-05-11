# Audit Zenbat — site & app

> Audit complet réalisé le **2026-05-11** sur la branche `claude/audit-site-app-MUuwJ`.
> Stack auditée : React + Vite · Vercel Serverless · Supabase · Claude API · Stripe · B2Brouter · Odoo Sign.

---

## 0. Synthèse exécutive

| Domaine | État | Niveau de risque |
|---|---|---|
| Sécurité API | 🟠 | 4 critiques, 6 importants, 5 mineurs |
| Base de données / RLS | 🟢 | Bien structurée, 2 critiques liés à la doc + PII |
| Qualité de code front | 🟡 | 4 critiques (régression token, duplication), composants trop gros |
| Performances / bundle | 🟠 | Dépendances mal placées, pas de pagination, deps obsolètes |
| Documentation projet | 🔴 | CLAUDE.md décalé sur 2 points structurants |

**Top 3 actions urgentes**

1. **Régression token `getToken()`** : `Onboarding.jsx` est revenu à `session?.access_token` — bug connu re-introduit (voir CLAUDE.md §Token). À corriger en priorité.
2. **Limite Vercel atteinte (12/12)** : ajouts de `contact.js` et `devis-public.js` non reflétés dans CLAUDE.md. Tout futur endpoint cassera le déploiement.
3. **Migration `0039_freemium_weekly_limit.sql` non documentée** comme « en attente » ; si non appliquée, fragmentation côté DB entre l'ancien essai 30 j et le nouveau freemium hebdomadaire.

---

## 1. Documentation projet décalée (à corriger immédiatement)

### 1.1 Limite Vercel : 12/12 et non plus 10/12

`CLAUDE.md` ligne ~25 indique « 10/12 ». Or l'état réel de `/api/` :

```
account.js  admin-delete-user.js  admin-stats.js  admin-user-detail.js
b2brouter.js  claude.js  contact.js  devis-public.js  facturx.js
newsletter.js  odoo-sign.js  stripe.js
```

→ **12 endpoints** + helpers `_cors.js`, `_email.js`, `_withAuth.js` (les `_*` ne comptent pas comme functions Vercel, OK).

**Action** : mettre à jour CLAUDE.md pour refléter `12/12` et documenter le rôle de `contact.js`, `devis-public.js`, `_email.js`, `_withAuth.js` dans le tableau des endpoints.

### 1.2 Migration `0039` orpheline

`CLAUDE.md` ligne ~34 : « Dernière migration appliquée : `0038_invoice_auto_liquidation.sql` · Aucune migration en attente ». Or `supabase/migrations/0039_freemium_weekly_limit.sql` existe sur disque.

**Risque** : si non appliquée, la table `devis_weekly_counters` et son trigger n'existent pas, alors que le front a probablement basculé sur un compteur hebdomadaire. Doublon possible avec l'ancien système `devis_daily_counters` (migrations 0036/0037) toujours en place.

**Action** : confirmer si 0039 a été appliquée. Si oui, mettre à jour CLAUDE.md → « 0039 ». Si non, le rappeler à l'utilisateur et indiquer que la prochaine migration est `0040_`.

---

## 2. Sécurité — API & helpers

### 🔴 Critique

| # | Fichier:ligne | Problème | Impact |
|---|---|---|---|
| S1 | `api/facturx.js:354-365` | Si le client envoie `pdf_base64` sans `invoice.id`, la vérification d'ownership est **contournée**. L'endpoint devient un proxy Factur-X non authentifié. | Tout utilisateur authentifié peut générer un Factur-X valide pour n'importe quel PDF. |
| S2 | `api/claude.js` (admin bypass) | L'admin est exempté de toute limite journalière, et `profiles.ai_used` n'est pas incrémenté côté backend. | Coût Claude illimité si `ADMIN_EMAIL` est compromis. Aucune visibilité du coût réel par user. |
| S3 | `api/devis-public.js` (OTP 6 chiffres) | OTP `Math.random()` + 6 chiffres = 10⁶ combinaisons. Rate-limit existant n'est que par token, pas par IP. | Brute-force OTP réaliste avec parallélisation. |
| S4 | `api/devis-public.js` | Pas de validation longueur/format du `token` public ; pas de rate-limit par IP sur `request_otp`. | Énumération de tokens facilitée si la table grossit. |
| S5 | `api/contact.js` + `api/newsletter.js` | Aucun rate-limiting. Honeypot seul sur contact.js. | Spam des emails admin / quota Brevo / coûts email. |

### 🟠 Important

- `api/account.js:222` — regex email `/^\S+@\S+\.\S+$/` trop permissive sur `comptable_email`. Risque : redirection d'export vers email attaquant. Utiliser la regex `EMAIL_RE` stricte déjà présente dans `contact.js`/`newsletter.js`.
- `api/stripe.js:261` — l'erreur Stripe brute (`err.code`, `message`) est renvoyée au client. Information disclosure sur la config Stripe.
- `api/b2brouter.js` — accepte 2 noms de header (`x-b2b-signature` OU `x-b2brouter-signature`) ; à uniformiser.
- `api/b2brouter.js:207-238` — ownership vérifiée sur `invoice.owner_id` mais pas sur le `client.owner_id` associé.
- `api/odoo-sign.js:82-87` — message d'erreur expose les noms de variables d'env attendues.
- `api/claude.js:115-132` — pas de backpressure sur le streaming : un client lent peut maintenir une fonction ouverte ~55 s.

### 🟡 Mineur

- `api/_email.js:16` — fallback typo `GMAIL_APP_PASWORD` (rétrocompat). À documenter ou migrer.
- `api/devis-public.js` — `client_name` accepté sans whitelist de caractères → risque XSS stocké si réaffiché côté admin sans escape.
- `api/odoo-sign.js:330,334` — escaping HTML manuel ; centraliser ou utiliser une lib éprouvée.

### ✅ Points forts sécurité

- HMAC en `timingSafeEqual` côté Stripe et B2Brouter.
- CORS strict via `ALLOWED_ORIGINS` whitelist (pas de wildcard), `Vary: Origin` posé.
- Helper `_withAuth.js` centralise auth + `adminOnly`.
- Service role key réservée aux webhooks et endpoints admin.
- `AbortController` + retry exponentiel sur appels Claude / Odoo / B2Brouter.

---

## 3. Base de données & RLS

### 🔴 Critique

- **`0039_freemium_weekly_limit.sql` non documentée comme en attente** (cf. §1.2).
- **PII en clair** sur `profiles` (email, téléphone, SIRET, raison_sociale, adresse) et `clients`. RLS seule protège. Aucun chiffrement at-rest ni masquage logs. En cas de dump involontaire, exposition immédiate.

### 🟠 Important

- **`devis_otp_sessions` (mig 0032)** — RLS activé mais **aucune policy explicite**. Sécurisé en pratique (PostgREST refuse implicitement), mais documenté par absence — confusion future. Ajouter une policy `for all to authenticated using (false)` explicite.
- **Policies `app_logs` (mig 0017)** — dépendent de `current_setting('app.admin_email', true)`. Si la variable n'est jamais set côté Postgres, les policies admin tombent silencieusement.
- **`coherence_validations` (mig 0024)** — INSERT avec `with check (true)` (pas d'owner). Trace IA non vérifiée.
- **Rétention RGPD `ia_conversations` (mig 0011)** — purge 12 mois, mais textes libres peuvent contenir du PII (adresses clients prospects, SIRET…). Pas de masquage avant purge ; après `account.js` (suppression compte), les lignes restent jusqu'à la prochaine purge.
- **Fragmentation freemium** — si 0039 pas appliquée, coexistence `devis_daily_counters` (0036/0037) + référence à `devis_weekly_counters` côté front possible. État incohérent.

### 🟡 Mineur

- **Indexes composites manquants** pour les requêtes fréquentes :
  - `devis(owner_id, statut, created_at DESC)` — actuellement deux indexes séparés.
  - `invoices(owner_id, statut, created_at DESC)`.
  - `ia_conversations` : doublon entre `(owner_id, created_at)` et `(created_at)` — simplifier.
- **`next_invoice_number()` (mig 0005)** — parsing regex `FAC-\d{4}-(\d+)` ; si un numéro est posé manuellement hors séquence, parsing silencieusement à 0. Pas de `UNIQUE` global (seulement par owner), deux artisans peuvent avoir `FAC-2026-0001` (ce qui est conforme à la loi, mais à documenter).
- **`app_logs` sans purge** dans `run_retention_purge()` — croissance non bornée.
- **Triggers BEFORE UPDATE sans ordre documenté** ; stable aujourd'hui mais fragile (cf. bug historique 0022 → 0035).

### Migrations notables

| # | Rôle | Remarque |
|---|---|---|
| 0009 | compliance locks | Lock immutabilité factures émises |
| 0011 | rétention | Purge auto via pg_cron |
| 0019 | indexes devis | Bon premier passage, à compléter (cf. ci-dessus) |
| 0022→0035 | RLS invoices_update | Bug historique réglé ; **le commentaire du fix est exemplaire** |
| 0024 | coherence engine | Policy INSERT trop ouverte |
| 0027 | Stripe | Subscription + customer_id |
| 0032 | devis public | Token + OTP + audit (manque policy explicite) |
| 0039 | freemium hebdo | **Non documentée** |

### ✅ Points forts DB

- RLS activé sur 21/21 tables.
- Cascades FK propres → `account.js` (suppression compte) cascade nativement.
- Soft-delete + lock conforme LPF (10 ans) et code civ. (5 ans).
- `run_retention_purge()` planifiée via pg_cron.
- Le fix de la migration 0035 documente précisément la régression — exemple à suivre.

---

## 4. Qualité de code — Frontend

### 🔴 Critique

| # | Fichier:ligne | Problème |
|---|---|---|
| C1 | `src/pages/Onboarding.jsx:46, 74` | **Régression bug connu** : `session?.access_token` au lieu de `getToken()`. Cf. CLAUDE.md §« Token d'authentification Supabase ». |
| C2 | `AgentIA.jsx`, `PDFViewer.jsx`, `InvoiceDetail.jsx`, `DevisDetail.jsx` | Calculs HT/TVA/TTC dupliqués 4 fois. Source unique manquante (`lib/computeAmounts.js`). |
| C3 | Plusieurs fichiers | Headers `Authorization: Bearer ${token}` reconstruits inline 15+ fois. Pas de helper `fetchWithAuth()`. |
| C4 | `AgentIA.jsx:~350` | `useEffect` sans dépendances ferme la `SpeechRecognition` ; risque de fuite si re-render. |

### 🟠 Important

- **`AgentIA.jsx` (914 lignes)** — monolithe à décomposer : hook `useSpeechRecognition`, sous-composants `<ChatRenderer>`, `<AgentModals>`.
- **`Onboarding.jsx` (583 lignes, 6 étapes)** — extraire 1 composant par étape (`components/onboarding/StepN.jsx`), isoler le bloc RGPD.
- **`DevisPublicPage.jsx` (582 lignes)** — page publique critique (signature client). Le poids du composant rend l'audit sécu plus difficile.
- **Tests manquants** sur les composants critiques : `AgentIA`, `DevisDetail`, `InvoiceDetail`, `PDFViewer`, `DevisPublicPage` — aucun `*.test.jsx`. La couverture lib (~85 %) est très bonne en revanche.
- **localStorage en `useState` initializer** dans `AgentIA.jsx:37-42` puis `useEffect` de sync → risque de flicker hydration + état perdu en silence si le catch attrape (ligne 93). Créer un `useLocalStorage()` hook.

### 🟡 Mineur

- **~302 styles inline `style={{…}}`** — vers une extraction en design tokens (`lib/styles.js`) pour préparer un thème sombre / cohérence.
- **Routing maison via `window.location.pathname`** dans `Root.jsx` — pas de `<Link>`, navigation = reload complet. Soit migrer vers React Router, soit faire un `history.pushState` minimal pour les routes internes.
- **Labels sans `htmlFor`** dans plusieurs formulaires (a11y) — créer un composant `<FormField>`.
- **`console.log`** (~41 occurrences) — wrapper autour de `lib/logger.js` (existe déjà !) ; passer toutes les logs dessus pour activation conditionnelle prod.
- **PDFViewer.jsx:50,57** — `setTimeout` 50 ms / 400 ms hardcodés ; extraire en constantes nommées.

### ✅ Points forts code

- `pdfBuilder.js` / `facturx.js` bien modularisés malgré leur taille (constantes nommées, logique fiscale centralisée).
- 25 fichiers de tests (lib bien couverte).
- Gestion d'erreur cohérente (retry, fallbacks, toasts).
- Aucun `TODO/FIXME/HACK` traînant.
- Mobile-first respecté (safe-area-inset, `dvh`).

---

## 5. Performances & bundle

### 🔴 Critique

- **`stripe` et `nodemailer` dans `dependencies`** (`package.json` lignes 21, 25) — backend-only, jamais utilisés en front mais embarqués dans le résolveur Vite. Risque +100–150 KB si jamais importés par erreur. → `optionalDependencies` ou repo séparé.
- **Aucune pagination Supabase** (`src/lib/api.js`) — `listClients()`, `listDevis()`, `listInvoices()` font `select('*')` sans `.limit()`. Latence linéaire + coût billing Supabase. **Ajouter `.limit(50)` + curseur ou infinite scroll**.
- **`lucide-react@^1.11.0`** (package.json:20) — version 2023, gelée par semver caret. La version actuelle de la lib est `0.x` (lignée différente). À reprendre.

### 🟠 Important

- **`vercel.json` : `maxDuration: 60` universel** — surcoût plan Hobby. `contact.js`, `newsletter.js`, `admin-stats.js`, `b2brouter.js` (sauf appels externes), `odoo-sign.js` (côté pull) peuvent vivre à 10–30 s.
- **`framer-motion` sur la landing sans lazy load** — 6 composants `landing/*.jsx` l'importent ; charge ~12 KB + deps même pour un user déjà connecté.
- **Pas de lazy route** au-delà du PDF — Dashboard / Clients / Devis / Invoices chargés immédiatement.

### 🟡 Mineur

- **SEO basique** — manque `og:image`, `twitter:card`, JSON-LD, `canonical`, preconnect Supabase/Stripe.
- **Google Fonts** — 4 familles chargées ; `display=swap` ✓ mais à subset davantage par poids réellement utilisé.
- **Vite `manualChunks`** limité à `vendor-react` + `vendor-supabase` ; ajouter `'pdf': ['pdf-lib', 'jspdf', '@pdf-lib/fontkit']` et `'landing': [...]`.
- **Service worker** sans stratégie `stale-while-revalidate` pour images/fonts.

### ✅ Points forts perf

- PDF libs en `import()` dynamique → ne plombent pas le bundle initial.
- `.vercelignore` exclut bien les tests.
- Tailwind purge OK, content paths corrects.
- Manifest PWA propre, icons générés via `@vite-pwa/assets-generator`.
- `navigateFallbackDenylist: [/^\/api\//]` ✓.

---

## 6. Quick wins (ordre ROI/effort)

| Priorité | Action | Effort | Impact |
|---|---|---|---|
| 1 | Corriger la régression `getToken()` dans `Onboarding.jsx` | 5 min | Bug connu re-introduit |
| 2 | Mettre à jour CLAUDE.md (12/12 functions + mig 0039) | 10 min | Cohérence doc |
| 3 | `api/facturx.js` : rendre `invoice.id` obligatoire | 15 min | 🔴 sécurité |
| 4 | Ajouter `.limit(50)` sur les 3 list*() | 20 min | Perfs + coûts |
| 5 | Rate-limit IP sur `contact.js`, `newsletter.js`, `devis-public.js` | 1 h | Anti-spam / anti-bruteforce |
| 6 | OTP 6 → 8 chiffres + délai exponentiel après 3 essais | 30 min | 🔴 sécurité |
| 7 | Centraliser `fetchWithAuth()` + `computeAmounts()` | 2 h | Maintenabilité |
| 8 | Lazy-load landing + chunks PDF | 1 h | LCP / cache |
| 9 | `maxDuration` granulaire par endpoint | 30 min | Coûts Vercel |
| 10 | Policy explicite sur `devis_otp_sessions` + index composites | 30 min | Lisibilité DB |

---

## 7. Roadmap suggérée

**Sprint 1 (urgent — 1 jour)**
- Items 1, 2, 3, 4 du tableau ci-dessus.
- Décider si mig 0039 doit être appliquée.

**Sprint 2 (sécurité — 2-3 jours)**
- Items 5, 6.
- `facturx.js`/`b2brouter.js` : ownership check exhaustif.
- Email regex strict sur `account.js`.

**Sprint 3 (perf & dette — 1 semaine)**
- Items 7, 8, 9.
- Split `AgentIA.jsx` et `Onboarding.jsx`.
- Tests sur `AgentIA` / `DevisDetail` / `DevisPublicPage`.

**Sprint 4 (DB & doc — 2 jours)**
- Item 10.
- Indexes composites devis/invoices.
- Documenter dépendances de triggers dans CLAUDE.md.
- Ajouter purge `app_logs`.

---

## 8. Métriques globales

- **Taille code** : 16 124 lignes (sans node_modules, sans tests pour partie)
- **Fichiers > 500 lignes** : 10 (AgentIA, devis-public test, devis-public, Onboarding, DevisPublicPage, api, pdfBuilder, PDFViewer)
- **Fonctions Vercel** : 12/12 (limite atteinte)
- **Migrations** : 39 (dernière sur disque = `0039_freemium_weekly_limit`)
- **Tables avec RLS** : 21/21
- **Couverture tests** : 25 fichiers `*.test.js` (lib bien couverte, composants UI quasi pas)

---

*Audit généré automatiquement par Claude (Opus 4.7). Les sévérités sont indicatives — toute décision de fix doit être validée par l'équipe produit.*
