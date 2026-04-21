export const CLAUDE_MODEL = import.meta.env.VITE_CLAUDE_MODEL || "claude-sonnet-4-20250514";

export const UNITES = ["m2", "ml", "u", "m3", "ft", "ens", "h", "j"];
export const TVA_RATES = [20, 10, 5.5];

// ── Statuts devis ─────────────────────────────────────────
export const STATUT = {
  brouillon:    { label: "Brouillon",    bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" },
  envoye:       { label: "Envoyé",       bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6" },
  en_signature: { label: "En signature", bg: "#fffbeb", color: "#b45309", dot: "#f59e0b" },
  accepte:      { label: "Accepté",      bg: "#ecfdf5", color: "#065f46", dot: "#10b981" },
  refuse:       { label: "Refusé",       bg: "#fef2f2", color: "#991b1b", dot: "#ef4444" },
};

// ── Marque par défaut ─────────────────────────────────────
export const DEFAULT_BRAND = {
  companyName: "", logo: null, siret: "", tva: "",
  address: "", city: "", phone: "", email: "", website: "",
  color: "#22c55e", fontStyle: "modern",
  mentionsLegales: "", rib: "", iban: "", bic: "",
  paymentTerms: "Acompte 30% à la commande, solde à réception.",
  validityDays: 30,
  trades: [],
};

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
  { id: "l2", type_ligne: "ouvrage", designation: "Dépose carrelage",    lot: "Démolition",  unite: "m2", quantite: 24, prix_unitaire: 18   },
  { id: "l3", type_ligne: "ouvrage", designation: "Évacuation gravats",  lot: "Démolition",  unite: "ft", quantite: 1,  prix_unitaire: 320  },
  { id: "l4", type_ligne: "lot",     designation: "REVÊTEMENTS",         lot: ""             },
  { id: "l5", type_ligne: "ouvrage", designation: "Carrelage grès cérame", lot: "Revêtements", unite: "m2", quantite: 24, prix_unitaire: 55 },
  { id: "l6", type_ligne: "ouvrage", designation: "Faïence murale",      lot: "Revêtements", unite: "m2", quantite: 18, prix_unitaire: 48  },
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
  aiDesc:          "Décrivez les travaux, je génère le devis",
  signedCA:        "CA signé HT",
  inProgress:      "En cours",
  accepted:        "Acceptés",
  saveQuote:       "✓ Enregistrer le devis",
  clearQuote:      "🗑 Effacer",
  inputPlaceholder:"Décris les travaux dans ta langue — réponse en français",
  inputHint:       "Entrée pour envoyer · les lignes s'ajoutent en direct",
  agentGreeting:   "Bonjour 👋 Décrivez-moi les travaux ligne par ligne, dans la langue de votre choix (français, arabe, darija, espagnol, anglais, portugais…). Je rédige systématiquement le devis en français professionnel.\n\nEx : *Pose carrelage 25€/m² pour 40m², fourniture carrelage 18€/m²*",
  errNetwork:      "Pas de connexion internet. Vérifiez votre réseau et réessayez.",
  errApi:          "L'assistant IA ne répond pas. Réessayez dans quelques secondes.",
  errGeneral:      "Quelque chose s'est mal passé. Réessayez.",
  quoteInProgress: "Devis en cours",
  linesAdded:      "Lignes ajoutées au devis ✓",
  quoteSaved:      "✅ Devis enregistré ! Retrouvez-le dans l'onglet Devis.\n\nNouvel autre chantier ?",
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
