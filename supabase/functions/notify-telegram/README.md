# notify-telegram — Edge Function

Relais unique vers Telegram pour toutes les notifications admin Zenbat.
Appelée par : DB Webhooks Supabase, front (PDF), webhook Stripe.

Aucun stockage : les PDF transitent en mémoire et sont relayés à Telegram en `multipart/form-data`.

---

## 1. Créer le bot Telegram

1. Sur Telegram, démarrer une conversation avec **[@BotFather](https://t.me/BotFather)**.
2. Envoyer `/newbot`, suivre les instructions, choisir un nom et un handle.
3. Récupérer le **bot token** (format `123456:ABC-...`).
4. Démarrer une conversation avec le bot fraîchement créé (lui envoyer `/start`).
5. Récupérer ton **chat_id** :
   - Soit via [@userinfobot](https://t.me/userinfobot) (envoyer un message à ce bot, il renvoie ton id).
   - Soit en visitant `https://api.telegram.org/bot<TOKEN>/getUpdates` après avoir envoyé un message à ton bot (chercher `"chat":{"id":...}` dans le JSON).

## 2. Configurer les secrets côté Supabase

Dans le dashboard Supabase → **Project Settings → Edge Functions → Manage secrets** :

| Clé | Valeur |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Le token du bot |
| `TELEGRAM_CHAT_ID` | Ton chat_id |

## 3. Déployer la fonction

```bash
supabase functions deploy notify-telegram
```

(Ou via l'UI Supabase si la CLI n'est pas configurée.)

L'URL de l'endpoint sera : `https://<project>.supabase.co/functions/v1/notify-telegram`

## 4. Appliquer la migration `0028_profiles_audit.sql`

Copier le contenu dans **SQL Editor** Supabase et exécuter. Crée le trigger qui logge les inscriptions dans `activity_log`.

## 5. Configurer les Database Webhooks

Dans **Database → Webhooks → Create a new hook**, créer **4 webhooks**, tous identiques sauf la table source :

**Configuration commune :**
- Method : `POST`
- URL : `https://<project>.supabase.co/functions/v1/notify-telegram`
- HTTP Headers : *(rien à ajouter — Supabase ajoute automatiquement le service_role key dans Authorization)*

**Webhooks à créer :**

| # | Table | Événements | Notes |
|---|---|---|---|
| 1 | `activity_log` | INSERT | Capture devis, factures, inscriptions (via trigger 0028) |
| 2 | `ia_error_logs` | INSERT | Erreurs IA |
| 3 | `ia_negative_logs` | INSERT | Feedbacks négatifs IA |
| 4 | `app_logs` | INSERT | Erreurs applicatives (level=error filtré côté fonction) |

## 6. Tester

Faire une nouvelle inscription : tu devrais recevoir une notif Telegram dans la seconde.

Pour tester sans inscription :

```bash
curl -X POST https://<project>.supabase.co/functions/v1/notify-telegram \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"kind":"raw","payload":{"text":"Test depuis curl ✓"}}'
```

---

## Événements gérés (`kind`)

| Kind | Source | Contenu |
|---|---|---|
| `signup` | DB Webhook profiles INSERT (direct) | Email + métier principal |
| `activity` | DB Webhook activity_log INSERT | Devis/factures créés ou statut modifié |
| `ia_error` | DB Webhook ia_error_logs INSERT | Message d'erreur IA |
| `ia_negative` | DB Webhook ia_negative_logs INSERT | Feedback négatif |
| `app_log_error` | DB Webhook app_logs INSERT (level=error) | Message d'erreur app |
| `payment_success` | api/stripe-webhook.js | Email + plan + montant |
| `subscription_canceled` | api/stripe-webhook.js | Email |
| `pdf_generated` | front (pdfBuilder.js) | Numéro + montant + PDF en pièce jointe |
| `raw` | tests / debug | Texte libre |

## Ajouter un nouvel événement

1. Ajouter un case dans `formatEvent()` (`index.ts`).
2. Si la source est une nouvelle table : créer un DB Webhook + brancher dans `fromSupabaseWebhook()`.
3. Si la source est le code Zenbat : appeler `notifyAdmin('mon_event', {...})` depuis `src/lib/telegramNotify.js`.

Aucune modification de schéma DB nécessaire pour la majorité des cas.
