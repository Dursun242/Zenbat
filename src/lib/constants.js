export const CLAUDE_MODEL = import.meta.env.VITE_CLAUDE_MODEL || "claude-haiku-4-5-20251001";

export const UNITES = ["m2", "ml", "u", "m3", "ft", "ens", "h", "j"];
export const TVA_RATES = [20, 10, 5.5];

// ── Statuts devis ─────────────────────────────────────────
export const STATUT = {
  brouillon:    { label: "Brouillon",    bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" },
  envoye:       { label: "Envoyé",       bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6" },
  en_signature: { label: "En signature", bg: "#fffbeb", color: "#b45309", dot: "#f59e0b" },
  accepte:      { label: "Accepté",      bg: "#ecfdf5", color: "#065f46", dot: "#10b981" },
  refuse:       { label: "Refusé",       bg: "#fef2f2", color: "#991b1b", dot: "#ef4444" },
  remplace:     { label: "Remplacé",     bg: "#f5f3ff", color: "#6b21a8", dot: "#a855f7" },
};

// ── Statuts factures électroniques (B2Brouter / DGFiP) ─────
export const STATUT_FACTURE = {
  brouillon: { label: "Brouillon", bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" },
  envoyee:   { label: "Envoyée",   bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6" },
  recue:     { label: "Reçue",     bg: "#ecfeff", color: "#0e7490", dot: "#06b6d4" },
  payee:     { label: "Payée",     bg: "#ecfdf5", color: "#065f46", dot: "#10b981" },
  rejetee:   { label: "Rejetée",   bg: "#fef2f2", color: "#991b1b", dot: "#ef4444" },
  annulee:   { label: "Annulée",   bg: "#f5f5f4", color: "#57534e", dot: "#a8a29e" },
};

// ── Marque par défaut ─────────────────────────────────────
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
  paymentPenalties:  "Pénalités de retard : taux d'intérêt légal majoré de 10 points. Indemnité forfaitaire pour frais de recouvrement : 40 € (art. L441-10 code de commerce).",
  escompte:          "Aucun escompte consenti pour paiement anticipé.",
};

export const FRANCHISE_MENTION = "TVA non applicable, art. 293 B du CGI";

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
  aiDesc:          "Décrivez votre besoin, je génère le devis",
  signedCA:        "CA accepté HT",
  inProgress:      "En cours",
  accepted:        "Acceptés",
  saveQuote:       "✓ Enregistrer le devis",
  clearQuote:      "🗑 Effacer",
  inputPlaceholder:"Décris ta demande dans ta langue — réponse en français",
  inputHint:       "Entrée pour envoyer · les lignes s'ajoutent en direct",
  agentGreeting:   "Bonjour 👋 Décrivez-moi votre besoin ligne par ligne, dans la langue de votre choix (français, arabe, darija, espagnol, anglais, portugais…). Je rédige systématiquement le devis en français professionnel.",
  errNetwork:      "Pas de connexion internet. Vérifiez votre réseau et réessayez.",
  errApi:          "L'assistant IA ne répond pas. Réessayez dans quelques secondes.",
  errGeneral:      "Quelque chose s'est mal passé. Réessayez.",
  quoteInProgress: "Devis en cours",
  linesAdded:      "Lignes ajoutées au devis ✓",
  quoteSaved:      "✅ Devis enregistré ! Retrouvez-le dans l'onglet Devis.\n\nNouvelle prestation ?",
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
