# Audit faisabilité — intégration Plateforme Agréée (PA) pour Zenbat

**Date** : 2026-05-07
**Branche** : `claude/audit-einvoicing-integration-awnev`
**Scope** : état des lieux pur (read-only). Aucune modification de code/DB.
**Réforme cible** : facturation électronique B2B France — réception
obligatoire pour **toutes** les entreprises au 01/09/2026, émission
obligatoire pour les TPE/PME au 01/09/2027.

---

## ⚠ Divergence préalable à clarifier

Le brief décrit Zenbat comme « PWA single-file HTML, backend Supabase +
Cloudflare Worker proxy Claude API ». Le repo réel (cf `CLAUDE.md`,
`vite.config.js`, `vercel.json`, `api/`) est :

- **React + Vite** (multi-fichiers `src/**`, `lazy()`/`Suspense`, hooks…)
- **Vercel Serverless Functions** (10 fichiers dans `/api/`, plafond Hobby = 12)
- **Supabase** (auth, Postgres avec RLS, Storage, Edge Functions)
- **Claude API** proxyfiée via `api/claude.js` (Vercel), pas Cloudflare

→ Toutes les recommandations ci-dessous tiennent compte de cette stack
réelle, **pas** de la stack décrite dans le brief. La "philosophie
single-file HTML" évoquée comme contrainte n'existe pas ; la contrainte
de design réelle est le **plafond de 12 fonctions Vercel** (cf §4).

---

## 1. Inventaire schéma Supabase actuel

Source : 38 migrations dans `supabase/migrations/0001…0038*.sql`. Les
tables ci-dessous sont celles touchées par le périmètre facture
électronique (factures, devis, clients, profils, B2Brouter, audit).

### `public.profiles` (PK `id` = `auth.users.id`)

| Colonne | Type | Source migration |
|---|---|---|
| `id` | `uuid` PK FK→`auth.users(id)` | 0001 |
| `company_name` | `text` | 0001 |
| `full_name` | `text` | 0001 |
| `phone` | `text` | 0001 |
| `plan` | `text` (`free`/`pro`) | 0001 |
| `ai_used` | `int` | 0001 |
| `created_at` / `updated_at` | `timestamptz` | 0001 |
| `cgu_accepted_at` | `timestamptz` | 0008 |
| `cgu_version` | `text` | 0008 |
| `brand_data` | `jsonb` | 0021 |
| `stripe_customer_id` | `text` | 0027 |
| `stripe_subscription_id` | `text` | 0027 |
| `comptable_email` | `text` | 0034 |

`brand_data` (jsonb) — clés observées dans `src/lib/constants.js`
`DEFAULT_BRAND` + `src/lib/brandCompleteness.js` :
`companyName, logo, siret, tva, firstName, lastName, vatRegime
('normal'|'franchise'), address, city, phone, email, website, color,
fontStyle, mentionsLegales, rib, iban, bic, paymentTerms, validityDays,
trades[], devisGratuit, devisTarif, travelFees, legalForm, rcs, capital,
paymentPenalties, escompte`.

→ Plusieurs champs Factur-X sont **enfouis dans le JSONB** au lieu
d'être en colonnes typées (cf §2).

### `public.clients`

| Colonne | Type | Source migration |
|---|---|---|
| `id` | `uuid` PK | 0001 |
| `owner_id` | `uuid` FK→`profiles(id)` | 0001 |
| `type` | `text` (`entreprise`/`particulier`/`artisan`) | 0001 + 0002 |
| `raison_sociale` | `text` | 0001 |
| `siret` | `text` | 0001 |
| `nom` / `prenom` | `text` | 0001 |
| `email` / `telephone` | `text` | 0001 |
| `adresse` / `code_postal` / `ville` | `text` | 0001 |
| `notes` | `text` | 0001 |
| `created_at` / `updated_at` | `timestamptz` | 0001 |
| `telephone_fixe` | `text` | 0002 |
| `tva_intra` | `text` | 0002 |
| `activite` | `text` | 0002 |

### `public.devis`

| Colonne | Type | Source migration |
|---|---|---|
| `id` | `uuid` PK | 0001 |
| `owner_id` | `uuid` FK→`profiles(id)` | 0001 |
| `client_id` | `uuid` FK→`clients(id)` | 0001 |
| `numero` | `text` (unique par owner) | 0001 |
| `objet` | `text` | 0001 |
| `ville_chantier` | `text` | 0001 |
| `statut` | `text` (`brouillon, envoye, en_signature, en_negociation, accepte, refuse, remplace`) | 0001 + 0019 |
| `montant_ht` | `numeric(14,2)` | 0001 |
| `tva_rate` | `numeric(5,2)` (défaut 20) | 0001 |
| `date_emission` / `date_validite` | `date` | 0001 |
| `odoo_sign_id` / `odoo_sign_url` | `text` | 0001 |
| `signed_at` | `timestamptz` | 0001 |
| `signed_by` | `text` | 0007 |
| `pdf_path` | `text` | 0001 |
| `deleted_at` | `timestamptz` (soft-delete) | 0009 |
| `root_devis_id` | `uuid` FK→`devis(id)` | 0019 |
| `indice` | `text` | 0019 |
| `public_token` | `uuid` (page publique client) | 0032 |
| `sent_to_client_at` | `timestamptz` | 0032 |
| `client_name` | `text` | 0032 |
| `client_accepted_at` / `client_refused_at` | `timestamptz` | 0032 |
| `client_refusal_reason` | `text` | 0032 |
| `auto_liquidation_btp` | `boolean` | 0038 |
| `created_at` / `updated_at` | `timestamptz` | 0001 |

### `public.lignes_devis`

| Colonne | Type | Source migration |
|---|---|---|
| `id` | `uuid` PK | 0001 |
| `devis_id` | `uuid` FK→`devis(id)` cascade | 0001 |
| `owner_id` | `uuid` FK→`profiles(id)` | 0001 |
| `position` | `int` | 0001 |
| `type_ligne` | `text` (`lot`/`ouvrage`) | 0001 |
| `lot` | `text` | 0001 |
| `designation` | `text` (NOT NULL) | 0001 |
| `unite` | `text` (libellé libre — `m²`, `forfait`, `h`…) | 0001 |
| `quantite` | `numeric(12,3)` | 0001 |
| `prix_unitaire` | `numeric(14,2)` | 0001 |
| `tva_rate` | `numeric(5,2)` défaut 20 | 0002 |
| `created_at` | `timestamptz` | 0001 |

### `public.invoices` (table principale facture)

| Colonne | Type | Source migration |
|---|---|---|
| `id` | `uuid` PK | 0005 |
| `owner_id` | `uuid` FK→`auth.users(id)` | 0005 |
| `devis_id` | `uuid` FK→`devis(id)` set null | 0005 |
| `client_id` | `uuid` FK→`clients(id)` set null | 0005 |
| `numero` | `text` (unique par owner — `FAC-YYYY-NNNN`) | 0005 |
| `objet` | `text` | 0005 |
| `operation_type` | `text` (`vente`/`service`/`mixte`) | 0005 |
| `statut` | `text` (`brouillon, envoyee, recue, payee, rejetee, annulee`) | 0005 |
| `locked` | `boolean` (auto-trigger 0009) | 0005 |
| `montant_ht` | `numeric(12,2)` | 0005 |
| `montant_tva` | `numeric(12,2)` | 0005 |
| `montant_ttc` | `numeric(12,2)` | 0005 |
| `retenue_garantie_pct` | `numeric(5,2)` | 0005 |
| `retenue_garantie_eur` | `numeric(12,2)` | 0005 |
| `date_emission` | `date` (NOT NULL, défaut today) | 0005 |
| `date_echeance` | `date` | 0005 |
| `ville_chantier` | `text` | 0005 |
| `notes` | `text` | 0005 |
| `pdf_path` | `text` | 0005 |
| `b2brouter_invoice_id` | `text` | 0005 |
| `b2brouter_status` | `text` | 0005 |
| `b2brouter_last_event` | `timestamptz` | 0005 |
| `deleted_at` | `timestamptz` (soft-delete) | 0009 |
| `avoir_of_invoice_id` | `uuid` FK→`invoices(id)` | 0010 |
| `invoice_type` | `text` (`normale`/`acompte`) | 0018 |
| `auto_liquidation_btp` | `boolean` | 0038 |
| `created_at` / `updated_at` | `timestamptz` | 0005 |

Triggers / RPC : `autolock_invoice_on_emission()` (0009),
`next_invoice_number()` (0005), `create_avoir_from()` (0010 + 0038),
`soft_delete_invoice()` (0009).

### `public.lignes_invoices`

Identique à `lignes_devis` mais référence `invoice_id`. Ajout
`deleted_at` en 0009. Pas de policy DELETE user-facing (manipulation
via parent uniquement, sauf cascade).

### `public.b2b_accounts` (compte B2Brouter par artisan)

| Colonne | Type |
|---|---|
| `id` | `uuid` PK |
| `owner_id` | `uuid` UNIQUE FK→`auth.users(id)` |
| `b2brouter_account_id` | `text` |
| `siren` | `text` |
| `environment` | `text` (`staging`/`production`) |
| `created_at`/`updated_at` | `timestamptz` |

→ Cette table est **spécifique B2Brouter**. Pour un module multi-PA
abstrait (Super PDP + Iopole en backup), il faudra la généraliser
(cf §5).

### Tables connexes

- `devis_otp_sessions`, `devis_audit_log`, `devis_negotiations`
  (0032 — page publique devis client)
- `devis_documents` (0033 — pièces jointes assurance, attestations TVA)
- `support_tickets`, `support_messages` (0030)
- `activity_log` (0012), `app_logs` (0017), `cgu_acceptances` (0008)
- `ia_conversations`, `ia_error_logs`, `ia_negative_logs`, `ia_feedback`
- `newsletter_subscribers` (0023)

---

## 2. Mapping schéma vs Factur-X EN 16931

Source de l'XML CII actuel : `src/lib/facturx.js` (profil
`urn:cen.eu:en16931:2017`) et `api/facturx.js` (assemblage PDF/A-3
côté serveur). Code observé : conforme EN 16931 sur le strict
nécessaire BASIC, mais plusieurs champs critiques pour la PA sont
**dérivés** de `brand_data` jsonb plutôt que de colonnes typées.

### Émetteur (Seller) — depuis `profiles.brand_data`

| Champ EN 16931 | Statut | Référence |
|---|---|---|
| SIREN | ✅ dérivé | `brand_data.siret.slice(0,9)` (`facturx.js:114-115`) |
| SIRET | ✅ | `brand_data.siret` (jsonb) |
| Raison sociale exacte | ⚠ | `brand_data.companyName` — pas de validation INSEE, peut diverger du registre |
| N° TVA intra | ✅ | `brand_data.tva` (jsonb) |
| Adresse + CP + Ville | ⚠ mal typé | `brand_data.address` (texte libre) + `brand_data.city` parsé pour extraire CP via regex `/\d{5}/` (`facturx.js:124-126`) — fragile |
| Code pays émetteur | ❌ | hardcodé `FR` dans `facturx.js:261` ; aucune colonne |
| Forme juridique | ⚠ | `brand_data.legalForm` jsonb — texte libre, pas dans Factur-X mais requis art. 242 nonies A pour le PDF visuel |
| Capital social | ⚠ | `brand_data.capital` jsonb — texte libre |
| RCS | ⚠ | `brand_data.rcs` jsonb |
| IBAN / BIC | ✅ / ✅ | `brand_data.iban`, `brand_data.bic` |
| Téléphone | ✅ | `brand_data.phone` (BG-6 `DefinedTradeContact`) |
| Email | ✅ | `brand_data.email` |
| Régime TVA (`normal`/`franchise`) | ✅ | `brand_data.vatRegime` — utilisé pour mention 293 B (`facturx.js:16,178`) |

### Destinataire (Buyer) — depuis `clients`

| Champ EN 16931 | Statut | Référence |
|---|---|---|
| SIREN (obligatoire B2B FR) | ⚠ dérivé | `clients.siret.slice(0,9)` ; pas de validation, pas de colonne dédiée |
| SIRET | ✅ | `clients.siret` |
| N° TVA intra (UE) | ✅ | `clients.tva_intra` (0002) — **non émis dans le XML actuel** ; à brancher dans `BuyerTradeParty` |
| Raison sociale | ✅ | `clients.raison_sociale` |
| Adresse + CP + Ville | ✅ | `clients.adresse`, `clients.code_postal`, `clients.ville` (colonnes typées séparées — meilleur que côté seller) |
| Code pays destinataire | ❌ | hardcodé `FR` (`facturx.js:272`) |
| Référence acheteur / bon de commande | ❌ | `invoice.buyer_reference` lu dans `facturx.js:219` mais **aucune colonne** ne le porte ; fallback sur `client.reference`/`raison_sociale`/`nom` |
| Type client (`entreprise`/`particulier`) | ✅ | `clients.type` — **important** : la réforme PA cible le B2B ; les clients `particulier` sortent du périmètre PA (mais le PDF reste en cycle de vie standard) |
| Identifiant Chorus Pro / numéro de marché | ❌ | absent — bloquant pour le secteur public |

### Facture en-tête — `invoices`

| Champ EN 16931 | Statut | Référence |
|---|---|---|
| Numéro séquentiel | ✅ | `invoices.numero` + RPC `next_invoice_number()` (`FAC-YYYY-NNNN`) |
| Date émission | ✅ | `invoices.date_emission` |
| Date exécution / livraison | ⚠ | absente en colonne ; `facturx.js:279` réutilise `date_emission` — non conforme si livraison ≠ émission |
| Type document (380/381/384) | ✅ | dérivé : 380 par défaut, 381 si `avoir_of_invoice_id IS NOT NULL` (`facturx.js:94`) ; **384 (rectificative) absent** — la stratégie actuelle est uniquement par avoir |
| Devise | ⚠ | hardcodée `EUR` (`facturx.js:285`) ; aucune colonne |
| Référence devis lié | ✅ | `invoices.devis_id` FK ; **non émise dans `BuyerOrderReferencedDocument`** XML actuel |
| `invoice_type` (normale/acompte) | ✅ | colonne 0018 — utilisé pour badge UI mais pas mappé en `TypeCode` Factur-X (l'acompte garde 380) |
| Acompte versé | ⚠ | déductible via avoir lié, mais pas via champ `TotalPrepaidAmount` du XML |

### Lignes — `lignes_invoices`

| Champ EN 16931 | Statut | Référence |
|---|---|---|
| Désignation | ✅ | `lignes_invoices.designation` (NOT NULL) |
| Quantité | ✅ | `quantite numeric(12,3)` |
| Unité codifiée (UN/ECE Rec. 20) | ⚠ mal typé | `unite` texte libre ; mappé via `UNIT_CODE_MAP` à la volée (`facturx.js:24-57`). Si l'utilisateur tape `m2` → mappé OK ; `mois` → fallback `C62` (incorrect — devrait être `MON`, mais `MON` est dans la map) |
| PU HT | ✅ | `prix_unitaire numeric(12,2)` |
| Taux TVA par ligne | ✅ | `tva_rate numeric(5,2)` |
| Montant HT par ligne | ✅ calculé | `quantite * prix_unitaire` (calcul, pas stocké — risque d'arrondi sur la PA) |
| Remise par ligne | ❌ | absent ; aucune colonne `remise_pct` / `remise_eur` sur `lignes_invoices` |
| Référence article (catalogue) | ❌ | absent (pas un blocage EN 16931 mais utile pour PA) |

### Totaux — `invoices`

| Champ EN 16931 | Statut |
|---|---|
| Total HT | ✅ `montant_ht` |
| Détail TVA par taux (base + montant) | ✅ recalculé à la volée par groupBy de `lignes_invoices.tva_rate` (`facturx.js:97-104`) |
| Total TVA | ✅ `montant_tva` |
| Total TTC | ✅ `montant_ttc` |
| Acompte versé | ❌ pas de colonne |
| Net à payer | ✅ calculé `totalTTC - retenue_garantie_eur` |
| Retenue garantie | ✅ `retenue_garantie_pct` + `retenue_garantie_eur` |

### Paiement

| Champ EN 16931 | Statut |
|---|---|
| Conditions règlement | ✅ `brand_data.paymentTerms` |
| Date échéance | ✅ `invoices.date_echeance` |
| IBAN | ✅ `brand_data.iban` |
| BIC | ✅ `brand_data.bic` (recommandé) |
| Mode (UNTDID 4461) | ⚠ hardcodé 58 (SEPA Credit Transfer) `facturx.js:288` ; pas de colonne |
| Pénalités de retard | ✅ `brand_data.paymentPenalties` (jsonb) — affiché PDF, pas en XML structuré |
| Indemnité forfaitaire 40 € | ✅ inclus dans `brand_data.paymentPenalties` (texte) |

### Mentions conditionnelles

| Champ | Statut |
|---|---|
| Franchise art. 293 B CGI | ✅ `brand_data.vatRegime === 'franchise'` → `ExemptionReason` posée + CategoryCode E (`facturx.js:175-181`) |
| AGA (centre de gestion agréé) | ❌ absent |
| Auto-liquidation BTP art. 283-2 nonies | ✅ `invoices.auto_liquidation_btp` (0038) → CategoryCode AE |
| Assurance décennale + assureur (BTP) | ⚠ `brand_data.mentionsLegales` (texte libre, pas structuré) ; `devis_documents` (0033) peut héberger l'attestation PDF |
| Garanties biennale / parfait achèvement | ⚠ idem mentionsLegales |

### Synthèse mapping

| Catégorie | ✅ | ⚠ | ❌ |
|---|---:|---:|---:|
| Émetteur | 7 | 6 | 1 (country code) |
| Destinataire | 4 | 1 | 3 (country, buyer ref, Chorus) |
| En-tête facture | 4 | 3 | 0 |
| Lignes | 5 | 1 | 2 (remise, ref article) |
| Totaux | 5 | 0 | 1 (acompte versé) |
| Paiement | 5 | 1 | 0 |
| Mentions | 2 | 2 | 1 (AGA) |

**Verdict mapping** : couverture solide pour la **majorité** des
champs EN 16931 BASIC, mais plusieurs items typés en JSONB
(`brand_data`) ou hardcodés en code (country, devise, mode paiement)
doivent être migrés en colonnes pour que la PA puisse les valider sans
parser un blob.

---

## 3. Flux facture actuel

### Création d'une facture

1. **Depuis un devis accepté** (`src/hooks/useInvoices.js:69` —
   `onCreateInvoiceFromDevis`) : `nextInvoiceNumber()` (RPC) → INSERT
   `invoices` + lignes via `apiCreateInvoice` (`src/lib/api.js:388`).
2. **Vide** : `onCreateEmptyInvoice` → idem sans devis source.
3. **Acompte sur devis** : `createAcompteFromDevis` (`api.js:358`) crée
   une facture `invoice_type='acompte'` avec une seule ligne forfait.
4. **Avoir** : RPC `create_avoir_from(p_invoice_id)` (`0010` + `0038`)
   — copie l'invoice + lignes en brouillon, pose
   `avoir_of_invoice_id`.

### Édition

`InvoiceDetail.jsx` (`src/components/InvoiceDetail.jsx`) — formulaire
avec garde-fou `isLocked = invoice.locked || statut !== 'brouillon'`.
Sauvegarde via `onSaveInvoice` (`useInvoices.js:36`) qui :
- compare avec `invoicesRef.current` pour éviter race-condition double-save,
- appelle `apiUpdateInvoice(id, fields)` (`api.js:415`),
- replace les lignes via `replaceInvoiceLignes` (soft-delete + re-insert).

### Émission = bouton "🔒 Émettre" → génération Factur-X

Code clé : `InvoiceDetail.jsx:43-109` (`handleFacturX`) :

1. Génère le PDF visuel côté **client** via
   `src/lib/pdfBuilder.js` (jsPDF + DejaVu Sans embarqué dans `/public/fonts`).
2. POST `/api/facturx` avec `{pdf_base64, invoice, client, brand,
   sourceInvoice}` + Bearer token.
3. `api/facturx.js` :
   - Construit le XML CII profil EN 16931 (`buildXML()`),
   - Embarque l'XML dans le PDF (`pdf-lib.attach` + `AFRelationship.Alternative`),
   - Injecte le bloc XMP Factur-X (`pdfaid:part=3`, `fx:ConformanceLevel=EN 16931`),
   - Tente d'ajouter un OutputIntent sRGB depuis `public/icc/sRGB.icc`,
   - Renvoie le PDF/A-3 enrichi en base64.
4. Téléchargement local + bascule statut → `envoyee` (le trigger
   `autolock_invoice_on_emission` pose `locked=true`).

**Aucun envoi à un destinataire ni transmission PPF/PA n'est fait à ce
stade**. La conformité fiscale est posée (immutabilité), mais
l'**adressage légal** (envoyer la facture au client via PDP/PPF) repose
aujourd'hui sur :
- B2Brouter via `api/b2brouter.js` action `send_invoice`
  (`src/lib/api.js:505-510` `b2b.sendInvoice`) — utilisé en backend mais
  **absent du UI principal de `InvoiceDetail`** (pas de bouton "Envoyer
  via B2Brouter" dans le composant lu).
- ou export manuel du PDF Factur-X par l'artisan vers son client / Chorus Pro.

### Point d'insertion naturel pour la PA

L'endroit logique pour appeler la PA est **dans `handleFacturX` à
`InvoiceDetail.jsx:87`** (juste après réception du PDF/A-3 et avant la
bascule `statut='envoyee'`). Pseudocode du chaînage cible :

```js
// 1. PDF visuel (client)  →  /api/facturx (assemblage PDF/A-3 + XML)
//                          →  PA: provider.sendInvoice({pdf, xml, invoice})
//                          →  bascule statut + persist provider_invoice_id
```

Aujourd'hui l'appel B2Brouter est dans `api/b2brouter.js` action
`send_invoice`, **non rappelé depuis le bouton Factur-X**. Il y a donc
deux flux disjoints :
- "Émettre Factur-X" (PDF/A-3 téléchargé, statut envoyé, **rien envoyé ailleurs**)
- "B2Brouter send_invoice" (existe en API, sans UI visible dans `InvoiceDetail`)

→ La cible "Super PDP + Iopole backup" doit unifier ces deux flux
derrière un module abstrait, puis exposer un seul bouton « Émettre &
transmettre » dans `InvoiceDetail`.

---

## 4. Architecture cible — module `einvoicing-provider`

### Contraintes

- **Plafond Vercel Hobby** : 12 fonctions max, **10 utilisées**
  (cf `CLAUDE.md`). Il reste 2 slots. La règle de fusion est :
  on regroupe par domaine et on route en interne (header / `action` /
  param querystring).
- **Convention existante** : `b2brouter.js` route déjà via `action`
  (proxy authentifié) **et** par header `x-b2b-signature` (webhook).
  Le module générique PA doit suivre le même pattern.
- Le code actuel B2Brouter est **fortement couplé** à `clients.siret`,
  `invoices.b2brouter_invoice_id`, `b2b_accounts`. Une couche
  d'abstraction est nécessaire avant d'ajouter un 2e provider.

### Emplacement proposé

**Front (TS/JS)** : `src/lib/einvoicing/`
```
src/lib/einvoicing/
  index.js          — façade publique (sendInvoice, getStatus, ...)
  provider.js       — switch sur process.env.VITE_PA_PROVIDER (ou DB)
  providers/
    superpdp.js     — adapter Super PDP
    iopole.js       — adapter Iopole (backup)
    b2brouter.js    — adapter B2Brouter (rétrocompat / éphémère)
  schema.js         — normalisation invoice → payload générique PA
```

**API (Vercel)** : **fusionner** `api/b2brouter.js` en
`api/einvoicing.js` qui route en interne :
- header `x-pa-signature: superpdp|iopole|b2brouter` ou route `?route=webhook&provider=...` → handler webhook
- POST authentifié `{ provider?, action, payload }` → handler action

→ Reste à **10 fonctions** (on remplace `b2brouter.js` par
`einvoicing.js`, on ne dépasse pas le plafond). La rewrite Vercel
`/api/b2brouter-webhook → /api/einvoicing?route=webhook&provider=b2brouter`
préserve l'URL externe.

### Interface du module

```js
// src/lib/einvoicing/index.js (interface contractuelle, pas implémentation)

/**
 * @typedef {Object} EInvoice
 * @property {string} numero
 * @property {string} date_emission   // YYYY-MM-DD
 * @property {string} [date_echeance]
 * @property {string} type            // 'invoice' | 'credit' | 'corrective'
 * @property {EInvoiceLine[]} lignes
 * @property {EInvoiceParty} seller
 * @property {EInvoiceParty} buyer
 * @property {EInvoiceTotals} totals
 * @property {EInvoicePayment} payment
 * @property {string} [pdf_base64]    // PDF/A-3 Factur-X assemblé (côté serveur)
 * @property {string} [xml]           // CII XML (peut être généré par le provider)
 */

/**
 * @typedef {Object} EInvoiceParty
 * @property {string} name
 * @property {string} [siren]         // 9 chiffres
 * @property {string} [siret]         // 14 chiffres
 * @property {string} [vat_intra]
 * @property {string} address_line
 * @property {string} postal_code
 * @property {string} city
 * @property {string} country         // ISO 3166-1 alpha-2 (FR par défaut)
 * @property {string} [legal_form]
 * @property {string} [capital]
 * @property {string} [rcs]
 * @property {string} [contact_name]
 * @property {string} [phone]
 * @property {string} [email]
 * @property {string} [buyer_reference]
 */

/**
 * @typedef {'pending'|'sent'|'received'|'paid'|'rejected'|'cancelled'|'error'} EInvoiceStatus
 */

/**
 * @typedef {Object} EInvoiceProvider
 * @property {string} id              // 'superpdp' | 'iopole' | 'b2brouter'
 *
 * Création/MAJ du compte émetteur côté PA.
 * @property {(company: EInvoiceParty) => Promise<{provider_account_id: string}>} registerAccount
 *
 * Vérifie qu'un destinataire B2B FR est joignable via PA (annuaire PPF).
 * @property {(siren: string) => Promise<{found: boolean, name?: string, recipient_id?: string}>} lookupRecipient
 *
 * Transmet une facture (PDF + XML) à la PA.
 * @property {(invoice: EInvoice) => Promise<{provider_invoice_id: string, status: EInvoiceStatus, raw: any}>} sendInvoice
 *
 * Récupère le statut de cycle de vie d'une facture déjà transmise.
 * @property {(provider_invoice_id: string) => Promise<{status: EInvoiceStatus, history: Array<{status: EInvoiceStatus, at: string}>, raw: any}>} getStatus
 *
 * (optionnel — interop) Webhook : valide la signature + parse l'event.
 * @property {(req: { headers: Record<string,string>, rawBody: string }) => Promise<{provider_invoice_id: string, status: EInvoiceStatus} | null>} parseWebhook
 */

// Façade utilisée par le code métier (jamais d'appel direct à un provider) :
export async function sendInvoice(invoice)            { return getProvider().sendInvoice(invoice); }
export async function getStatus(provider_invoice_id)  { return getProvider().getStatus(provider_invoice_id); }
export async function lookupRecipient(siren)          { return getProvider().lookupRecipient(siren); }
export async function registerAccount(company)        { return getProvider().registerAccount(company); }

// Sélection du provider : DB-driven (par profil) avec fallback env var.
function getProvider() { /* charge superpdp.js | iopole.js selon config */ }
```

### Côté serveur (Vercel)

`api/einvoicing.js` reprend la structure de `api/b2brouter.js` mais :
- charge dynamiquement le bon adapter selon `payload.provider` ou la
  ligne `pa_accounts(provider, owner_id)`,
- expose les actions : `register_account`, `lookup_recipient`,
  `send_invoice`, `get_status`, `list_received`,
- expose le webhook entrant via détection multi-header
  (`x-superpdp-signature`, `x-iopole-signature`,
  `x-b2b-signature`, `x-b2brouter-signature`).

Le code métier (`hooks/useInvoices.js`, `InvoiceDetail.jsx`) ne
référence **que** `src/lib/einvoicing/index.js`, jamais un provider
spécifique.

---

## 5. Migrations SQL nécessaires (drafts — à NE PAS exécuter)

Ces drafts respectent la convention de numérotation : prochaine
migration `0039_*`. À appliquer manuellement dans le SQL Editor
Supabase (cf `CLAUDE.md`).

### 0039 — Champs Factur-X manquants (typage) sur `clients`, `invoices`, `lignes_invoices`

```sql
-- ─── Clients : pays, référence acheteur, identifiants PA ──────
alter table public.clients
  add column if not exists country_code        char(2)  default 'FR',
  add column if not exists buyer_reference     text,        -- BT-10 EN 16931
  add column if not exists chorus_pro_id       text,        -- secteur public
  add column if not exists pa_recipient_id     text,        -- id annuaire PPF
  add column if not exists pa_lookup_at        timestamptz;

create index if not exists clients_pa_recipient_idx
  on public.clients(pa_recipient_id) where pa_recipient_id is not null;

-- ─── Invoices : devise, type document, dates livraison/service, totaux ──
alter table public.invoices
  add column if not exists currency_code      char(3)   not null default 'EUR',
  add column if not exists document_type      text      not null default '380'
    check (document_type in ('380','381','384','389')), -- 380=facture, 381=avoir, 384=rectif, 389=auto-facture
  add column if not exists service_date_start date,
  add column if not exists service_date_end   date,
  add column if not exists delivery_date      date,
  add column if not exists buyer_order_ref    text,    -- BT-13 (n° BC client)
  add column if not exists prepaid_amount     numeric(12,2) default 0,
  add column if not exists payment_means_code text default '58'; -- UNTDID 4461

-- Backfill cohérent avec la logique actuelle :
update public.invoices
  set document_type = '381'
  where avoir_of_invoice_id is not null
    and document_type = '380';

-- ─── Lignes : remise, code unité normalisé ──────
alter table public.lignes_invoices
  add column if not exists remise_pct      numeric(5,2) default 0,
  add column if not exists remise_eur      numeric(12,2) default 0,
  add column if not exists unit_code       text,        -- UN/ECE Rec. 20 (MTK, HUR, C62…)
  add column if not exists item_reference  text;        -- code article catalogue

-- Backfill `unit_code` depuis `unite` libre — à faire en JS lors de la
-- prochaine édition (laisse NULL au départ ; le mapping reste dans
-- src/lib/einvoicing/schema.js par cohérence avec UNIT_CODE_MAP existant).

-- Idem pour lignes_devis (cohérence devis → facture).
alter table public.lignes_devis
  add column if not exists remise_pct  numeric(5,2) default 0,
  add column if not exists remise_eur  numeric(12,2) default 0,
  add column if not exists unit_code   text;
```

### 0040 — Multi-provider PA (généralise `b2b_accounts`)

```sql
-- Table générique pour comptes PA (Super PDP, Iopole, B2Brouter…).
-- On garde b2b_accounts pour rétrocompat et on migre en lecture/écriture
-- via une vue ou une copie applicative ; à terme drop b2b_accounts.
create table if not exists public.pa_accounts (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references auth.users(id) on delete cascade,
  provider              text not null
    check (provider in ('superpdp','iopole','b2brouter')),
  provider_account_id   text not null,
  siren                 text,
  is_default            boolean not null default false,
  environment           text not null default 'production'
    check (environment in ('staging','production')),
  registered_at         timestamptz not null default now(),
  last_status_at        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (owner_id, provider, environment)
);

-- Garantit qu'un seul compte par owner est marqué default
create unique index if not exists pa_accounts_one_default_per_owner
  on public.pa_accounts(owner_id) where is_default;

alter table public.pa_accounts enable row level security;

create policy "pa_accounts_select_own" on public.pa_accounts
  for select using (auth.uid() = owner_id);
create policy "pa_accounts_insert_own" on public.pa_accounts
  for insert with check (auth.uid() = owner_id);
create policy "pa_accounts_update_own" on public.pa_accounts
  for update using (auth.uid() = owner_id);

-- Backfill depuis b2b_accounts existant
insert into public.pa_accounts (owner_id, provider, provider_account_id, siren, environment, is_default)
  select owner_id, 'b2brouter', b2brouter_account_id, siren, environment, true
  from public.b2b_accounts
on conflict (owner_id, provider, environment) do nothing;
```

### 0041 — Cycle de vie facture côté PA + statuts normalisés

```sql
-- Colonnes provider-agnostiques sur invoices.
-- Les colonnes b2brouter_* restent pour rétrocompat — on les remplit en
-- parallèle pendant la transition, puis drop dans une migration future.
alter table public.invoices
  add column if not exists pa_provider           text
    check (pa_provider in ('superpdp','iopole','b2brouter')),
  add column if not exists pa_invoice_id         text,
  add column if not exists pa_lifecycle_status   text,    -- statut natif PA
  add column if not exists pa_normalized_status  text     -- 226 PPF | mapping interne
    check (pa_normalized_status is null or pa_normalized_status in
      ('pending','sent','received','accepted','rejected','suspended','paid','cancelled')),
  add column if not exists pa_last_event_at      timestamptz,
  add column if not exists pa_last_error         text;

create index if not exists invoices_pa_id_idx
  on public.invoices(pa_provider, pa_invoice_id);

-- Backfill existant (B2Brouter)
update public.invoices
   set pa_provider          = 'b2brouter',
       pa_invoice_id        = b2brouter_invoice_id,
       pa_lifecycle_status  = b2brouter_status,
       pa_last_event_at     = b2brouter_last_event
 where b2brouter_invoice_id is not null
   and pa_provider is null;

-- Journal d'événements PA (pour l'historique 226 statuts PPF).
create table if not exists public.invoice_pa_events (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  provider     text not null,
  event_type   text not null,
  raw_payload  jsonb,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists invoice_pa_events_invoice_idx
  on public.invoice_pa_events(invoice_id, occurred_at desc);

alter table public.invoice_pa_events enable row level security;

create policy "invoice_pa_events_select_own" on public.invoice_pa_events
  for select using (auth.uid() = owner_id);
-- Insertions via service_role (webhook) uniquement.
```

### 0042 — Promouvoir certains champs `brand_data` en colonnes typées

```sql
-- Promotion des champs Factur-X "structurés" hors du blob jsonb.
-- brand_data reste pour les champs UI (couleur, fontStyle, logo binary…),
-- mais le code Factur-X lit en priorité les colonnes typées.
alter table public.profiles
  add column if not exists siret             char(14),
  add column if not exists siren             char(9)
    generated always as (substring(siret from 1 for 9)) stored,
  add column if not exists tva_intra         text,
  add column if not exists vat_regime        text not null default 'normal'
    check (vat_regime in ('normal','franchise')),
  add column if not exists legal_form        text,
  add column if not exists capital_eur       numeric(14,2),
  add column if not exists rcs               text,
  add column if not exists address_line      text,
  add column if not exists postal_code       text,
  add column if not exists city              text,
  add column if not exists country_code      char(2) default 'FR',
  add column if not exists iban              text,
  add column if not exists bic               text,
  add column if not exists insurance_decennale_provider text,
  add column if not exists insurance_decennale_policy   text,
  add column if not exists agc_centre        text;       -- AGA / centre de gestion agréé

-- Backfill depuis brand_data jsonb existant (idempotent)
update public.profiles set
  siret        = coalesce(siret,        nullif(regexp_replace(brand_data->>'siret', '\s+', '', 'g'), '')),
  tva_intra    = coalesce(tva_intra,    nullif(brand_data->>'tva', '')),
  vat_regime   = case when brand_data->>'vatRegime' in ('normal','franchise')
                      then brand_data->>'vatRegime' else vat_regime end,
  legal_form   = coalesce(legal_form,   nullif(brand_data->>'legalForm','')),
  rcs          = coalesce(rcs,          nullif(brand_data->>'rcs','')),
  address_line = coalesce(address_line, nullif(brand_data->>'address','')),
  city         = coalesce(city,         nullif(brand_data->>'city','')),
  iban         = coalesce(iban,         nullif(replace(brand_data->>'iban',' ',''),'')),
  bic          = coalesce(bic,          nullif(brand_data->>'bic',''))
where brand_data is not null;
```

> Note importante : les drafts ci-dessus sont **indicatifs**. Avant
> exécution réelle il faudra (a) revoir le check constraint
> `pa_lifecycle_status` selon les valeurs exactes émises par chaque PA,
> (b) tester le backfill `siret`/`siren` sur un dump puisque la colonne
> generated peut bloquer si une valeur existante n'a pas exactement 14
> caractères, (c) coordonner avec la couche `src/lib/api.js` qui lit
> aujourd'hui `brand_data` directement.

---

## 6. Verdict

### Go / no-go

**Go.** Le terrain est largement préparé : Factur-X profil EN 16931 déjà
émis, table `invoices` avec verrouillage fiscal, soft-delete et
journalisation, table `b2b_accounts` qui sert de prototype pour le
multi-provider, RPC `next_invoice_number` et `create_avoir_from`
robustes. La migration vers Super PDP (+ Iopole en backup) est
réaliste et **cadrée par 4 migrations SQL** (drafts §5).

### Effort par poste

| Poste | Effort | Justification |
|---|---|---|
| Schéma SQL (4 migrations 0039-0042) | **M** | Drafts prêts ; risque principal = backfill `siret` strict 14 chars + transition `b2b_accounts → pa_accounts` sans casser le flux B2Brouter actif |
| Module `einvoicing-provider` (façade + 2 adapters Super PDP / Iopole) | **L** | Spec d'API PA à valider (prod docs des 2 providers), refonte de la sérialisation `invoice → payload PA`, gestion fallback Iopole quand Super PDP est down (timeout, retry, journaling), parser webhook par provider |
| API Vercel — fusion `b2brouter.js → einvoicing.js` + rewrites | **S** | Patron déjà établi (cf `api/b2brouter.js` qui route action vs webhook par header) ; reste à généraliser le switch provider et préserver les URL externes via `vercel.json` |
| UI — bouton unique « Émettre & transmettre », écran de configuration PA, suivi cycle de vie | **M** | Composant `InvoiceDetail.jsx` à étoffer, écran `Onboarding`/`Account` à enrichir pour `registerAccount`, badge statut PA dans `InvoicesList.jsx` ; pas de refonte structurelle du store |
| Tests | **M** | Vitest déjà en place (cf `*.test.js`) ; couvrir la sérialisation invoice→payload PA, le parser webhook par provider, le fallback Super PDP→Iopole, et au moins un scénario E2E avec un mock |
| Docs (CLAUDE.md, DEPLOIEMENT.md, vars d'env) | **S** | Ajouter section dédiée + nouvelles env vars (`SUPERPDP_*`, `IOPOLE_*`, `EINVOICING_DEFAULT_PROVIDER`) |

**Effort agrégé** : ~M+ (8 à 14 jours selon la qualité des SDK PA).

### Risques bloquants

1. **Plafond 12 fonctions Vercel** atteint à 10/12. La fusion
   `b2brouter.js → einvoicing.js` doit être faite **en 1 PR** (remplacement,
   pas ajout). Sinon, créer un nouveau fichier dédié PA fait passer à 11/12
   et grignote le dernier slot.
2. **Schéma typé vs `brand_data` jsonb** : aujourd'hui le code Factur-X
   lit `brand_data` directement. La migration 0042 doit être suivie d'une
   passe sur `src/lib/facturx.js` et `api/facturx.js` pour préférer les
   colonnes typées. À défaut on se retrouve avec une DB schizophrène.
3. **Données client incomplètes** : `clients.country_code`,
   `clients.buyer_reference`, l'identifiant Chorus Pro et la résolution
   PA via SIREN (annuaire PPF) sont absents. Sans annuaire PPF il est
   impossible de garantir l'adressage. La couche `lookupRecipient`
   doit s'inscrire **avant** le bouton « Émettre ».
4. **Statuts métier B2Brouter vs PA** : `mapStatus` actuel
   (`api/b2brouter.js:83`) collapse en 5 valeurs. La PA fournit un
   cycle plus riche (PPF 226 statuts). Garder la table `invoices.statut`
   simplifiée pour l'UI mais journaliser les events bruts dans
   `invoice_pa_events` (migration 0041) sinon on perd l'audit fiscal.
5. **PDF/A-3 stricte** : le code charge `public/icc/sRGB.icc` si présent
   sinon "skip". Pour la PA, l'OutputIntent sRGB n'est pas optionnel —
   un validateur PA peut rejeter. Vérifier que `public/icc/sRGB.icc`
   existe en prod et durcir le `skip` en `error` une fois la transition
   PA effectuée.
6. **Coût Vercel Hobby** : un trafic PA significatif (webhooks
   bidirectionnels, polling statut) peut faire exploser les invocations
   serverless. Prévoir un upgrade Pro avant 09/2027.
7. **Pas de versioning du XML émis** : aujourd'hui on régénère le PDF/XML à
   la volée à chaque clic Factur-X. Pour la conformité légale (10 ans,
   art. L102 B LPF), il faut **persister** le PDF/A-3 et l'XML transmis à la
   PA dans le bucket Storage, avec hash + horodatage. Aujourd'hui
   `pdf_path` existe sur `invoices` mais le téléchargement Factur-X actuel
   ne l'upload pas — uniquement download local navigateur.

### Coups gagnants quick-wins (<½ journée)

- Persister le PDF/A-3 + XML dans `Storage` + hash dans
  `invoices.pdf_path`/nouvelle col `xml_path` au moment du clic
  « Émettre ». Sans ça, l'archive légale est fragile.
- Exposer la mention « identifiant PA destinataire » dans la fiche
  client (`ClientDetail.jsx`) et dans `lookupRecipient`.
- Ajouter une colonne `country_code` sur `clients` (1 ligne SQL) et
  arrêter le hardcode `FR` côté `facturx.js`.

---

## 7. Questions pour Dursun

1. **Stack annoncée vs réelle** : le brief parle de PWA single-file +
   Cloudflare Worker. Le repo est React/Vite + Vercel. C'est une simple
   confusion ou y a-t-il un autre dépôt « chantigest-pro » que je n'ai
   pas vu ? Confirme que l'audit doit porter sur **ce** repo Zenbat.

2. **Choix Super PDP** : tu as un compte sandbox Super PDP ? J'ai besoin
   de la doc API (endpoints `register`, `send`, `status`, format
   webhook, schéma de signature) pour coder l'adapter. Idem Iopole.
   Sans ces docs, je peux faire la façade et le routing mais pas
   l'adapter implémenté — sauf à utiliser un mock.

3. **Sort de B2Brouter** : on garde l'adapter B2Brouter comme 3e provider
   (utile pour les artisans déjà connectés) ou on le **drop** dans un
   second temps après bascule complète vers Super PDP/Iopole ? La
   réponse change le draft de migration 0040 (drop ou garde
   `b2b_accounts`).

4. **Annuaire PPF / résolution destinataire** : la PA expose-t-elle un
   service `lookupRecipient(siren) → recipient_id` côté Super PDP, ou
   faut-il interroger directement l'annuaire PPF officiel ? Le mode de
   souscription change l'UX (synchrone à la création client vs résolu
   au moment de l'émission).

5. **Format facture transmise** : Super PDP attend du **Factur-X
   PDF/A-3** ou du **UBL/CII pur XML** ? Le code actuel produit
   PDF/A-3 ; si la PA veut du XML pur on peut juste extraire le XML
   embarqué, mais ça demande de tracer l'écart côté tests.

6. **Mode multi-provider** : un artisan peut-il avoir **2 comptes PA
   simultanés** (Super PDP en prod + Iopole en backup actif) ou bien
   c'est failover (Iopole activé seulement si Super PDP down) ? Cela
   conditionne le check `unique (owner_id, provider, environment)` du
   draft 0040.

7. **Migration B2Brouter → PA** : il y a déjà des factures émises avec
   `b2brouter_invoice_id` en prod ? Si oui, on les laisse cycle B2B en
   l'état (lecture seule statut) et on ne fait basculer que les
   nouvelles factures, ou bien on tente une réconciliation ?

8. **Archivage légal** : aujourd'hui le PDF/A-3 est téléchargé localement
   par l'artisan, **pas archivé Supabase Storage**. Tu valides qu'on
   ajoute la persistance auto dans `invoices.pdf_path` + nouvelle
   colonne `xml_path` lors de l'émission ? Sans ça la conformité 10 ans
   art. L102 B LPF repose sur le navigateur de l'artisan, ce qui est
   fragile.

9. **Particuliers (B2C)** : la réforme PA cible le B2B. Confirme que
   pour les clients `clients.type = 'particulier'` le flux reste « PDF/A-3
   téléchargé local » et **n'appelle pas** la PA. Sinon il faut un
   garde-fou explicite dans `sendInvoice`.

10. **Forme juridique / RCS / capital** : aujourd'hui dans `brand_data`
    jsonb (texte libre). Pour la migration 0042, est-ce qu'on les
    promeut en colonnes typées (mon préférence) ou on garde le jsonb et
    on lit les valeurs dynamiquement ? La 1re option est plus propre
    mais demande du backfill.
