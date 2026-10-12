export const CLAUDE_MODEL = import.meta.env.VITE_CLAUDE_MODEL || "claude-haiku-4-5-20251001";

// Valeurs canoniques des unités (alignées avec les sorties IA)
export const UNITES = [
  // Surface & dimensions (BTP, nettoyage, paysage…)
  { value: "m²",      label: "m² — surface" },
  { value: "ml",      label: "ml — mètre linéaire" },
  { value: "m³",      label: "m³ — volume / cubage" },
  // Quantités génériques
  { value: "u",       label: "u — unité / pièce" },
  { value: "pièce",   label: "pièce" },
  { value: "lot",     label: "lot" },
  { value: "ens",     label: "ens — ensemble" },
  { value: "forfait", label: "forfait" },
  // Masse (alimentaire, chimie, agriculture…)
  { value: "kg",      label: "kg — kilogramme" },
  { value: "g",       label: "g — gramme" },
  { value: "t",       label: "t — tonne" },
  // Volume liquide (alimentaire, plomberie…)
  { value: "L",       label: "L — litre" },
  { value: "cl",      label: "cl — centilitre" },
  // Temps (services, tech, santé, formation…)
  { value: "min",     label: "min — minute" },
  { value: "h",       label: "h — heure" },
  { value: "j",       label: "j — jour / homme" },
  { value: "sem",     label: "sem — semaine" },
  { value: "mois",    label: "mois" },
  { value: "session", label: "session" },
  { value: "séance",  label: "séance" },
  // Personnes (traiteur, événementiel, formation…)
  { value: "pers",    label: "pers — personne" },
  { value: "part",    label: "part — portion" },
  // Distance & transport
  { value: "km",      label: "km — kilomètre" },
  // Divers
  { value: "ft",      label: "ft — pied (impérial)" },
];

// Aliases pour rétrocompatibilité avec les anciennes valeurs ASCII stockées en base
export const UNITE_ALIASES = { m2: "m²", m3: "m³" };
export const TVA_RATES = [20, 10, 5.5, 2.1, 0];

// ── Statuts devis ─────────────────────────────────────────
// Libellé + ton (jeton ZB de src/lib/theme.js) : encre pour ce qui attend,
// vert tampon pour ce qui est acquis, rouge pour un refus (cf. DESIGN.md).
export const STATUT = {
  brouillon:      { label: "Brouillon",               tone: "ink3" },
  envoye:         { label: "Envoyé",                  tone: "ink2" },
  en_signature:   { label: "À signer",                tone: "ink" },
  en_negociation: { label: "Modifications demandées", short: "Modifications", tone: "ink" },
  accepte:        { label: "Signé",                   tone: "stamp" },
  refuse:         { label: "Refusé",                  tone: "danger" },
  remplace:       { label: "Remplacé",                tone: "ink3" },
};

// ── Statuts factures ─────────────────────────────────────
export const STATUT_FACTURE = {
  brouillon: { label: "Brouillon", tone: "ink3" },
  envoyee:   { label: "Émise",     tone: "ink2" },
  recue:     { label: "Reçue",     tone: "ink2" },
  payee:     { label: "Payée",     tone: "stamp" },
  rejetee:   { label: "Rejetée",   tone: "danger" },
  annulee:   { label: "Annulée",   tone: "ink3" },
};

// ── Marque par défaut ─────────────────────────────────────
// Art. L441-10 et D441-5 du code de commerce (ventes entre professionnels).
export const PAYMENT_PENALTIES_TEXT = "Pénalités de retard : taux de refinancement de la BCE majoré de 10 points (art. L441-10 du code de commerce). Indemnité forfaitaire pour frais de recouvrement : 40 € (art. D441-5).";

export const DEFAULT_BRAND = {
  companyName: "", logo: null, siret: "", tva: "",
  firstName: "", lastName: "",
  vatRegime: "normal", // "normal" | "franchise" (auto-entrepreneur / art. 293 B)
  address: "", city: "", phone: "", email: "", website: "",
  color: "#22c55e", fontStyle: "modern",
  mentionsLegales: "", rib: "", iban: "", bic: "",
  paymentTerms: "Acompte 30% à la commande, solde à réception.",
  validityDays: 30,
  trades: [],
  // Mentions BTP obligatoires (décret n°2017-1809 + art. L111-1 code conso)
  // pour les devis de travaux > 150 € TTC, affichées sur le PDF des devis.
  devisGratuit: true,          // caractère gratuit du devis (ou payant)
  devisTarif:   "",            // tarif si devis payant (ex : "50 €")
  travelFees:   "",            // frais de déplacement (ex : "Gratuits dans un rayon de 30 km")
  // Mentions facture avancées (CGI art. 242 nonies A + C. com. L441-10)
  // Affichées sur tout PDF facture + devis si renseignées.
  legalForm:         "",       // forme juridique (SAS, SARL, EI, auto-entrepreneur, etc.)
  rcs:               "",       // "RCS Le Havre 123 456 789"
  capital:           "",       // capital social (libellé libre, ex : "10 000 €")
  paymentPenalties:  PAYMENT_PENALTIES_TEXT,
  escompte:          "Aucun escompte consenti pour paiement anticipé.",
};

export const FRANCHISE_MENTION = "TVA non applicable, art. 293 B du CGI";

// Texte d'avant octobre 2026, resté enregistré chez les artisans qui ne l'ont
// pas modifié : le taux cité était faux (L441-10 : taux BCE + 10 points).
const LEGACY_PAYMENT_PENALTIES = "Pénalités de retard : taux d'intérêt légal majoré de 10 points. Indemnité forfaitaire pour frais de recouvrement : 40 € (art. L441-10 code de commerce).";

// Mention des pénalités à imprimer : le texte de l'artisan, sauf l'ancien
// texte par défaut, remplacé par la version correcte.
export const paymentPenaltiesText = (brand) =>
  brand?.paymentPenalties === LEGACY_PAYMENT_PENALTIES ? PAYMENT_PENALTIES_TEXT : brand?.paymentPenalties || "";

export const DEFAULT_DEMO_BRAND = {
  ...DEFAULT_BRAND,
  companyName: "Maçonnerie Dupont SAS",
  city: "76600 Le Havre",
  phone: "02 35 12 34 56",
  email: "contact@dupont-maconnerie.fr",
  siret: "12345678900010",
  color: "#22c55e",
  fontStyle: "modern",
  paymentTerms: "Acompte 30% à la commande, solde à réception.",
  mentionsLegales: "Assurance décennale n°12345 — Garantie biennale incluse — TVA 20%",
  rib: "Crédit Mutuel Le Havre",
  iban: "FR76 1234 5678 9012 3456 7890 123",
  bic: "CMCIFRPP",
  validityDays: 30,
  trades: ["maconnerie", "gros_oeuvre", "carrelage", "platrerie", "peinture"],
};

// ── Données de démonstration (visibles avant connexion) ───
export const DEMO_CLIENTS = [
  { id: "c1", type: "entreprise",  raison_sociale: "Alcéane Bailleur Social", email: "contact@alceane.fr",   ville: "Le Havre" },
  { id: "c2", type: "entreprise",  raison_sociale: "Eiffage Construction",    email: "normandie@eiffage.fr", ville: "Rouen"    },
  { id: "c3", type: "particulier", nom: "Martin", prenom: "Sophie",           email: "s.martin@gmail.com",   ville: "Caen"     },
];

const DEMO_LIGNES = [
  { id: "l1", type_ligne: "lot",     designation: "DÉMOLITION",          lot: ""             },
  { id: "l2", type_ligne: "ouvrage", designation: "Dépose carrelage",    lot: "Démolition",  unite: "m²", quantite: 24, prix_unitaire: 18   },
  { id: "l3", type_ligne: "ouvrage", designation: "Évacuation gravats",  lot: "Démolition",  unite: "forfait", quantite: 1,  prix_unitaire: 320  },
  { id: "l4", type_ligne: "lot",     designation: "REVÊTEMENTS",         lot: ""             },
  { id: "l5", type_ligne: "ouvrage", designation: "Carrelage grès cérame", lot: "Revêtements", unite: "m²", quantite: 24, prix_unitaire: 55 },
  { id: "l6", type_ligne: "ouvrage", designation: "Faïence murale",      lot: "Revêtements", unite: "m²", quantite: 18, prix_unitaire: 48  },
  { id: "l7", type_ligne: "lot",     designation: "PLOMBERIE",           lot: ""             },
  { id: "l8", type_ligne: "ouvrage", designation: "WC suspendu complet", lot: "Plomberie",   unite: "u",  quantite: 1,  prix_unitaire: 650 },
  { id: "l9", type_ligne: "ouvrage", designation: "Douche italienne",    lot: "Plomberie",   unite: "u",  quantite: 1,  prix_unitaire: 1200 },
];

const ht0 = DEMO_LIGNES.filter(l => l.type_ligne === "ouvrage")
  .reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);

export const DEMO_DEVIS = [
  { id: "d1", numero: "DEV-2026-0001", objet: "Réhabilitation Résidence Marceau",  client_id: "c1", ville_chantier: "Le Havre", statut: "en_signature", montant_ht: 142500, date_emission: "2026-04-01", lignes: []         },
  { id: "d2", numero: "DEV-2026-0002", objet: "Rénovation salle de bain T3",       client_id: "c3", ville_chantier: "Caen",     statut: "accepte",      montant_ht: ht0,    date_emission: "2026-03-15", lignes: DEMO_LIGNES },
  { id: "d3", numero: "DEV-2026-0003", objet: "Extension maison individuelle",     client_id: "c2", ville_chantier: "Rouen",    statut: "brouillon",    montant_ht: 67200,  date_emission: "2026-04-10", lignes: []         },
];

// ── Textes UI (i18n FR) ────────────────────────────────────
export const TX = {
  dashboard:       "Accueil",
  clients:         "Clients",
  devis:           "Devis",
  agent:           "Agent IA",
  recentQuotes:    "Devis récents",
  seeAll:          "Voir tout →",
  aiAgent:         "Agent IA — Créer un devis",
  aiDesc:          "Décris ton besoin, je génère le devis",
  signedCA:        "CA accepté HT",
  inProgress:      "En cours",
  accepted:        "Acceptés",
  saveQuote:       "Enregistrer le devis",
  clearQuote:      "Tout effacer",
  inputPlaceholder:"Décris tes travaux, dans ta langue…",
  inputHint:       "Entrée pour envoyer · les lignes s'ajoutent en direct",
  agentGreeting:   "Bonjour. Décris ton besoin — toutes langues acceptées, devis rédigé en français.",
  errNetwork:      "Pas de connexion internet. Vérifie ton réseau et réessaie.",
  errApi:          "L'assistant ne répond pas. Réessaie dans quelques secondes.",
  errGeneral:      "Quelque chose s'est mal passé. Réessaie.",
  quoteInProgress: "Devis en cours",
  linesAdded:      "Lignes ajoutées au devis.",
  quoteSaved:      "Devis enregistré : tu le retrouves dans l'onglet Devis. On en commence un autre ?",
  pickClientTitle: "À quel client associer ce devis ?",
  pickClientHint:  "Choisissez un client existant, créez-en un rapidement ou enregistrez sans client.",
  searchClient:    "Rechercher un client…",
  noClientOpt:     "Enregistrer sans client",
  newClientInline: "+ Nouveau client",
  newClientName:   "Nom du client",
  newClientEmail:  "Email (recommandé pour la signature)",
  newClientPhone:  "Téléphone",
  confirmPick:     "Associer et enregistrer",
  cancel:          "Annuler",
  noClientsYet:    "Aucun client pour l'instant. Créez-en un ou enregistrez sans client.",
};
