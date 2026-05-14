// 35 villes françaises ciblées pour le SEO local Zenbat.
// Chaque entrée alimente /villes (index) et /villes/:slug (page détaillée).
// Les métiers mis en avant reprennent les libellés exacts de src/lib/trades.js
// pour rester cohérent avec les fiches artisans existantes.
//
// Champs SEO :
//   - cp        : préfixe(s) des codes postaux (string ou array de strings)
//   - lat / lon : coordonnées géographiques (utilisées par schema.org/Place)
//   - quartiers : liste représentative pour les long-tails ("artisan [quartier]")
//   - proches   : slugs des villes proches pour le maillage interne
//   - aide      : phrase générique sur les aides régionales (rien d'inventé,
//                 on cite les dispositifs nationaux + nom de la région).
//
// Aucune statistique chiffrée fabriquée — on reste sur du factuel.

export const VILLES = [
  // ─────────── Île-de-France ───────────
  {
    slug: 'paris', nom: 'Paris', departement: '75', region: 'Île-de-France',
    population: 2102650, cp: '75001-75020', lat: 48.8566, lon: 2.3522,
    quartiers: ['Marais', 'Saint-Germain', 'Bastille', 'Montmartre', 'Belleville', 'Latin', 'Batignolles', 'République'],
    proches: ['boulogne-billancourt', 'versailles'],
    metiers: ['Plomberie', 'Électricité', 'Peinture / Décoration', 'Menuiserie intérieure', 'Maçonnerie', 'Carrelage / Faïence'],
    intro: "Paris concentre la plus forte demande d'artisans du bâtiment de France, avec un parc de plus d'un million de logements à entretenir et rénover. Les TPE qui interviennent intra-muros doivent répondre vite, avec des devis clairs, et facturer dans les délais pour rester rentables face à la pression des charges.",
    contexte: "Les chantiers parisiens cumulent les contraintes : accès difficile, copropriétés exigeantes, voisinage proche, délais courts. Un devis bien construit et envoyé en moins d'une heure fait souvent la différence pour décrocher l'affaire.",
    aide: "Sur Paris et l'Île-de-France, les artisans peuvent orienter leurs clients vers les aides nationales (MaPrimeRénov', éco-PTZ, CEE, TVA à 5,5 % pour la rénovation énergétique) cumulables avec les dispositifs régionaux. Mentionner ces aides dans le devis accélère la décision."
  },
  {
    slug: 'boulogne-billancourt', nom: 'Boulogne-Billancourt', departement: '92', region: 'Île-de-France',
    population: 121583, cp: '92100', lat: 48.8356, lon: 2.2410,
    quartiers: ['Point du Jour', 'République', 'Silly-Gallieni', 'Trapèze', 'Centre-ville'],
    proches: ['paris', 'versailles'],
    metiers: ['Électricité', 'Plomberie', 'Cuisine / Agencement', 'Menuiserie intérieure', 'Peinture / Décoration'],
    intro: "Boulogne-Billancourt rassemble des appartements haussmanniens et des programmes neufs récents. Les artisans y interviennent autant en rénovation patrimoniale qu'en aménagement contemporain.",
    contexte: "Le bassin attire une clientèle exigeante sur la qualité de présentation des devis. Les délais de paiement plus longs en B2B (sièges sociaux) imposent de relancer les factures sans tarder.",
    aide: "Les aides nationales (MaPrimeRénov', éco-PTZ, CEE) s'appliquent à Boulogne-Billancourt comme partout en Île-de-France. La région Île-de-France ajoute des dispositifs spécifiques pour la rénovation énergétique en copropriété."
  },
  {
    slug: 'versailles', nom: 'Versailles', departement: '78', region: 'Île-de-France',
    population: 85416, cp: '78000', lat: 48.8014, lon: 2.1301,
    quartiers: ['Notre-Dame', 'Saint-Louis', 'Montreuil', 'Clagny-Glatigny', 'Chantiers'],
    proches: ['paris', 'boulogne-billancourt'],
    metiers: ['Menuiserie intérieure', 'Peinture / Décoration', 'Plomberie', 'Couverture / Zinguerie', 'Maçonnerie'],
    intro: "Versailles mêle résidences anciennes classées, hôtels particuliers et pavillons. Les artisans qui maîtrisent les contraintes du bâti ancien y trouvent une demande régulière, notamment en ravalement et menuiserie sur mesure.",
    contexte: "Les chantiers en secteur sauvegardé exigent une documentation soignée. Les devis détaillés (matériaux, normes, garanties) rassurent les ABF et les copropriétés.",
    aide: "Versailles cumule les aides nationales (MaPrimeRénov', CEE) avec celles de l'Île-de-France et les dispositifs Yvelines pour la rénovation du bâti ancien."
  },

  // ─────────── Auvergne-Rhône-Alpes ───────────
  {
    slug: 'lyon', nom: 'Lyon', departement: '69', region: 'Auvergne-Rhône-Alpes',
    population: 522969, cp: '69001-69009', lat: 45.7640, lon: 4.8357,
    quartiers: ['Vieux Lyon', 'Croix-Rousse', 'Presqu\'île', 'Part-Dieu', 'Confluence', 'Guillotière', 'Monplaisir', 'Vaise'],
    proches: ['villeurbanne', 'saint-etienne', 'grenoble'],
    metiers: ['Plomberie', 'Électricité', 'Maçonnerie', 'Charpente', 'Chauffage / PAC', 'Peinture / Décoration'],
    intro: "Lyon est le second pôle économique français pour le BTP. Entre rénovation des immeubles canuts de la Croix-Rousse et programmes neufs sur la Confluence, les artisans locaux ne manquent pas de chantiers.",
    contexte: "La demande est forte en rénovation énergétique (MaPrimeRénov', CEE). Les devis qui mentionnent clairement les aides éligibles convertissent mieux.",
    aide: "Lyon et la Métropole de Lyon ouvrent l'accès aux aides Auvergne-Rhône-Alpes (Eco-chèque rénovation, Mon Accompagnateur Rénov') en plus des dispositifs nationaux."
  },
  {
    slug: 'villeurbanne', nom: 'Villeurbanne', departement: '69', region: 'Auvergne-Rhône-Alpes',
    population: 152090, cp: '69100', lat: 45.7665, lon: 4.8795,
    quartiers: ['Gratte-Ciel', 'Tonkin', 'Cusset', 'Charpennes', 'Croix-Luizet'],
    proches: ['lyon', 'saint-etienne'],
    metiers: ['Plomberie', 'Électricité', 'Peinture / Décoration', 'Carrelage / Faïence', 'Menuiserie intérieure'],
    intro: "Villeurbanne, accolée à Lyon, conjugue immeubles anciens des Gratte-Ciel et résidences récentes. Les artisans qui couvrent Lyon-Villeurbanne mutualisent leurs déplacements pour gagner en rentabilité.",
    contexte: "Beaucoup de bailleurs sociaux et de syndics opèrent ici : maîtriser le formalisme des appels d'offres est un vrai plus.",
    aide: "Mêmes dispositifs qu'à Lyon : aides nationales (MaPrimeRénov', CEE) + Eco-chèque Auvergne-Rhône-Alpes."
  },
  {
    slug: 'grenoble', nom: 'Grenoble', departement: '38', region: 'Auvergne-Rhône-Alpes',
    population: 158454, cp: '38000', lat: 45.1885, lon: 5.7245,
    quartiers: ['Hyper-centre', 'Île Verte', 'Berriat-Saint-Bruno', 'Eaux-Claires', 'Villeneuve'],
    proches: ['lyon', 'annecy'],
    metiers: ['Charpente', 'Couverture / Zinguerie', 'Isolation', 'Chauffage / PAC', 'Menuiserie extérieure / Alu'],
    intro: "Grenoble et sa cuvette imposent des standards élevés d'isolation thermique. Le climat continental, les hivers froids et les pics de pollution rendent la rénovation énergétique incontournable.",
    contexte: "Les artisans certifiés RGE captent la majorité des projets aidés. Le devis-type Zenbat permet de chiffrer rapidement les variantes (PAC, ITE, double-flux).",
    aide: "Le département de l'Isère et la région Auvergne-Rhône-Alpes ajoutent des aides à la rénovation énergétique aux dispositifs nationaux. La qualification RGE est quasi-obligatoire pour activer ces aides."
  },
  {
    slug: 'saint-etienne', nom: 'Saint-Étienne', departement: '42', region: 'Auvergne-Rhône-Alpes',
    population: 173089, cp: '42000', lat: 45.4397, lon: 4.3872,
    quartiers: ['Centre-ville', 'Bellevue', 'Montaud', 'Chapelon', 'Carnot'],
    proches: ['lyon', 'villeurbanne'],
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Plomberie', 'Électricité', 'Façade / Ravalement'],
    intro: "Saint-Étienne offre un parc immobilier accessible à rénover, attirant primo-accédants et investisseurs. La demande en travaux clés en main y est continue.",
    contexte: "Les chantiers de remise en état complète (achat-rénovation) sont nombreux. Un devis lisible par poste accélère la décision côté maître d'ouvrage.",
    aide: "Saint-Étienne Métropole oriente vers les aides nationales et régionales Auvergne-Rhône-Alpes. Le programme « Action Cœur de Ville » offre aussi un cadre pour les rénovations en centre ancien."
  },
  {
    slug: 'annecy', nom: 'Annecy', departement: '74', region: 'Auvergne-Rhône-Alpes',
    population: 130721, cp: '74000', lat: 45.8992, lon: 6.1294,
    quartiers: ['Vieille Ville', 'Bonlieu', 'Annecy-le-Vieux', 'Cran-Gevrier', 'Pringy'],
    proches: ['grenoble', 'lyon'],
    metiers: ['Charpente', 'Couverture / Zinguerie', 'Menuiserie extérieure / Alu', 'Isolation', 'Paysagiste / Espaces verts'],
    intro: "Annecy et son lac concentrent une clientèle haut de gamme et un tourisme exigeant. Chalets, résidences secondaires et villas contemporaines tirent la demande.",
    contexte: "La saisonnalité (préparation été / hiver) demande de la souplesse de planning. Les devis chiffrés finement (variantes, sur-mesure) sont la norme.",
    aide: "Le département de Haute-Savoie et la région Auvergne-Rhône-Alpes ajoutent leurs propres aides aux dispositifs nationaux, notamment sur l'isolation et le chauffage bois."
  },

  // ─────────── Provence-Alpes-Côte d'Azur ───────────
  {
    slug: 'marseille', nom: 'Marseille', departement: '13', region: "Provence-Alpes-Côte d'Azur",
    population: 873076, cp: '13001-13016', lat: 43.2965, lon: 5.3698,
    quartiers: ['Vieux-Port', 'Le Panier', 'La Joliette', 'Castellane', 'Endoume', 'La Pointe Rouge', 'Sainte-Marguerite', 'Saint-Antoine'],
    proches: ['aix-en-provence', 'toulon', 'nice'],
    metiers: ['Maçonnerie', 'Plomberie', 'Électricité', 'Peinture / Décoration', 'Climatisation / VMC', 'Façade / Ravalement'],
    intro: "Marseille présente un bâti ancien (3e arrondissement, Panier, Belle de Mai) qui demande des rénovations lourdes, et un littoral où la climatisation est devenue un standard.",
    contexte: "Le climat impose des matériaux résistant aux embruns et fortes chaleurs. Les artisans qui justifient ces choix dans le devis convertissent mieux.",
    aide: "La région PACA propose des dispositifs spécifiques (Chèque Énergie PACA) qui se cumulent avec MaPrimeRénov' et les CEE. La métropole Aix-Marseille pilote aussi des opérations programmées en centre ancien."
  },
  {
    slug: 'nice', nom: 'Nice', departement: '06', region: "Provence-Alpes-Côte d'Azur",
    population: 342669, cp: '06000-06300', lat: 43.7102, lon: 7.2620,
    quartiers: ['Vieux-Nice', 'Cimiez', 'Carré d\'Or', 'Riquier', 'Saint-Roch', 'Gambetta'],
    proches: ['marseille', 'toulon'],
    metiers: ['Climatisation / VMC', 'Peinture / Décoration', 'Plomberie', 'Carrelage / Faïence', 'Piscine / Spa'],
    intro: "Nice combine résidences haut de gamme et appartements touristiques. La pose et l'entretien de climatisations, piscines et terrasses tirent la demande toute l'année.",
    contexte: "Beaucoup de clients propriétaires non-résidents : les devis envoyés par mail avec signature électronique font gagner des semaines.",
    aide: "Le département des Alpes-Maritimes et la région PACA cumulent leurs aides à la rénovation énergétique avec les dispositifs nationaux. Les chantiers en copropriété touristique bénéficient d'accompagnements spécifiques."
  },
  {
    slug: 'toulon', nom: 'Toulon', departement: '83', region: "Provence-Alpes-Côte d'Azur",
    population: 178745, cp: '83000-83200', lat: 43.1242, lon: 5.9280,
    quartiers: ['Centre-ville', 'Mourillon', 'Pont du Las', 'Saint-Jean du Var', 'La Rode'],
    proches: ['marseille', 'aix-en-provence', 'nice'],
    metiers: ['Maçonnerie', 'Plomberie', 'Climatisation / VMC', 'Peinture / Décoration', 'Étanchéité'],
    intro: "Toulon mêle un centre ancien dense et des quartiers résidentiels en croissance. La rénovation des appartements et la mise aux normes électrique-plomberie sont des marchés porteurs.",
    contexte: "Le marché militaire et naval génère aussi des chantiers B2B aux exigences administratives strictes.",
    aide: "Mêmes dispositifs PACA qu'à Marseille, avec en plus des aides spécifiques du département du Var pour la rénovation en zone littorale."
  },
  {
    slug: 'aix-en-provence', nom: 'Aix-en-Provence', departement: '13', region: "Provence-Alpes-Côte d'Azur",
    population: 147122, cp: '13090-13100', lat: 43.5297, lon: 5.4474,
    quartiers: ['Mazarin', 'Vieil Aix', 'Sextius-Mirabeau', 'Encagnane', 'Jas de Bouffan'],
    proches: ['marseille', 'toulon'],
    metiers: ['Maçonnerie', 'Peinture / Décoration', 'Piscine / Spa', 'Paysagiste / Espaces verts', 'Menuiserie intérieure'],
    intro: "Aix-en-Provence attire une clientèle premium pour ses bastides, mas et résidences contemporaines. La piscine, la pierre et la rénovation patrimoniale sont des piliers locaux.",
    contexte: "Les devis très visuels (photos, coupes, références) sont valorisés. La signature numérique évite les allers-retours sur les sites éloignés.",
    aide: "La métropole Aix-Marseille et la région PACA pilotent des programmes pour la rénovation des bastides et habitats anciens, en complément des aides nationales."
  },

  // ─────────── Occitanie ───────────
  {
    slug: 'toulouse', nom: 'Toulouse', departement: '31', region: 'Occitanie',
    population: 498003, cp: '31000-31500', lat: 43.6047, lon: 1.4442,
    quartiers: ['Capitole', 'Carmes', 'Saint-Cyprien', 'Saint-Aubin', 'Compans-Caffarelli', 'Minimes', 'Rangueil'],
    proches: ['montpellier', 'bordeaux'],
    metiers: ['Maçonnerie', 'Plomberie', 'Électricité', 'Charpente', 'Carrelage / Faïence', 'Peinture / Décoration'],
    intro: "Toulouse, ville rose en forte croissance démographique, voit son parc neuf et ancien se développer en parallèle. Les artisans qualifiés sont en tension permanente sur l'agglomération.",
    contexte: "La construction bois et la brique foraine restent des spécialités locales. Les délais courts entre demande et devis sont un critère décisif.",
    aide: "L'Occitanie cumule MaPrimeRénov' avec des aides régionales (Éco-chèque Logement Occitanie). La métropole de Toulouse pilote aussi des opérations en centre ancien."
  },
  {
    slug: 'montpellier', nom: 'Montpellier', departement: '34', region: 'Occitanie',
    population: 295542, cp: '34000-34090', lat: 43.6108, lon: 3.8767,
    quartiers: ['Écusson', 'Antigone', 'Port Marianne', 'Boutonnet', 'Beaux-Arts', 'Castelnau'],
    proches: ['nimes', 'toulouse'],
    metiers: ['Climatisation / VMC', 'Plomberie', 'Électricité', 'Maçonnerie', 'Peinture / Décoration'],
    intro: "Montpellier voit sa population croître de 1 % par an. Les programmes neufs dominent, mais le centre médiéval impose aussi des chantiers de rénovation lourde sous contrainte patrimoniale.",
    contexte: "La climatisation est devenue indispensable : un poste qui doit apparaître clairement dans le devis. Les bailleurs étudiants génèrent des chantiers courts à fort volume.",
    aide: "Mêmes aides Occitanie qu'à Toulouse, plus des dispositifs propres au département de l'Hérault sur l'efficacité énergétique en climat méditerranéen."
  },
  {
    slug: 'nimes', nom: 'Nîmes', departement: '30', region: 'Occitanie',
    population: 148236, cp: '30000-30900', lat: 43.8367, lon: 4.3601,
    quartiers: ['Écusson', 'Gambetta', 'Jean-Jaurès', 'Mont Duplan', 'Chemin Bas d\'Avignon'],
    proches: ['montpellier', 'toulouse'],
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Plomberie', 'Peinture / Décoration', 'Climatisation / VMC'],
    intro: "Nîmes conjugue centre antique, faubourgs anciens et zones pavillonnaires. Les rénovations toiture, façade et climatisation occupent une grande partie du calendrier des artisans.",
    contexte: "Les épisodes cévenols imposent une vigilance étanchéité-toiture qui peut être valorisée dans le devis comme argument de pérennité.",
    aide: "Aides nationales + Éco-chèque Occitanie + dispositifs du département du Gard pour la rénovation thermique en climat sec."
  },

  // ─────────── Nouvelle-Aquitaine ───────────
  {
    slug: 'bordeaux', nom: 'Bordeaux', departement: '33', region: 'Nouvelle-Aquitaine',
    population: 261804, cp: '33000-33800', lat: 44.8378, lon: -0.5792,
    quartiers: ['Chartrons', 'Saint-Pierre', 'Bastide', 'Saint-Michel', 'Caudéran', 'Saint-Augustin', 'Bacalan'],
    proches: ['la-rochelle', 'pau'],
    metiers: ['Maçonnerie', 'Menuiserie intérieure', 'Peinture / Décoration', 'Plomberie', 'Électricité', 'Couverture / Zinguerie'],
    intro: "Bordeaux et son patrimoine de pierre blonde attirent une demande continue de rénovation. Le marché de l'échoppe bordelaise est un sous-marché à part entière.",
    contexte: "Les chantiers en secteur UNESCO demandent une rigueur documentaire : un devis bien structuré accélère les autorisations.",
    aide: "La Nouvelle-Aquitaine cumule MaPrimeRénov' avec ses aides régionales (Éco-prêt Nouvelle-Aquitaine, Mon Accompagnateur Rénov'). Bordeaux Métropole pilote aussi des opérations programmées (OPAH-RU)."
  },
  {
    slug: 'pau', nom: 'Pau', departement: '64', region: 'Nouvelle-Aquitaine',
    population: 75665, cp: '64000', lat: 43.2951, lon: -0.3708,
    quartiers: ['Centre', 'Trespoey', 'Université', 'Saragosse', 'Verdun'],
    proches: ['bordeaux'],
    metiers: ['Maçonnerie', 'Charpente', 'Couverture / Zinguerie', 'Isolation', 'Chauffage / PAC'],
    intro: "Pau et son piémont pyrénéen demandent des standards d'isolation poussés. La rénovation énergétique des maisons béarnaises est un marché stable.",
    contexte: "Les aides locales s'ajoutent souvent aux aides nationales : un artisan qui sait les chiffrer dans le devis fait la différence.",
    aide: "Le département des Pyrénées-Atlantiques et la région Nouvelle-Aquitaine ajoutent leurs aides aux dispositifs nationaux, avec un focus sur l'isolation en zone montagne."
  },
  {
    slug: 'la-rochelle', nom: 'La Rochelle', departement: '17', region: 'Nouvelle-Aquitaine',
    population: 76810, cp: '17000', lat: 46.1591, lon: -1.1520,
    quartiers: ['Vieux Port', 'Saint-Nicolas', 'Tasdon', 'Mireuil', 'La Pallice'],
    proches: ['bordeaux'],
    metiers: ['Couverture / Zinguerie', 'Maçonnerie', 'Menuiserie extérieure / Alu', 'Peinture / Décoration', 'Étanchéité'],
    intro: "La Rochelle, ville maritime, impose des matériaux résistants aux embruns. Les volets, façades et toitures réclament des entretiens réguliers.",
    contexte: "L'activité touristique génère des chantiers courts en intersaison. Les devis prêts vite, c'est un client capté avant la haute saison.",
    aide: "Les artisans rochelais activent MaPrimeRénov', les CEE et les aides Nouvelle-Aquitaine. La Charente-Maritime offre aussi des dispositifs pour la rénovation en zone littorale."
  },

  // ─────────── Pays de la Loire ───────────
  {
    slug: 'nantes', nom: 'Nantes', departement: '44', region: 'Pays de la Loire',
    population: 320732, cp: '44000-44300', lat: 47.2184, lon: -1.5536,
    quartiers: ['Bouffay', 'Graslin', 'Île de Nantes', 'Doulon', 'Chantenay', 'Hauts-Pavés', 'Malakoff'],
    proches: ['angers', 'rennes'],
    metiers: ['Maçonnerie', 'Charpente', 'Plomberie', 'Électricité', 'Menuiserie intérieure', 'Peinture / Décoration'],
    intro: "Nantes, en pleine expansion (+1 %/an), tire toute la filière BTP de l'Ouest. Les chantiers de réhabilitation des friches industrielles (Île de Nantes) côtoient les programmes pavillonnaires.",
    contexte: "Forte demande en construction bois et BBC. Les devis qui mettent en avant ces compétences se démarquent.",
    aide: "Pays de la Loire complète MaPrimeRénov' avec ses propres dispositifs (Éco-prêt régional, accompagnement Mon Accompagnateur Rénov')."
  },
  {
    slug: 'angers', nom: 'Angers', departement: '49', region: 'Pays de la Loire',
    population: 154508, cp: '49000-49100', lat: 47.4784, lon: -0.5632,
    quartiers: ['Centre', 'Doutre', 'Belle-Beille', 'Lac-de-Maine', 'Monplaisir'],
    proches: ['nantes', 'le-mans', 'tours'],
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Menuiserie intérieure', 'Plomberie', 'Électricité'],
    intro: "Angers, classée plusieurs fois ville la plus agréable de France, attire de nouveaux habitants. La rénovation des maisons de tuffeau et l'aménagement intérieur sont en demande.",
    contexte: "Les habitations en tuffeau exigent un savoir-faire spécifique : à valoriser explicitement dans le devis.",
    aide: "Aides Pays de la Loire + dispositifs du département du Maine-et-Loire pour la rénovation des habitats en tuffeau."
  },
  {
    slug: 'le-mans', nom: 'Le Mans', departement: '72', region: 'Pays de la Loire',
    population: 146105, cp: '72000-72100', lat: 47.9960, lon: 0.1996,
    quartiers: ['Cité Plantagenêt', 'République', 'Pontlieue', 'Sablons', 'Bellevue'],
    proches: ['angers', 'tours', 'nantes'],
    metiers: ['Maçonnerie', 'Plomberie', 'Électricité', 'Peinture / Décoration', 'Carrelage / Faïence'],
    intro: "Le Mans offre un parc immobilier accessible, attirant primo-accédants et bailleurs. Les chantiers de remise en état courent toute l'année.",
    contexte: "Le tissu d'investisseurs locatifs apprécie les devis détaillés et envoyés rapidement.",
    aide: "Mêmes aides Pays de la Loire qu'à Nantes, avec en plus les dispositifs du département de la Sarthe pour la rénovation rurale."
  },

  // ─────────── Normandie ───────────
  {
    slug: 'rouen', nom: 'Rouen', departement: '76', region: 'Normandie',
    population: 114108, cp: '76000-76100', lat: 49.4432, lon: 1.0993,
    quartiers: ['Vieux Rouen', 'Saint-Sever', 'Jouvenet', 'Mont-Gargan', 'Pasteur'],
    proches: ['le-havre', 'caen'],
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Menuiserie extérieure / Alu', 'Plomberie', 'Peinture / Décoration'],
    intro: "Rouen, capitale historique de la Normandie, présente un parc à colombages et de la pierre calcaire à entretenir. La rénovation patrimoniale y est un savoir-faire local.",
    contexte: "Les ABF sont actifs en centre-ville : la qualité du dossier devis-photos compte autant que le prix.",
    aide: "La Normandie cumule MaPrimeRénov' avec ses dispositifs régionaux (Chèque Éco-Énergie Normandie). La Métropole Rouen Normandie pilote aussi des opérations programmées."
  },
  {
    slug: 'le-havre', nom: 'Le Havre', departement: '76', region: 'Normandie',
    population: 165830, cp: '76600-76620', lat: 49.4944, lon: 0.1079,
    quartiers: ['Centre Reconstruit', 'Sainte-Adresse', 'Sanvic', 'Caucriauville', 'Aplemont', 'Graville', 'Eure'],
    proches: ['rouen', 'caen'],
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Plomberie', 'Électricité', 'Isolation'],
    intro: "Le Havre, classé UNESCO pour l'œuvre de Perret, conjugue patrimoine béton du XXe siècle et habitat balnéaire à entretenir face aux embruns. Le bassin portuaire alimente aussi un marché B2B continu.",
    contexte: "Zenbat est édité depuis Le Havre. Les artisans havrais bénéficient d'un produit pensé pour leur réalité : devis rapides, factures immédiates, suivi en mobilité sur les chantiers du port comme des quartiers Sud.",
    aide: "Les artisans havrais activent MaPrimeRénov', les CEE, les aides Normandie (Chèque Éco-Énergie) et les dispositifs spécifiques au bâti UNESCO Perret."
  },
  {
    slug: 'caen', nom: 'Caen', departement: '14', region: 'Normandie',
    population: 105512, cp: '14000', lat: 49.1829, lon: -0.3707,
    quartiers: ['Centre', 'Saint-Jean', 'Vaucelles', 'Beaulieu', 'Folie-Couvrechef'],
    proches: ['le-havre', 'rouen'],
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Plomberie', 'Charpente', 'Peinture / Décoration'],
    intro: "Caen, capitale du Calvados, mêle reconstruction d'après-guerre et patrimoine médiéval rescapé. Les chantiers de rénovation et d'isolation sont continus.",
    contexte: "Le marché étudiant (Université de Caen) génère des chantiers courts en logements locatifs.",
    aide: "Mêmes aides Normandie qu'à Rouen et Le Havre, plus les dispositifs du département du Calvados pour la rénovation en zone urbaine dense."
  },

  // ─────────── Bretagne ───────────
  {
    slug: 'rennes', nom: 'Rennes', departement: '35', region: 'Bretagne',
    population: 220488, cp: '35000-35200', lat: 48.1173, lon: -1.6778,
    quartiers: ['Centre', 'Thabor', 'Sud-Gare', 'Villejean', 'Maurepas', 'Bréquigny'],
    proches: ['brest', 'nantes'],
    metiers: ['Maçonnerie', 'Plomberie', 'Électricité', 'Menuiserie intérieure', 'Peinture / Décoration'],
    intro: "Rennes, métropole en croissance, voit fleurir programmes neufs et rénovations. Les artisans qualifiés sont sollicités sans relâche sur l'agglomération.",
    contexte: "Forte demande étudiante (2e ville universitaire de l'Ouest). Les rénovations rapides entre deux baux sont un marché à part.",
    aide: "La Bretagne cumule MaPrimeRénov' avec ses aides régionales (Éco-prêt Bretagne, Éco-chèque). Rennes Métropole pilote aussi des opérations programmées."
  },
  {
    slug: 'brest', nom: 'Brest', departement: '29', region: 'Bretagne',
    population: 138682, cp: '29200', lat: 48.3904, lon: -4.4861,
    quartiers: ['Siam', 'Saint-Marc', 'Recouvrance', 'Lambézellec', 'Bellevue'],
    proches: ['rennes'],
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Étanchéité', 'Plomberie', 'Peinture / Décoration'],
    intro: "Brest, ville-port, impose des matériaux résistants au vent et à l'humidité. La rénovation des toitures et façades est un marché structurel.",
    contexte: "Le marché militaire (Marine nationale) génère des appels d'offres B2B exigeants côté traçabilité.",
    aide: "Aides Bretagne (Éco-chèque) + dispositifs du département du Finistère pour la rénovation en zone littorale exposée."
  },

  // ─────────── Hauts-de-France ───────────
  {
    slug: 'lille', nom: 'Lille', departement: '59', region: 'Hauts-de-France',
    population: 235132, cp: '59000-59800', lat: 50.6292, lon: 3.0573,
    quartiers: ['Vieux-Lille', 'Centre', 'Wazemmes', 'Vauban', 'Moulins', 'Fives', 'Saint-Maurice-Pellevoisin'],
    proches: ['amiens'],
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Isolation', 'Chauffage / PAC', 'Plomberie', 'Peinture / Décoration'],
    intro: "Lille et ses 1,2 million d'habitants au sein de la métropole forment un bassin BTP dense. La brique typique du Nord et la rénovation énergétique font partie du quotidien des artisans locaux.",
    contexte: "Les aides régionales hauts-de-France complètent les dispositifs nationaux : à intégrer dans les devis pour clore plus vite.",
    aide: "Les Hauts-de-France ont leur Pass Rénovation et leur dispositif d'accompagnement « Mon Accompagnateur Rénov' Hauts-de-France » qui se cumulent avec MaPrimeRénov'."
  },
  {
    slug: 'amiens', nom: 'Amiens', departement: '80', region: 'Hauts-de-France',
    population: 134706, cp: '80000-80090', lat: 49.8941, lon: 2.2958,
    quartiers: ['Centre', 'Saint-Leu', 'Saint-Pierre', 'Étouvie', 'Henriville'],
    proches: ['lille'],
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Plomberie', 'Isolation', 'Peinture / Décoration'],
    intro: "Amiens conjugue centre historique (autour de la cathédrale) et habitat en bandes typique du Nord. La rénovation énergétique et la mise aux normes sont prioritaires.",
    contexte: "Marché majoritairement résidentiel : les devis pédagogiques (explication des postes) rassurent les particuliers.",
    aide: "Mêmes aides Hauts-de-France qu'à Lille, avec en plus les dispositifs du département de la Somme pour la rénovation rurale et péri-urbaine."
  },

  // ─────────── Grand Est ───────────
  {
    slug: 'strasbourg', nom: 'Strasbourg', departement: '67', region: 'Grand Est',
    population: 287228, cp: '67000-67200', lat: 48.5734, lon: 7.7521,
    quartiers: ['Grande Île', 'Krutenau', 'Neudorf', 'Robertsau', 'Cronenbourg', 'Esplanade'],
    proches: ['metz', 'reims'],
    metiers: ['Charpente', 'Couverture / Zinguerie', 'Maçonnerie', 'Isolation', 'Menuiserie extérieure / Alu', 'Chauffage / PAC'],
    intro: "Strasbourg cumule patrimoine alsacien classé (Grande-Île UNESCO), bâti à colombages et tissu pavillonnaire. Les exigences thermiques (climat continental) y sont fortes.",
    contexte: "Le savoir-faire en charpente alsacienne et menuiserie traditionnelle est très recherché. Un devis qui valorise ces compétences se démarque.",
    aide: "Le Grand Est propose le « Climaxion » (aides régionales rénovation) cumulable avec MaPrimeRénov'. L'Eurométropole Strasbourg pilote aussi des opérations programmées."
  },
  {
    slug: 'reims', nom: 'Reims', departement: '51', region: 'Grand Est',
    population: 181194, cp: '51100', lat: 49.2583, lon: 4.0317,
    quartiers: ['Centre', 'Cernay', 'Cathédrale', 'Clairmarais', 'Croix-Rouge'],
    proches: ['strasbourg', 'metz'],
    metiers: ['Maçonnerie', 'Plomberie', 'Électricité', 'Peinture / Décoration', 'Couverture / Zinguerie'],
    intro: "Reims, capitale du champagne, conjugue patrimoine architectural Art déco et expansion résidentielle. La rénovation et l'aménagement des caves et chais sont des spécialités locales.",
    contexte: "Le marché B2B viticole apporte des chantiers techniques (humidité, ventilation) à bien chiffrer.",
    aide: "Aides Grand Est (Climaxion) + dispositifs du département de la Marne pour la rénovation en zones viticoles AOC."
  },
  {
    slug: 'metz', nom: 'Metz', departement: '57', region: 'Grand Est',
    population: 122838, cp: '57000-57070', lat: 49.1193, lon: 6.1757,
    quartiers: ['Centre-ville', 'Borny', 'Sablon', 'Bellecroix', 'Devant-les-Ponts'],
    proches: ['strasbourg', 'reims'],
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Plomberie', 'Isolation', 'Peinture / Décoration'],
    intro: "Metz combine pierre de Jaumont en centre-ville, habitat ouvrier en périphérie et programmes neufs autour du Centre Pompidou-Metz. La rénovation est un marché stable.",
    contexte: "Patrimoine transfrontalier : certains clients facturent en France pour des résidences au Luxembourg. Bien gérer la TVA est un atout.",
    aide: "Mêmes aides Grand Est (Climaxion) qu'à Strasbourg, avec en plus des dispositifs du département de la Moselle pour les zones transfrontalières."
  },

  // ─────────── Centre-Val de Loire ───────────
  {
    slug: 'tours', nom: 'Tours', departement: '37', region: 'Centre-Val de Loire',
    population: 137658, cp: '37000-37100', lat: 47.3941, lon: 0.6848,
    quartiers: ['Centre', 'Vieux Tours', 'Tonnellé', 'Sanitas', 'Rives du Cher'],
    proches: ['orleans', 'angers', 'le-mans'],
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Menuiserie intérieure', 'Plomberie', 'Peinture / Décoration'],
    intro: "Tours, au cœur du Val de Loire UNESCO, voit fleurir rénovations patrimoniales (tuffeau, ardoise) et programmes neufs. Le marché des résidences secondaires de prestige est porteur.",
    contexte: "Les ABF sont fréquemment sollicités : les devis chiffrés finement, avec descriptifs précis, accélèrent les autorisations.",
    aide: "Le Centre-Val de Loire propose ses Éco-prêts régionaux cumulables avec MaPrimeRénov'. La rénovation en secteur UNESCO ouvre droit à des aides spécifiques de la DRAC."
  },
  {
    slug: 'orleans', nom: 'Orléans', departement: '45', region: 'Centre-Val de Loire',
    population: 117026, cp: '45000-45100', lat: 47.9029, lon: 1.9039,
    quartiers: ['Centre', 'Saint-Marceau', 'Madeleine', 'Argonne', 'La Source'],
    proches: ['tours'],
    metiers: ['Maçonnerie', 'Plomberie', 'Électricité', 'Peinture / Décoration', 'Carrelage / Faïence'],
    intro: "Orléans, à une heure de Paris, attire les nouveaux résidents franciliens. Rénovations et aménagements clés en main constituent l'essentiel des chantiers locaux.",
    contexte: "Profil client souvent venu d'Île-de-France : devis envoyés par mail, signature numérique et factures dématérialisées sont attendus.",
    aide: "Mêmes aides Centre-Val de Loire qu'à Tours, avec en plus les dispositifs du département du Loiret pour les rénovations en cœur de ville."
  },

  // ─────────── Bourgogne-Franche-Comté ───────────
  {
    slug: 'dijon', nom: 'Dijon', departement: '21', region: 'Bourgogne-Franche-Comté',
    population: 158002, cp: '21000', lat: 47.3220, lon: 5.0415,
    quartiers: ['Centre', 'Toison d\'Or', 'Université', 'Fontaine d\'Ouche', 'Grésilles'],
    proches: [],
    metiers: ['Maçonnerie', 'Couverture / Zinguerie', 'Charpente', 'Peinture / Décoration', 'Isolation'],
    intro: "Dijon, classée UNESCO pour son centre historique, demande des artisans formés à la pierre de Bourgogne et aux toitures vernissées. Les chantiers patrimoniaux y sont nombreux.",
    contexte: "Le tissu viticole bourguignon génère des chantiers B2B (caves, ventilation, étanchéité) au formalisme exigeant.",
    aide: "La Bourgogne-Franche-Comté propose le dispositif « Effilogis » pour la rénovation énergétique, cumulable avec MaPrimeRénov'. Dijon Métropole pilote aussi des opérations en secteur UNESCO."
  },

  // ─────────── Outre-mer ───────────
  {
    slug: 'fort-de-france', nom: 'Fort-de-France', departement: '972', region: 'Martinique',
    population: 75516, cp: '97200', lat: 14.6160, lon: -61.0588,
    quartiers: ['Centre', 'Terres-Sainville', 'Sainte-Thérèse', 'Volga-Plage', 'Trénelle'],
    proches: [],
    metiers: ['Maçonnerie', 'Climatisation / VMC', 'Plomberie', 'Électricité', 'Étanchéité'],
    intro: "Fort-de-France, capitale économique de la Martinique, impose des contraintes spécifiques : climat tropical, normes paracycloniques, gestion de l'humidité. La climatisation est un marché de masse.",
    contexte: "Les normes anti-cycloniques et les délais d'approvisionnement maritime se chiffrent dans le devis pour éviter les mauvaises surprises côté client.",
    aide: "Les aides spécifiques outre-mer (Crédit d'impôt outre-mer, dispositifs ADEME Martinique) se cumulent avec MaPrimeRénov'. Le programme Habiter Mieux est aussi mobilisable."
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

export function getVillesProches(ville) {
  if (!ville?.proches?.length) return []
  return ville.proches.map(s => getVille(s)).filter(Boolean)
}

export const ALL_SLUGS = VILLES.map(v => v.slug)
