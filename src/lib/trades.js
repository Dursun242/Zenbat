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

// ─────────────────────────────────────────────────────────────────────
// Exemples de PREMIER devis pour amorcer l'Agent IA sans friction.
// Utilisé comme suggestion cliquable sur un chat vierge : le user peut
// générer un devis type d'un clic au lieu de faire face au champ blanc.
// Clé = label exact de ALL_TRADES. Fallback = secteur détecté.
// ─────────────────────────────────────────────────────────────────────
export const FIRST_DEVIS_EXAMPLE_BY_TRADE = {
  // BTP / Construction
  "Maçonnerie":                       "Pose dalle béton 20 m² + ferraillage",
  "Gros œuvre / Béton":               "Fondations + dalle béton 40 m² avec ferraillage",
  "Terrassement / VRD":               "Terrassement pour piscine 8×4 m + évacuation",
  "Charpente":                        "Charpente traditionnelle 80 m² + pose",
  "Couverture / Zinguerie":           "Réfection toiture 100 m² en tuiles mécaniques",
  "Étanchéité":                       "Étanchéité toit terrasse 60 m²",
  "Façade / Ravalement":              "Ravalement façade 120 m² avec échafaudage",
  "Isolation":                        "Isolation combles perdus 80 m² R=7",
  "Plâtrerie / Cloisons":             "Pose cloisons placo 40 m² + isolation phonique",
  "Menuiserie intérieure":            "Pose 5 portes intérieures + plinthes T3",
  "Menuiserie extérieure / Alu":      "Fourniture et pose 3 fenêtres alu double vitrage",
  "Serrurerie / Métallerie":          "Pose portail coulissant alu 3,5 m",
  "Plomberie":                        "Remplacement chauffe-eau 200L + raccordement",
  "Sanitaire / Salle de bain":        "Rénovation complète salle de bain 6 m²",
  "Chauffage / PAC":                  "Installation pompe à chaleur air/eau 10 kW",
  "Climatisation / VMC":              "VMC double flux maison 120 m²",
  "Électricité":                      "Tableau électrique neuf 2 rangées + mise aux normes",
  "Domotique":                        "Installation domotique 5 zones + centrale",
  "Peinture / Décoration":            "Peinture murs + plafonds T3 65 m²",
  "Carrelage / Faïence":              "Pose carrelage 40 m² à 25 €/m² fourniture incluse",
  "Sols souples / Parquet":           "Pose parquet flottant 50 m² + plinthes",
  "Vitrerie / Miroiterie":            "Remplacement 4 vitrages double 24 mm",
  "Cuisine / Agencement":             "Cuisine équipée sur-mesure 10 ml + pose",
  "Piscine / Spa":                    "Construction piscine coque 7×3,5 m livrée posée",
  "Paysagiste / Espaces verts":       "Création jardin 200 m² + gazon + plantations",
  "Démolition / Désamiantage":        "Démolition cloisons + évacuation gravats forfait",
  "Maîtrise d'œuvre":                 "Mission MOE complète maison individuelle 120 m²",
  "Bureau d'études":                  "Étude structure maison R+1 + plans exécution",
  "Architecture":                     "Projet d'architecte + permis de construire 150 m²",
  // Artisanat alimentaire
  "Boulangerie / Pâtisserie":         "Buffet sucré 50 personnes (viennoiseries + mignardises)",
  "Boucherie / Charcuterie":          "Plateau apéritif charcuterie 20 personnes",
  "Traiteur":                         "Buffet cocktail 80 personnes à 35 €/pers",
  "Restauration":                     "Menu mariage 100 couverts à 65 €/pers",
  "Chocolatier / Confiseur":          "Coffret chocolats événement pro × 50",
  "Glacier":                          "Buffet glaces événement 80 pers",
  "Cave / Sommellerie":               "Sélection vins événement 50 pers",
  // Beauté / Bien-être
  "Coiffure":                         "Coupe + couleur + brushing femme × 3",
  "Barbier":                          "Prestation barbier événement 10 clients",
  "Esthétique / Beauté":              "Soin visage anti-âge + épilation complète",
  "Onglerie":                         "Pose ongles gel French + soin × 5 clientes",
  "Maquillage":                       "Maquillage mariée + essai préalable",
  "Massage / Bien-être":              "Massage relaxant 1h × 5 séances",
  "Tatouage / Piercing":              "Tatouage bras 3 séances 2h",
  // Santé / Paramédical
  "Kinésithérapie":                   "Séries de 10 séances kiné + bilan",
  "Ostéopathie":                      "3 séances d'ostéopathie + bilan postural",
  "Naturopathie":                     "Bilan naturopathique complet + suivi 3 mois",
  "Diététique / Nutrition":           "Suivi nutritionnel 3 mois (5 RDV)",
  "Coach sportif / Personal trainer": "Coaching sportif 10 séances à domicile",
  "Psychologie / Coaching":           "Accompagnement coaching 6 séances",
  "Opticien":                         "Monture + 2 verres progressifs antireflet",
  "Audioprothésiste":                 "Appareil auditif bilatéral + suivi 1 an",
  // Mode / Textile
  "Couture / Retouche":               "Retouche robe de soirée + ourlet 2 pantalons",
  "Maroquinerie":                     "Sac sur-mesure cuir + monogramme",
  "Cordonnerie":                      "Remplacement semelles + talons 3 paires",
  "Teinturerie / Pressing":           "Pressing tapis persan 3×4 m",
  // Auto / Moto / Transport
  "Mécanique automobile":             "Révision complète + vidange + freins",
  "Carrosserie / Peinture auto":      "Débosselage + peinture aile avant",
  "Vitrage auto":                     "Remplacement pare-brise + calibrage caméras",
  "Réparation moto / Vélo":           "Révision moto 10 000 km + pneus",
  "Déménagement":                     "Déménagement T3 Paris → Lyon 35 m³",
  "Transport / Livraison":            "Tournée livraison 50 colis jour × 5 jours",
  "Chauffeur VTC / Taxi":             "Transfert aéroport + attente 2h",
  // Tech / Numérique
  "Développement web / Mobile":       "Site vitrine 5 pages + formulaire contact",
  "Informatique / Réseaux":           "Installation réseau pro 10 postes + wifi",
  "Cybersécurité":                    "Audit cybersécurité entreprise 20 postes",
  "Graphisme / Design":               "Logo + charte graphique + 3 déclinaisons",
  "UX / UI Design":                   "Refonte UX app mobile 8 écrans",
  "Référencement SEO / SEA":          "Audit SEO + optimisation 10 pages + backlinks",
  "Community management":             "Gestion réseaux sociaux 3 mois 3 posts/sem",
  "Création de contenu":              "10 articles de blog optimisés SEO",
  "Développement logiciel":           "Développement module sur-mesure 15 j-h",
  // Communication / Créatif
  "Photographie":                     "Reportage mariage demi-journée + retouches",
  "Vidéographie / Montage":           "Clip promotionnel 2 min + montage",
  "Drone / Aerial":                   "Prise de vue drone 4K événement 2h",
  "Rédaction web / Copywriting":      "Rédaction 5 articles 800 mots optimisés",
  "Traduction / Interprétariat":      "Traduction site web 10 pages FR → EN",
  "Illustration / BD":                "Série 10 illustrations originales format A3",
  "Impression / Signalétique":        "Enseigne lumineuse 2×1 m + pose",
  "Publicité / Marketing":            "Campagne Google Ads 3 mois + reporting",
  // Événementiel / Animation
  "Organisation d'événements":        "Organisation séminaire 50 pers 2 jours",
  "DJ / Animation musicale":          "DJ soirée mariage 6h + sono + lumières",
  "Traiteur événementiel":            "Cocktail dînatoire 100 personnes",
  "Décoration événementielle":        "Décoration salle mariage 120 invités",
  "Son / Lumière / Scène":            "Sono + lumières concert 300 pers",
  // Animaux
  "Toilettage animal":                "Toilettage complet golden retriever × 3",
  "Vétérinaire":                      "Consultation + vaccins annuels chien",
  "Dog-sitting / Pet-sitting":        "Garde chien 10 jours à domicile",
  "Dressage / Éducation canine":      "Éducation canine 8 séances individuelles",
  // Immobilier / Finance
  "Agent immobilier":                 "Mandat vente maison + photos + home staging",
  "Gestionnaire de patrimoine":       "Bilan patrimonial complet + recommandations",
  "Comptabilité / Expertise comptable":"Tenue comptable TPE 1 an + bilan",
  "Juridique / Conseil":              "Rédaction statuts SAS + formalités création",
  // Enseignement / Formation
  "Cours particuliers":               "20 heures de cours particuliers maths",
  "Formation professionnelle":        "Formation 2 jours bureautique 8 participants",
  "Auto-école":                       "Forfait permis B 20h + code illimité",
  // Nettoyage / Entretien
  "Nettoyage / Entretien":            "Nettoyage bureaux 200 m² × 3 passages/sem",
  "Pressing / Blanchisserie":         "Entretien linge hôtel 500 kg/mois",
  "Ramonage / Entretien cheminée":    "Ramonage annuel + contrôle conduit",
  "Désinfection / Dératisation":      "Dératisation locaux 300 m² + suivi 6 mois",
  // Divers
  "Horlogerie / Bijouterie":          "Révision montre automatique + polissage",
  "Réparation électronique":          "Réparation écran smartphone haut de gamme",
  "Réparation appareils ménagers":    "Diagnostic + réparation lave-vaisselle",
  "Menuiserie / Ébénisterie":         "Meuble bibliothèque sur-mesure chêne 3 m",
  "Tapisserie / Décoration":          "Réfection fauteuil Voltaire + tissu",
}

// Fallback par secteur quand le label exact n'est pas mappé (métier libre
// tapé par l'utilisateur). Reprend les 13 secteurs de SECTOR_KEYWORDS.
const FALLBACK_BY_SECTOR_KEYWORDS = [
  { re: /ma[çc]onnerie|plomberie|[ée]lectricit[ée]|charpente|couverture|isolation|carrelage|peinture|menuiserie|fa[çc]ade|[ée]tanch|terrassement|gros ?œuvre|chauffage|climatisation|serrurerie|vitrerie|piscine|paysagiste|d[ée]molition|domotique|sanitaire|architecture|vrd|b[ée]ton/i,
    example: "Pose carrelage 40 m² à 25 €/m² fourniture incluse" },
  { re: /coiffure|barbier|esth[ée]tique|onglerie|maquillage|massage|tatouage|piercing|bien.?[êe]tre/i,
    example: "Coupe + couleur + brushing femme × 3" },
  { re: /kin[ée]|ost[ée]|naturopath|di[ée]t[ée]|coach|psycholog|opticien|audioproth|nutrition/i,
    example: "3 séances individuelles + bilan initial" },
  { re: /d[ée]veloppement|informatique|cybers|graphisme|ux|ui|seo|sea|community|contenu|logiciel|r[ée]seaux/i,
    example: "Site vitrine 5 pages + formulaire contact" },
  { re: /boulangerie|p[âa]tisserie|boucherie|charcuterie|traiteur|restauration|chocolatier|glacier|cave/i,
    example: "Buffet cocktail 50 personnes à 30 €/pers" },
  { re: /m[ée]canique|carrosserie|vitrage auto|moto|v[ée]lo|d[ée]m[ée]nagement|transport|livraison|vtc|taxi/i,
    example: "Révision complète + vidange + freins" },
  { re: /photograph|vid[ée]o|drone|r[ée]daction|copywrit|traduction|illustration|impression|signal[ée]tique|publicit[ée]|marketing/i,
    example: "Reportage photo demi-journée + retouches" },
  { re: /[ée]v[ée]nement|dj|animation musicale|d[ée]coration|son|lumi[èe]re|sc[èe]ne/i,
    example: "DJ soirée 6h + sono + lumières" },
  { re: /cours|formation|auto.?[ée]cole|enseignement/i,
    example: "10 heures de cours particuliers" },
  { re: /nettoyage|pressing|blanchisserie|ramonage|d[ée]sinfection|d[ée]ratisation/i,
    example: "Nettoyage bureaux 200 m² × 3 passages/sem" },
  { re: /toilettage|v[ée]t[ée]rinaire|dog.?sitting|pet.?sitting|dressage|canine/i,
    example: "Toilettage complet chien × 3 séances" },
  { re: /immobilier|patrimoine|comptab|juridique|conseil/i,
    example: "Bilan comptable TPE 1 an + déclarations" },
  { re: /couture|retouche|maroquinerie|cordonnerie|teinturerie/i,
    example: "Retouches 5 pièces + ourlets" },
]

// Renvoie un exemple de prompt à montrer à l'utilisateur au premier tour,
// adapté à ses métiers déclarés. Ordre : label exact → secteur détecté →
// exemple générique.
export const firstDevisExampleFor = (trades = []) => {
  const labels = tradesLabels(trades)
  for (const l of labels) {
    if (FIRST_DEVIS_EXAMPLE_BY_TRADE[l]) return FIRST_DEVIS_EXAMPLE_BY_TRADE[l]
  }
  const text = labels.join(" ")
  for (const { re, example } of FALLBACK_BY_SECTOR_KEYWORDS) {
    if (re.test(text)) return example
  }
  return "Prestation 2 h × 60 €/h + fourniture matériel forfait 120 €"
}
