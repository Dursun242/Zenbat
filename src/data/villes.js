// 35 villes françaises ciblées pour le SEO local Zenbat.
// Chaque entrée alimente /villes (index) et /villes/:slug (page détaillée).
// Les métiers mis en avant reprennent les libellés exacts de src/lib/trades.js
// pour rester cohérent avec les fiches artisans existantes.

export const VILLES = [
  // ─────────── Île-de-France ───────────
  {
    slug: 'paris',
    nom: 'Paris',
    departement: '75',
    region: 'Île-de-France',
    population: 2102650,
    metiers: ['Plomberie', 'Électricité', 'Peinture / Décoration', 'Menuiserie intérieure', 'Maçonnerie', 'Carrelage / Faïence'],
    intro: "Paris concentre la plus forte demande d'artisans du bâtiment de France, avec un parc de plus d'un million de logements à entretenir et rénover. Les TPE qui interviennent intra-muros doivent répondre vite, avec des devis clairs, et facturer dans les délais pour rester rentables face à la pression des charges.",
    contexte: "Les chantiers parisiens cumulent les contraintes : accès difficile, copropriétés exigeantes, voisinage proche, délais courts. Un devis bien construit et envoyé en moins d'une heure fait souvent la différence pour décrocher l'affaire."
  },
  {
    slug: 'boulogne-billancourt',
    nom: 'Boulogne-Billancourt',
    departement: '92',
    region: 'Île-de-France',
    population: 121583,
    metiers: ['Électricité', 'Plomberie', 'Cuisine / Agencement', 'Menuiserie intérieure', 'Peinture / Décoration'],
    intro: "Boulogne-Billancourt rassemble des appartements haussmanniens et des programmes neufs récents. Les artisans y interviennent autant en rénovation patrimoniale qu'en aménagement contemporain.",
    contexte: "Le bassin attire une clientèle exigeante sur la qualité de présentation des devis. Les délais de paiement plus longs en B2B (sièges sociaux) imposent de relancer les factures sans tarder."
  },
  {
    slug: 'versailles',
    nom: 'Versailles',
    departement: '78',
    region: 'Île-de-France',
    population: 85416,
    metiers: ['Menuiserie intérieure', 'Peinture / Décoration', 'Plomberie', 'Couverture / Zinguerie', 'Maçonnerie'],
    intro: "Versailles mêle résidences anciennes classées, hôtels particuliers et pavillons. Les artisans qui maîtrisent les contraintes du bâti ancien y trouvent une demande régulière, notamment en ravalement et menuiserie sur mesure.",
    contexte: "Les chantiers en secteur sauvegardé exigent une documentation soignée. Les devis détaillés (matériaux, normes, garanties) rassurent les ABF et les copropriétés."
  },

  // ─────────── Auvergne-Rhône-Alpes ───────────
  {
    slug: 'lyon',
    nom: 'Lyon',
    departement: '69',
    region: 'Auvergne-Rhône-Alpes',
    population: 522969,
    metiers: ['Plomberie', 'Électricité', 'Maçonnerie', 'Charpente', 'Chauffage / PAC', 'Peinture / Décoration'],
    intro: "Lyon est le second pôle économique français pour le BTP. Entre rénovation des immeubles canuts de la Croix-Rousse et programmes neufs sur la Confluence, les artisans locaux ne manquent pas de chantiers.",
    contexte: "La demande est forte en rénovation énergétique (MaPrimeRénov', CEE). Les devis qui mentionnent clairement les aides éligibles convertissent mieux."
  },
  {
    slug: 'villeurbanne',
    nom: 'Villeurbanne',
    departement: '69',
    region: 'Auvergne-Rhône-Alpes',
    population: 152090,
    metiers: ['Plomberie', 'Électricité', 'Peinture / Décoration', 'Carrelage / Faïence', 'Menuiserie intérieure'],
    intro: "Villeurbanne, accolée à Lyon, conjugue immeubles anciens des Gratte-Ciel et résidences récentes. Les artisans qui couvrent Lyon-Villeurbanne mutualisent leurs déplacements pour gagner en rentabilité.",
    contexte: "Beaucoup de bailleurs sociaux et de syndics opèrent ici : maîtriser le formalisme des appels d'offres est un vrai plus."
  },
  {
    slug: 'grenoble',
    nom: 'Grenoble',
    departement: '38',
    region: 'Auvergne-Rhône-Alpes',
    population: 158454,
    metiers: ['Charpente', 'Couverture / Zinguerie', 'Isolation', 'Chauffage / PAC', 'Menuiserie extérieure / Alu'],
    intro: "Grenoble et sa cuvette imposent des standards élevés d'isolation thermique. Le climat continental, les hivers froids et les pics de pollution rendent la rénovation énergétique incontournable.",
    contexte: "Les artisans certifiés RGE captent la majorité des projets aidés. Le devis-type Zenbat permet de chiffrer rapidement les variantes (PAC, ITE, double-flux)."
  },
  {
    slug: 'saint-etienne',
    nom: 'Saint-Étienne',
    departement: '42',
    region: 'Auvergne-Rhône-Alpes',
    population: 173089,
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Plomberie', 'Électricité', 'Façade / Ravalement'],
    intro: "Saint-Étienne offre un parc immobilier accessible à rénover, attirant primo-accédants et investisseurs. La demande en travaux clés en main y est continue.",
    contexte: "Les chantiers de remise en état complète (achat-rénovation) sont nombreux. Un devis lisible par poste accélère la décision côté maître d'ouvrage."
  },
  {
    slug: 'annecy',
    nom: 'Annecy',
    departement: '74',
    region: 'Auvergne-Rhône-Alpes',
    population: 130721,
    metiers: ['Charpente', 'Couverture / Zinguerie', 'Menuiserie extérieure / Alu', 'Isolation', 'Paysagiste / Espaces verts'],
    intro: "Annecy et son lac concentrent une clientèle haut de gamme et un tourisme exigeant. Chalets, résidences secondaires et villas contemporaines tirent la demande.",
    contexte: "La saisonnalité (préparation été / hiver) demande de la souplesse de planning. Les devis chiffrés finement (variantes, sur-mesure) sont la norme."
  },

  // ─────────── Provence-Alpes-Côte d'Azur ───────────
  {
    slug: 'marseille',
    nom: 'Marseille',
    departement: '13',
    region: "Provence-Alpes-Côte d'Azur",
    population: 873076,
    metiers: ['Maçonnerie', 'Plomberie', 'Électricité', 'Peinture / Décoration', 'Climatisation / VMC', 'Façade / Ravalement'],
    intro: "Marseille présente un bâti ancien (3e arrondissement, Panier, Belle de Mai) qui demande des rénovations lourdes, et un littoral où la climatisation est devenue un standard.",
    contexte: "Le climat impose des matériaux résistant aux embruns et fortes chaleurs. Les artisans qui justifient ces choix dans le devis convertissent mieux."
  },
  {
    slug: 'nice',
    nom: 'Nice',
    departement: '06',
    region: "Provence-Alpes-Côte d'Azur",
    population: 342669,
    metiers: ['Climatisation / VMC', 'Peinture / Décoration', 'Plomberie', 'Carrelage / Faïence', 'Piscine / Spa'],
    intro: "Nice combine résidences haut de gamme et appartements touristiques. La pose et l'entretien de climatisations, piscines et terrasses tirent la demande toute l'année.",
    contexte: "Beaucoup de clients propriétaires non-résidents : les devis envoyés par mail avec signature électronique font gagner des semaines."
  },
  {
    slug: 'toulon',
    nom: 'Toulon',
    departement: '83',
    region: "Provence-Alpes-Côte d'Azur",
    population: 178745,
    metiers: ['Maçonnerie', 'Plomberie', 'Climatisation / VMC', 'Peinture / Décoration', 'Étanchéité'],
    intro: "Toulon mêle un centre ancien dense et des quartiers résidentiels en croissance. La rénovation des appartements et la mise aux normes électrique-plomberie sont des marchés porteurs.",
    contexte: "Le marché militaire et naval génère aussi des chantiers B2B aux exigences administratives strictes."
  },
  {
    slug: 'aix-en-provence',
    nom: 'Aix-en-Provence',
    departement: '13',
    region: "Provence-Alpes-Côte d'Azur",
    population: 147122,
    metiers: ['Maçonnerie', 'Peinture / Décoration', 'Piscine / Spa', 'Paysagiste / Espaces verts', 'Menuiserie intérieure'],
    intro: "Aix-en-Provence attire une clientèle premium pour ses bastides, mas et résidences contemporaines. La piscine, la pierre et la rénovation patrimoniale sont des piliers locaux.",
    contexte: "Les devis très visuels (photos, coupes, références) sont valorisés. La signature numérique évite les allers-retours sur les sites éloignés."
  },

  // ─────────── Occitanie ───────────
  {
    slug: 'toulouse',
    nom: 'Toulouse',
    departement: '31',
    region: 'Occitanie',
    population: 498003,
    metiers: ['Maçonnerie', 'Plomberie', 'Électricité', 'Charpente', 'Carrelage / Faïence', 'Peinture / Décoration'],
    intro: "Toulouse, ville rose en forte croissance démographique, voit son parc neuf et ancien se développer en parallèle. Les artisans qualifiés sont en tension permanente sur l'agglomération.",
    contexte: "La construction bois et la brique foraine restent des spécialités locales. Les délais courts entre demande et devis sont un critère décisif."
  },
  {
    slug: 'montpellier',
    nom: 'Montpellier',
    departement: '34',
    region: 'Occitanie',
    population: 295542,
    metiers: ['Climatisation / VMC', 'Plomberie', 'Électricité', 'Maçonnerie', 'Peinture / Décoration'],
    intro: "Montpellier voit sa population croître de 1 % par an. Les programmes neufs dominent, mais le centre médiéval impose aussi des chantiers de rénovation lourde sous contrainte patrimoniale.",
    contexte: "La climatisation est devenue indispensable : un poste qui doit apparaître clairement dans le devis. Les bailleurs étudiants génèrent des chantiers courts à fort volume."
  },
  {
    slug: 'nimes',
    nom: 'Nîmes',
    departement: '30',
    region: 'Occitanie',
    population: 148236,
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Plomberie', 'Peinture / Décoration', 'Climatisation / VMC'],
    intro: "Nîmes conjugue centre antique, faubourgs anciens et zones pavillonnaires. Les rénovations toiture, façade et climatisation occupent une grande partie du calendrier des artisans.",
    contexte: "Les épisodes cévenols imposent une vigilance étanchéité-toiture qui peut être valorisée dans le devis comme argument de pérennité."
  },

  // ─────────── Nouvelle-Aquitaine ───────────
  {
    slug: 'bordeaux',
    nom: 'Bordeaux',
    departement: '33',
    region: 'Nouvelle-Aquitaine',
    population: 261804,
    metiers: ['Maçonnerie', 'Menuiserie intérieure', 'Peinture / Décoration', 'Plomberie', 'Électricité', 'Couverture / Zinguerie'],
    intro: "Bordeaux et son patrimoine de pierre blonde attirent une demande continue de rénovation. Le marché de l'échoppe bordelaise est un sous-marché à part entière.",
    contexte: "Les chantiers en secteur UNESCO demandent une rigueur documentaire : un devis bien structuré accélère les autorisations."
  },
  {
    slug: 'pau',
    nom: 'Pau',
    departement: '64',
    region: 'Nouvelle-Aquitaine',
    population: 75665,
    metiers: ['Maçonnerie', 'Charpente', 'Couverture / Zinguerie', 'Isolation', 'Chauffage / PAC'],
    intro: "Pau et son piémont pyrénéen demandent des standards d'isolation poussés. La rénovation énergétique des maisons béarnaises est un marché stable.",
    contexte: "Les aides locales s'ajoutent souvent aux aides nationales : un artisan qui sait les chiffrer dans le devis fait la différence."
  },
  {
    slug: 'la-rochelle',
    nom: 'La Rochelle',
    departement: '17',
    region: 'Nouvelle-Aquitaine',
    population: 76810,
    metiers: ['Couverture / Zinguerie', 'Maçonnerie', 'Menuiserie extérieure / Alu', 'Peinture / Décoration', 'Étanchéité'],
    intro: "La Rochelle, ville maritime, impose des matériaux résistants aux embruns. Les volets, façades et toitures réclament des entretiens réguliers.",
    contexte: "L'activité touristique génère des chantiers courts en intersaison. Les devis prêts vite, c'est un client capté avant la haute saison."
  },

  // ─────────── Pays de la Loire ───────────
  {
    slug: 'nantes',
    nom: 'Nantes',
    departement: '44',
    region: 'Pays de la Loire',
    population: 320732,
    metiers: ['Maçonnerie', 'Charpente', 'Plomberie', 'Électricité', 'Menuiserie intérieure', 'Peinture / Décoration'],
    intro: "Nantes, en pleine expansion (+1 %/an), tire toute la filière BTP de l'Ouest. Les chantiers de réhabilitation des friches industrielles (Île de Nantes) côtoient les programmes pavillonnaires.",
    contexte: "Forte demande en construction bois et BBC. Les devis qui mettent en avant ces compétences se démarquent."
  },
  {
    slug: 'angers',
    nom: 'Angers',
    departement: '49',
    region: 'Pays de la Loire',
    population: 154508,
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Menuiserie intérieure', 'Plomberie', 'Électricité'],
    intro: "Angers, classée plusieurs fois ville la plus agréable de France, attire de nouveaux habitants. La rénovation des maisons de tuffeau et l'aménagement intérieur sont en demande.",
    contexte: "Les habitations en tuffeau exigent un savoir-faire spécifique : à valoriser explicitement dans le devis."
  },
  {
    slug: 'le-mans',
    nom: 'Le Mans',
    departement: '72',
    region: 'Pays de la Loire',
    population: 146105,
    metiers: ['Maçonnerie', 'Plomberie', 'Électricité', 'Peinture / Décoration', 'Carrelage / Faïence'],
    intro: "Le Mans offre un parc immobilier accessible, attirant primo-accédants et bailleurs. Les chantiers de remise en état courent toute l'année.",
    contexte: "Le tissu d'investisseurs locatifs apprécie les devis détaillés et envoyés rapidement."
  },

  // ─────────── Normandie ───────────
  {
    slug: 'rouen',
    nom: 'Rouen',
    departement: '76',
    region: 'Normandie',
    population: 114108,
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Menuiserie extérieure / Alu', 'Plomberie', 'Peinture / Décoration'],
    intro: "Rouen, capitale historique de la Normandie, présente un parc à colombages et de la pierre calcaire à entretenir. La rénovation patrimoniale y est un savoir-faire local.",
    contexte: "Les ABF sont actifs en centre-ville : la qualité du dossier devis-photos compte autant que le prix."
  },
  {
    slug: 'le-havre',
    nom: 'Le Havre',
    departement: '76',
    region: 'Normandie',
    population: 165830,
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Plomberie', 'Électricité', 'Isolation'],
    intro: "Le Havre, classé UNESCO pour l'œuvre de Perret, conjugue patrimoine béton du XXe siècle et habitat balnéaire à entretenir face aux embruns. Le bassin portuaire alimente aussi un marché B2B continu.",
    contexte: "Zenbat est édité depuis Le Havre. Les artisans havrais bénéficient d'un produit pensé pour leur réalité : devis rapides, factures immédiates, suivi en mobilité sur les chantiers du port comme des quartiers Sud."
  },
  {
    slug: 'caen',
    nom: 'Caen',
    departement: '14',
    region: 'Normandie',
    population: 105512,
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Plomberie', 'Charpente', 'Peinture / Décoration'],
    intro: "Caen, capitale du Calvados, mêle reconstruction d'après-guerre et patrimoine médiéval rescapé. Les chantiers de rénovation et d'isolation sont continus.",
    contexte: "Le marché étudiant (Université de Caen) génère des chantiers courts en logements locatifs."
  },

  // ─────────── Bretagne ───────────
  {
    slug: 'rennes',
    nom: 'Rennes',
    departement: '35',
    region: 'Bretagne',
    population: 220488,
    metiers: ['Maçonnerie', 'Plomberie', 'Électricité', 'Menuiserie intérieure', 'Peinture / Décoration'],
    intro: "Rennes, métropole en croissance, voit fleurir programmes neufs et rénovations. Les artisans qualifiés sont sollicités sans relâche sur l'agglomération.",
    contexte: "Forte demande étudiante (2e ville universitaire de l'Ouest). Les rénovations rapides entre deux baux sont un marché à part."
  },
  {
    slug: 'brest',
    nom: 'Brest',
    departement: '29',
    region: 'Bretagne',
    population: 138682,
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Étanchéité', 'Plomberie', 'Peinture / Décoration'],
    intro: "Brest, ville-port, impose des matériaux résistants au vent et à l'humidité. La rénovation des toitures et façades est un marché structurel.",
    contexte: "Le marché militaire (Marine nationale) génère des appels d'offres B2B exigeants côté traçabilité."
  },

  // ─────────── Hauts-de-France ───────────
  {
    slug: 'lille',
    nom: 'Lille',
    departement: '59',
    region: 'Hauts-de-France',
    population: 235132,
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Isolation', 'Chauffage / PAC', 'Plomberie', 'Peinture / Décoration'],
    intro: "Lille et ses 1,2 million d'habitants au sein de la métropole forment un bassin BTP dense. La brique typique du Nord et la rénovation énergétique font partie du quotidien des artisans locaux.",
    contexte: "Les aides régionales hauts-de-France complètent les dispositifs nationaux : à intégrer dans les devis pour clore plus vite."
  },
  {
    slug: 'amiens',
    nom: 'Amiens',
    departement: '80',
    region: 'Hauts-de-France',
    population: 134706,
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Plomberie', 'Isolation', 'Peinture / Décoration'],
    intro: "Amiens conjugue centre historique (autour de la cathédrale) et habitat en bandes typique du Nord. La rénovation énergétique et la mise aux normes sont prioritaires.",
    contexte: "Marché majoritairement résidentiel : les devis pédagogiques (explication des postes) rassurent les particuliers."
  },

  // ─────────── Grand Est ───────────
  {
    slug: 'strasbourg',
    nom: 'Strasbourg',
    departement: '67',
    region: 'Grand Est',
    population: 287228,
    metiers: ['Charpente', 'Couverture / Zinguerie', 'Maçonnerie', 'Isolation', 'Menuiserie extérieure / Alu', 'Chauffage / PAC'],
    intro: "Strasbourg cumule patrimoine alsacien classé (Grande-Île UNESCO), bâti à colombages et tissu pavillonnaire. Les exigences thermiques (climat continental) y sont fortes.",
    contexte: "Le savoir-faire en charpente alsacienne et menuiserie traditionnelle est très recherché. Un devis qui valorise ces compétences se démarque."
  },
  {
    slug: 'reims',
    nom: 'Reims',
    departement: '51',
    region: 'Grand Est',
    population: 181194,
    metiers: ['Maçonnerie', 'Plomberie', 'Électricité', 'Peinture / Décoration', 'Couverture / Zinguerie'],
    intro: "Reims, capitale du champagne, conjugue patrimoine architectural Art déco et expansion résidentielle. La rénovation et l'aménagement des caves et chais sont des spécialités locales.",
    contexte: "Le marché B2B viticole apporte des chantiers techniques (humidité, ventilation) à bien chiffrer."
  },
  {
    slug: 'metz',
    nom: 'Metz',
    departement: '57',
    region: 'Grand Est',
    population: 122838,
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Plomberie', 'Isolation', 'Peinture / Décoration'],
    intro: "Metz combine pierre de Jaumont en centre-ville, habitat ouvrier en périphérie et programmes neufs autour du Centre Pompidou-Metz. La rénovation est un marché stable.",
    contexte: "Patrimoine transfrontalier : certains clients facturent en France pour des résidences au Luxembourg. Bien gérer la TVA est un atout."
  },

  // ─────────── Centre-Val de Loire ───────────
  {
    slug: 'tours',
    nom: 'Tours',
    departement: '37',
    region: 'Centre-Val de Loire',
    population: 137658,
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Menuiserie intérieure', 'Plomberie', 'Peinture / Décoration'],
    intro: "Tours, au cœur du Val de Loire UNESCO, voit fleurir rénovations patrimoniales (tuffeau, ardoise) et programmes neufs. Le marché des résidences secondaires de prestige est porteur.",
    contexte: "Les ABF sont fréquemment sollicités : les devis chiffrés finement, avec descriptifs précis, accélèrent les autorisations."
  },
  {
    slug: 'orleans',
    nom: 'Orléans',
    departement: '45',
    region: 'Centre-Val de Loire',
    population: 117026,
    metiers: ['Maçonnerie', 'Plomberie', 'Électricité', 'Peinture / Décoration', 'Carrelage / Faïence'],
    intro: "Orléans, à une heure de Paris, attire les nouveaux résidents franciliens. Rénovations et aménagements clés en main constituent l'essentiel des chantiers locaux.",
    contexte: "Profil client souvent venu d'Île-de-France : devis envoyés par mail, signature numérique et factures dématérialisées sont attendus."
  },

  // ─────────── Bourgogne-Franche-Comté ───────────
  {
    slug: 'dijon',
    nom: 'Dijon',
    departement: '21',
    region: 'Bourgogne-Franche-Comté',
    population: 158002,
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Charpente', 'Peinture / Décoration', 'Isolation'],
    intro: "Dijon, classée UNESCO pour son centre historique, demande des artisans formés à la pierre de Bourgogne et aux toitures vernissées. Les chantiers patrimoniaux y sont nombreux.",
    contexte: "Le tissu viticole bourguignon génère des chantiers B2B (caves, ventilation, étanchéité) au formalisme exigeant."
  },

  // ─────────── Outre-mer ───────────
  {
    slug: 'fort-de-france',
    nom: 'Fort-de-France',
    departement: '972',
    region: 'Martinique',
    population: 75516,
    metiers: ['Maçonnerie', 'Climatisation / VMC', 'Plomberie', 'Électricité', 'Étanchéité'],
    intro: "Fort-de-France, capitale économique de la Martinique, impose des contraintes spécifiques : climat tropical, normes paracycloniques, gestion de l'humidité. La climatisation est un marché de masse.",
    contexte: "Les normes anti-cycloniques et les délais d'approvisionnement maritime se chiffrent dans le devis pour éviter les mauvaises surprises côté client."
  }
]

export const REGIONS_ORDER = [
  'Île-de-France',
  'Auvergne-Rhône-Alpes',
  "Provence-Alpes-Côte d'Azur",
  'Occitanie',
  'Nouvelle-Aquitaine',
  'Pays de la Loire',
  'Normandie',
  'Bretagne',
  'Hauts-de-France',
  'Grand Est',
  'Centre-Val de Loire',
  'Bourgogne-Franche-Comté',
  'Martinique',
]

export function getVille(slug) {
  return VILLES.find(v => v.slug === slug) || null
}

export function getVillesByRegion() {
  const map = new Map(REGIONS_ORDER.map(r => [r, []]))
  for (const v of VILLES) {
    if (!map.has(v.region)) map.set(v.region, [])
    map.get(v.region).push(v)
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }
  return Array.from(map.entries()).filter(([, arr]) => arr.length > 0)
}

export const ALL_SLUGS = VILLES.map(v => v.slug)
