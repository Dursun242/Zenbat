# telegram-bot — Edge Function

Bot Telegram **entrant** : reçoit le webhook Telegram et exécute les commandes admin sur Zenbat.
Pendant publique de [`notify-telegram`](../notify-telegram/) (qui est sortant et authentifié JWT).

---

## 1. Prérequis

Le bot Telegram et son token doivent déjà exister (cf. README de `notify-telegram`, étapes 1 et 2).
On réutilise les mêmes `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID`.

## 2. Générer le secret webhook

```bash
openssl rand -hex 32
```

Coller cette valeur dans **Project Settings → Edge Functions → Manage secrets** sous le nom :

| Clé | Valeur |
|---|---|
| `TELEGRAM_WEBHOOK_SECRET` | la sortie d'openssl |

## 3. Déployer la fonction

```bash
supabase functions deploy telegram-bot --no-verify-jwt
```

Le flag `--no-verify-jwt` est **indispensable** : Telegram ne sait pas envoyer un JWT Supabase,
on valide à la place le secret token via header. Sans ce flag, Supabase rejetterait toutes les
requêtes Telegram en 401.

> Si la CLI n'est pas configurée, déployer via l'UI puis aller dans
> **Edge Functions → telegram-bot → Settings** et désactiver `Verify JWT`.

URL de l'endpoint : `https://<project>.supabase.co/functions/v1/telegram-bot`

## 4. Brancher le webhook côté Telegram

```bash
BOT_TOKEN="123456:ABC-..."
SECRET="<TELEGRAM_WEBHOOK_SECRET>"
URL="https://<project>.supabase.co/functions/v1/telegram-bot"

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${URL}" \
  -d "secret_token=${SECRET}" \
  -d "allowed_updates=[\"message\"]"
```

Vérifier :

```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

## 5. Tester

Sur Telegram, envoie au bot :

```
/help
/stats
```

Tu devrais recevoir une réponse instantanée.

---

## Commandes disponibles

| Commande | Description |
|---|---|
| `/start`, `/help` | Liste les commandes |
| `/stats` | Résumé du jour : inscriptions, devis, factures, tickets ouverts |
| `/user <email>` | Fiche complète d'un utilisateur (plan, dates, comptes) |
| `/tickets` | Liste des tickets de support ouverts ou en attente d'admin |
| `/reply <ticket_id> <message>` | Insère une réponse admin sur un ticket de support |

`<ticket_id>` accepte l'UUID complet ou son préfixe 8-caractères (renvoyé par `/tickets`).

---

## Sécurité

- **Authentification** : double rempart. (1) header `X-Telegram-Bot-Api-Secret-Token` doit
  matcher `TELEGRAM_WEBHOOK_SECRET` ; (2) `chat_id` du message doit être `TELEGRAM_CHAT_ID`.
  Toute requête qui rate l'un des deux est ignorée silencieusement.
- **Pas de JWT** : la fonction est délibérément `verify_jwt: false` car Telegram ne peut pas
  fournir un JWT. Le secret token le remplace. C'est exactement le pattern recommandé par
  Telegram et Supabase.
- **Pas de stockage** : tout transite en mémoire, sauf insertion contrôlée dans
  `support_messages` quand l'admin répond à un ticket via `/reply`.

## Variables d'env attendues

| Clé | Source |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Mutualisé avec `notify-telegram` |
| `TELEGRAM_CHAT_ID` | Mutualisé avec `notify-telegram` (= chat_id admin autorisé) |
| `TELEGRAM_WEBHOOK_SECRET` | Spécifique à cette fonction (étape 2 ci-dessus) |
| `SUPABASE_URL` | Auto-injecté par Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injecté par Supabase |
