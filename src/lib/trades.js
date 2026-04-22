// Liste étendue couvrant BTP, artisanat, services, tech, santé, etc.
export const ALL_TRADES = [
  // BTP / Construction
  "Architecture",
  "Maçonnerie",
  "Gros œuvre / Béton",
  "Terrassement / VRD",
  "Charpente",
  "Couverture / Zinguerie",
  "Étanchéité",
  "Façade / Ravalement",
  "Isolation",
  "Plâtrerie / Cloisons",
  "Menuiserie intérieure",
  "Menuiserie extérieure / Alu",
  "Serrurerie / Métallerie",
  "Plomberie",
  "Sanitaire / Salle de bain",
  "Chauffage / PAC",
  "Climatisation / VMC",
  "Électricité",
  "Domotique",
  "Peinture / Décoration",
  "Carrelage / Faïence",
  "Sols souples / Parquet",
  "Vitrerie / Miroiterie",
  "Cuisine / Agencement",
  "Piscine / Spa",
  "Paysagiste / Espaces verts",
  "Démolition / Désamiantage",
  "Maîtrise d'œuvre",
  "Bureau d'études",
  // Artisanat alimentaire
  "Boulangerie / Pâtisserie",
  "Boucherie / Charcuterie",
  "Traiteur",
  "Restauration",
  "Chocolatier / Confiseur",
  "Glacier",
  "Cave / Sommellerie",
  // Beauté / Bien-être
  "Coiffure",
  "Barbier",
  "Esthétique / Beauté",
  "Onglerie",
  "Maquillage",
  "Massage / Bien-être",
  "Tatouage / Piercing",
  // Santé / Paramédical
  "Kinésithérapie",
  "Ostéopathie",
  "Naturopathie",
  "Diététique / Nutrition",
  "Coach sportif / Personal trainer",
  "Psychologie / Coaching",
  "Opticien",
  "Audioprothésiste",
  // Mode / Textile
  "Couture / Retouche",
  "Maroquinerie",
  "Cordonnerie",
  "Teinturerie / Pressing",
  // Auto / Moto / Transport
  "Mécanique automobile",
  "Carrosserie / Peinture auto",
  "Vitrage auto",
  "Réparation moto / Vélo",
  "Déménagement",
  "Transport / Livraison",
  "Chauffeur VTC / Taxi",
  // Tech / Numérique
  "Développement web / Mobile",
  "Informatique / Réseaux",
  "Cybersécurité",
  "Graphisme / Design",
  "UX / UI Design",
  "Référencement SEO / SEA",
  "Community management",
  "Création de contenu",
  "Développement logiciel",
  // Communication / Créatif
  "Photographie",
  "Vidéographie / Montage",
  "Drone / Aerial",
  "Rédaction web / Copywriting",
  "Traduction / Interprétariat",
  "Illustration / BD",
  "Impression / Signalétique",
  "Publicité / Marketing",
  // Événementiel / Animation
  "Organisation d'événements",
  "DJ / Animation musicale",
  "Traiteur événementiel",
  "Décoration événementielle",
  "Son / Lumière / Scène",
  // Animaux
  "Toilettage animal",
  "Vétérinaire",
  "Dog-sitting / Pet-sitting",
  "Dressage / Éducation canine",
  // Immobilier / Finance
  "Agent immobilier",
  "Gestionnaire de patrimoine",
  "Comptabilité / Expertise comptable",
  "Juridique / Conseil",
  // Enseignement / Formation
  "Cours particuliers",
  "Formation professionnelle",
  "Auto-école",
  // Nettoyage / Entretien
  "Nettoyage / Entretien",
  "Pressing / Blanchisserie",
  "Ramonage / Entretien cheminée",
  "Désinfection / Dératisation",
  // Divers
  "Horlogerie / Bijouterie",
  "Réparation électronique",
  "Réparation appareils ménagers",
  "Menuiserie / Ébénisterie",
  "Tapisserie / Décoration",
]

// Normalise une chaîne : minuscules + supprime les accents
const normalize = s =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

// Cherche dans la liste étendue avec tolérance aux accents
export const searchTrades = (query) => {
  if (!query.trim()) return []
  const q = normalize(query)
  return ALL_TRADES.filter(t => normalize(t).includes(q)).slice(0, 8)
}

// Rétrocompatibilité avec les anciens IDs BTP (ex: "maconnerie" → "Maçonnerie")
const LEGACY_ID_MAP = {
  architecture: "Architecture",
  ingenierie: "Bureau d'études",
  moe: "Maîtrise d'œuvre",
  maconnerie: "Maçonnerie",
  gros_oeuvre: "Gros œuvre / Béton",
  terrassement: "Terrassement / VRD",
  charpente: "Charpente",
  couverture: "Couverture / Zinguerie",
  etancheite: "Étanchéité",
  facade: "Façade / Ravalement",
  isolation: "Isolation",
  platrerie: "Plâtrerie / Cloisons",
  menuiserie_int: "Menuiserie intérieure",
  menuiserie_ext: "Menuiserie extérieure / Alu",
  serrurerie: "Serrurerie / Métallerie",
  plomberie: "Plomberie",
  sanitaire: "Sanitaire / Salle de bain",
  chauffage: "Chauffage / PAC",
  climatisation: "Climatisation / VMC",
  electricite: "Électricité",
  domotique: "Domotique",
  peinture: "Peinture / Décoration",
  carrelage: "Carrelage / Faïence",
  sol_souple: "Sols souples / Parquet",
  vitrerie: "Vitrerie / Miroiterie",
  cuisine: "Cuisine / Agencement",
  piscine: "Piscine / Spa",
  paysagiste: "Paysagiste / Espaces verts",
  demolition: "Démolition / Désamiantage",
}

export const tradesLabels = (trades = []) =>
  trades.map(t => LEGACY_ID_MAP[t] ?? t).filter(Boolean)

// Quelques exemples à afficher dans le placeholder
export const TRADE_EXAMPLES = [
  "Électricité", "Plomberie", "Maçonnerie", "Coiffure",
  "Développement web", "Photographie", "Peinture", "Transport",
]

// Garde BTP_TRADES pour compatibilité avec d'éventuels imports existants
export const BTP_TRADES = Object.entries(LEGACY_ID_MAP).map(([id, label]) => ({ id, label }))
export const TRADE_SUGGESTIONS = ALL_TRADES
