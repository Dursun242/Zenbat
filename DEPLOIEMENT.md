# Guide de déploiement — Zenbat (SaaS Devis BTP)

Ce document décrit la procédure complète pour déployer Zenbat de zéro, de façon **propre, reproductible et sécurisée**.

Stack détectée :

- **Front-end** : React 18 + Vite 5
- **API** : Fonction serverless `api/claude.js` (proxy Anthropic) — convention Vercel
- **Hébergement recommandé** : **Vercel** (zéro config, HTTPS, CDN global, fonctions serverless natives)

---

## 0. Pré-requis

| Outil | Version | Pourquoi |
|---|---|---|
| Node.js | ≥ 18.18 (LTS 20 conseillé) | Build Vite + runtime serverless |
| npm ou pnpm | récent | Gestion des dépendances |
| Git | — | Déploiement continu |
| Compte Vercel | gratuit | Hébergement |
| Clé API Anthropic | — | Fonctionnalité IA — [console.anthropic.com](https://console.anthropic.com/) |

---

## 1. ⚠️ Point bloquant à corriger avant tout déploiement

**Aujourd'hui, `src/App.jsx` (ligne ~880) appelle directement `https://api.anthropic.com/v1/messages` depuis le navigateur.**

Cela pose **trois problèmes** pour une mise en production :

1. **Sécurité** : si vous ajoutez la clé côté front, elle est visible par tous les utilisateurs → vol de clé garanti.
2. **CORS** : l'API Anthropic rejettera la requête dans un navigateur de production.
3. **Coûts incontrôlés** : pas de rate-limiting possible côté client.

### Correction (obligatoire)

La fonction proxy existe déjà dans `api/claude.js`. Il suffit de faire pointer le front vers elle.

Dans `src/App.jsx`, remplacez :

```js
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... })
});
```

par :

```js
const res = await fetch("/api/claude", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... })
});
```

La clé reste **exclusivement côté serveur**, dans la variable d'env `ANTHROPIC_KEY`.

> 💡 Pour le dev local, le même endpoint `/api/claude` fonctionne via `vercel dev` (voir §3).

---

## 2. Préparation du dépôt

Les fichiers suivants ont été ajoutés dans ce commit :

- `.gitignore` — exclut `node_modules`, `.env`, `dist`, `.vercel`, etc.
- `.env.example` — gabarit des variables d'environnement (à copier en `.env.local`)
- `vercel.json` — config explicite (framework, rewrites SPA, timeout fonctions)

### Vérifications à faire une fois

```bash
# 1. Installer les dépendances
npm install

# 2. Vérifier qu'aucun secret ne traîne
git grep -nE "sk-ant-|ANTHROPIC_KEY\s*=\s*['\"]sk-" -- . ':!DEPLOIEMENT.md' ':!.env.example'

# 3. Build local
npm run build

# 4. Preview du build
npm run preview
```

---

## 3. Développement local

```bash
# 1. Cloner et installer
git clone <url-du-repo>
cd Zenbat
npm install

# 2. Créer son .env.local à partir du gabarit
cp .env.example .env.local
# Éditer .env.local → coller votre vraie clé ANTHROPIC_KEY

# 3a. Dev front seul (sans l'API)
npm run dev
# → http://localhost:5173

# 3b. Dev front + fonctions serverless (recommandé)
npm install -g vercel      # une seule fois
vercel link                # lier le projet (une seule fois)
vercel env pull .env.local # récupère les env vars depuis Vercel
vercel dev                 # → http://localhost:3000, /api/claude opérationnel
```

---

## 4. Déploiement sur Vercel (recommandé)

### Option A — via l'interface web (la plus simple)

1. Poussez votre code sur GitHub / GitLab / Bitbucket.
2. Allez sur <https://vercel.com/new>.
3. « **Import Git Repository** » → sélectionnez `Zenbat`.
4. Vercel détecte automatiquement **Vite**. Laissez les valeurs par défaut :
   - Build command : `npm run build`
   - Output directory : `dist`
   - Install command : `npm install`
5. Ouvrez **Environment Variables** et ajoutez :
   - `ANTHROPIC_KEY` = `sk-ant-…` (cochez **Production**, **Preview**, **Development**)
6. Cliquez **Deploy**.
7. Dans 30 secondes, l'URL `https://zenbat-xxx.vercel.app` est en ligne.

### Option B — via la CLI

```bash
npm install -g vercel
vercel login
vercel              # premier deploy → crée le projet, déploie en preview
vercel --prod       # déploiement en production
```

Ajout des secrets en CLI :

```bash
vercel env add ANTHROPIC_KEY production
vercel env add ANTHROPIC_KEY preview
vercel env add ANTHROPIC_KEY development
```

### Déploiement continu

Une fois le projet connecté à Git, Vercel déploie **automatiquement** :

- `main` → **Production** (votre domaine principal)
- toute autre branche → **Preview** (URL unique, utile pour valider avant merge)
- chaque PR → URL de preview commentée sur GitHub

---

## 5. Domaine personnalisé

1. Dashboard Vercel → projet → **Settings → Domains**.
2. Ajoutez `zenbat.fr` (ou autre).
3. Vercel donne **2 options** :
   - **Registrar compatible** (OVH, Gandi, Namecheap…) : ajoutez un `A` record `76.76.21.21` + `CNAME www → cname.vercel-dns.com`.
   - **Transfert DNS** vers Vercel : plus simple mais engageant.
4. Le certificat **Let's Encrypt** est émis automatiquement (HTTPS actif en < 1 min).

---

## 6. Sécurité — checklist avant la mise en prod

- [ ] `.env` et `.env.local` **ne sont pas** commités (`git status` les ignore).
- [ ] Aucune clé `sk-ant-...` présente dans le code source (`git log -p | grep sk-ant-` → vide).
- [ ] L'appel Anthropic passe **exclusivement** par `/api/claude` (cf. §1).
- [ ] CORS du proxy (`api/claude.js`) : restreindre `Access-Control-Allow-Origin` à votre domaine en prod plutôt que `*`.
- [ ] Variables d'env ajoutées sur Vercel pour **Production** ET **Preview**.
- [ ] Rate-limiting côté `api/claude.js` (voir §8 — améliorations).
- [ ] Rotation de la clé Anthropic si elle a été exposée à un moment.

### Durcir `api/claude.js` (exemple)

```js
// En production, remplacer le "*" par votre domaine
const ALLOWED_ORIGIN = process.env.VERCEL_ENV === "production"
  ? "https://zenbat.fr"
  : "*";
res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);

// Refus si pas de clé (évite un 500 opaque)
if (!process.env.ANTHROPIC_KEY) {
  return res.status(500).json({ error: "ANTHROPIC_KEY non configurée" });
}
```

---

## 7. Alternatives d'hébergement

| Plateforme | Verdict | Remarques |
|---|---|---|
| **Vercel** | ✅ recommandé | Détection auto de Vite + convention `/api` native |
| **Netlify** | ✅ viable | Renommer `api/` en `netlify/functions/` et adapter le handler |
| **Cloudflare Pages + Workers** | ✅ performant | Réécrire `api/claude.js` en Worker (syntaxe `fetch` native) |
| **Serveur VPS (Nginx + PM2)** | ⚠️ coûteux en temps | Besoin d'un back Node custom (Express) pour le proxy |
| **GitHub Pages** | ❌ non viable | Pas de fonctions serverless → la feature IA ne marche pas |

---

## 8. Améliorations recommandées (post-MVP)

1. **Rate-limiting** sur `/api/claude` — ex. [@upstash/ratelimit](https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted) (10 req/min/IP).
2. **Authentification** — Clerk, Auth0 ou Supabase Auth si multi-utilisateurs.
3. **Persistance** — Supabase ou Neon (Postgres serverless) pour stocker les devis réels (actuellement en mémoire).
4. **Observabilité** — Vercel Analytics + Sentry pour les erreurs front/back.
5. **Tests** — Vitest + Playwright sur le flux « créer un devis → PDF ».
6. **CI/CD** — le workflow Vercel suffit ; ajouter une GitHub Action `lint + typecheck` si vous migrez vers TypeScript.
7. **Nettoyage** — le fichier `main.jsx` à la racine est un doublon de `src/main.jsx` (non utilisé par `index.html`). À supprimer.

---

## 9. Procédure de rollback

En cas de régression en production :

1. Dashboard Vercel → **Deployments**.
2. Retrouvez le dernier déploiement stable.
3. Menu « … » → **Promote to Production**.

→ Rollback instantané, sans re-build.

---

## 10. Récapitulatif express (TL;DR)

```bash
# 1. Corriger l'appel API front (§1) — obligatoire
# 2. Commit + push
git add .gitignore .env.example vercel.json DEPLOIEMENT.md
git commit -m "chore: setup deployment"
git push

# 3. Sur vercel.com/new : importer le repo
# 4. Ajouter la variable d'env ANTHROPIC_KEY
# 5. Deploy → 🎉
```

Temps total de mise en ligne depuis un dépôt propre : **≈ 10 minutes**.
