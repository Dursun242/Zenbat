import { tradesLabels } from "../trades.js";

// ── Détection de la famille de métiers ───────────────────────────────────────
export const SECTOR_KEYWORDS = {
  btp:          ["maçonnerie","plomberie","électricité","charpente","couverture","isolation","carrelage","peinture","menuiserie","façade","étanchéité","terrassement","gros œuvre","chauffage","climatisation","serrurerie","sols souples","vitrerie","piscine","paysagiste","démolition","domotique","sanitaire","architecture","maîtrise d'œuvre","bureau d'études","cuisine / agencement","zinguerie","vrd","béton"],
  beaute:       ["coiffure","barbier","esthétique","onglerie","maquillage","massage","tatouage","piercing","bien-être"],
  sante:        ["kinésithérapie","ostéopathie","naturopathie","diététique","coach sportif","psychologie","opticien","audioprothésiste","nutrition","personal trainer"],
  tech:         ["développement web","développement mobile","informatique","cybersécurité","graphisme","ux","ui design","seo","sea","community management","création de contenu","développement logiciel","réseaux"],
  alimentaire:  ["boulangerie","pâtisserie","boucherie","charcuterie","traiteur","restauration","chocolatier","confiseur","glacier","sommellerie","cave"],
  transport:    ["mécanique automobile","carrosserie","vitrage auto","moto","vélo","déménagement","transport","livraison","vtc","taxi"],
  communication:["photographie","vidéographie","montage","drone","rédaction","copywriting","traduction","illustration","impression","signalétique","publicité","marketing"],
  evenementiel: ["événements","dj","animation musicale","traiteur événementiel","décoration événementielle","son / lumière","scène"],
  education:    ["cours particuliers","formation professionnelle","auto-école"],
  nettoyage:    ["nettoyage","pressing","blanchisserie","ramonage","entretien cheminée","désinfection","dératisation"],
  animaux:      ["toilettage animal","vétérinaire","dog-sitting","pet-sitting","dressage","éducation canine"],
  immobilier:   ["agent immobilier","gestionnaire de patrimoine","comptabilité","expertise comptable","juridique","conseil"],
  mode:         ["couture","retouche","maroquinerie","cordonnerie","teinturerie"],
};

export const detectSectors = (tradeNames, fallback = "") => {
  const t = (tradeNames.join(" ") + " " + fallback).toLowerCase();
  const found = Object.entries(SECTOR_KEYWORDS)
    .filter(([, kws]) => kws.some(kw => t.includes(kw)))
    .map(([sector]) => sector);
  return found.length ? found : ["general"];
};

// ── Contexte adapté au secteur ────────────────────────────────────────────────
export const SECTOR_LABELS = {
  btp: "BTP et travaux du bâtiment", beaute: "beauté et bien-être", sante: "santé et paramédical",
  tech: "tech et numérique", alimentaire: "artisanat alimentaire et restauration",
  transport: "transport et automobile", communication: "communication et créatif",
  evenementiel: "événementiel et animation", education: "enseignement et formation",
  nettoyage: "nettoyage et entretien", animaux: "services animaliers",
  immobilier: "immobilier et conseil", mode: "mode et textile", general: "prestations de services",
};

export const SECTOR_UNITS = {
  btp:           "m², ml, m³, u, ens, h",
  beaute:        "u (prestation), forfait, h, min",
  sante:         "u (séance), forfait, h",
  tech:          "j (jour/homme), h, forfait, u",
  alimentaire:   "u, kg, pers, pièce, lot, kg",
  transport:     "km, h, j, forfait, u",
  communication: "j, h, forfait, u",
  evenementiel:  "h, j, forfait, pers, u",
  education:     "h, j, session, forfait",
  nettoyage:     "h, m², forfait, j",
  animaux:       "u, h, j, forfait",
  immobilier:    "h, j, forfait, u",
  mode:          "u, h, pièce, forfait",
  general:       "u, h, j, forfait, ens",
};

export const SECTOR_PRICING = {
  btp: `Prix réalistes BTP France 2025 — fourchettes hautes/basses fournitures + pose comprises (sauf mention) :
• Main-d'œuvre : élec 45-65 €/h, plombier 50-70 €/h, peintre 35-50 €/h, maçon 40-60 €/h.
• Carrelage : 80-120 €/m² fourniture+pose grès cérame standard, ragréage en sus 15-25 €/m².
• Peinture intérieure : 25-45 €/m² murs+plafonds (impression + 2 couches finition), incluant protections et préparation légère.
• Cloison placo : 80-120 €/m² posée acoustique 72/48. Démolition cloisons : 35-70 €/m² + évacuation gravats 30-60 €/m³.
• Plomberie complète maison ou rénovation totale : 80-130 €/m² habitable (réseaux EF/ECS/EU + raccordements, hors sanitaires). Rénovation plomberie 90 m² = 7 000-12 000 €.
• Électricité rénovation totale : 100-150 €/m² habitable (tableau + circuits + prises + éclairage + consuel). Rénovation T2 40 m² = 4 000-6 000 €. Tableau seul maison T4 100 m² complet = 8 000-12 000 €.
• Sanitaires : douche italienne posée 1 200-2 500 €, WC suspendu+bâti+plaque 700-1 100 €, meuble vasque+robinet 600-1 200 €, baignoire balnéo 1 800-3 500 €.
• Couverture tuiles : 100-180 €/m² réfection complète. Étanchéité bicouche soudé : 70-120 €/m². Zinguerie chéneau zinc 80-120 €/ml.
• Façade : ravalement enduit gratté 50-120 €/m². ITE polystyrène 16 cm + enduit minéral 130-180 €/m². ITE laine de roche : 160-220 €/m².
• Isolation combles soufflé : 20-40 €/m². ITI placo+laine 50-90 €/m².
• Charpente bois traditionnelle : 250-450 €/m² au sol incluant fournitures, traitement et pose.
• Menuiseries : fenêtre alu DV 800-1 500 €/u posée, porte intérieure 250-450 €/u posée, porte d'entrée 1 500-3 500 €/u, vitrage simple remplacement 250-450 €/fenêtre.
• Cuisine équipée : 800-1 500 €/ml fourniture+pose milieu de gamme. Cuisine 12 ml standard = 10 000-18 000 €.
• Salle de bain rénovation complète clé en main : 1 200-2 500 €/m² (démolition + plomberie + carrelage + sanitaires + élec). 6 m² = 8 000-15 000 €.
• Cuisine rénovation clé en main : 1 000-1 800 €/m² (démol + plomberie + élec + cuisine équipée). 14 m² = 14 000-25 000 €.
• Construction maison neuve : 1 000-1 500 €/m² hors fondations / hors VRD / hors terrain.
• Maîtrise d'œuvre / MOE rénovation : 3 500-5 500 €/appartement, soit ~20-35 k€ pour un immeuble de 6 appts. Pour une maison particulière : 4 000-12 000 € selon ampleur.
• Bureau d'études structure : 1 500-4 500 € selon complexité (ouverture mur porteur 1 500-2 500 €).
• Permis de construire dossier seul (sans architecte) : 1 500-3 000 €. Avec architecte : 6 000-12 000 €.
• Chauffage : PAC air/eau 11 kW posée 12 000-18 000 €, chaudière condensation gaz 4 500-8 000 €, plancher chauffant 80-130 €/m².
• VMC double flux maison 100-130 m² : 5 000-8 000 € posée.
• Domotique éclairage maison 4 pièces : 3 500-7 000 €.
• Piscine béton coque 8×4 m liner clé en main : 25 000-40 000 €.
• Terrasse bois exotique sur plots : 250-450 €/m² fourniture+pose.
• Garde-corps acier extérieur : 350-600 €/ml.

⚠ Sur la RÉNOVATION et l'ENTRETIEN, ne sous-estime jamais : si l'utilisateur dit "rénovation complète", "rénovation totale", "remplacement complet" → appuie-toi sur les fourchettes ci-dessus, jamais sur les seuls coûts matière.`,
  beaute:        "Tarifs beauté France 2025. Ex : coupe femme 35-80 €, soin visage 60-120 €, pose ongles 40-80 €, épilation 20-60 €.",
  sante:         "Tarifs paramédicaux France 2025. Ex : séance kiné 40-70 €, ostéo 60-90 €, coaching sportif 50-100 €/h, consultation diét. 60-80 €.",
  tech:          "TJM tech France 2025. Ex : dev web junior 350-500 €/j, senior 600-900 €/j, graphiste 300-600 €/j, chef de projet 500-800 €/j.",
  alimentaire:   "Tarifs artisanat alimentaire France 2025. Ex : plateau repas traiteur 15-35 €/pers, buffet cocktail 25-55 €/pers, gâteau sur-mesure 4-8 €/part.",
  transport:     "Tarifs transport France 2025. Ex : déménagement studio 400-800 €, VTC aéroport 40-80 €, dépannage moto 80-150 €, livraison express 15-40 €.",
  communication: "Tarifs comm/créatif France 2025. Ex : reportage photo demi-journée 400-800 €, vidéo institutionnelle 1 500-5 000 €, logo 500-2 000 €.",
  evenementiel:  "Tarifs événementiel France 2025. Ex : DJ soirée 400-1 200 €, photographe événement 600-1 500 €, animation musicale 300-800 €.",
  education:     "Tarifs formation France 2025. Ex : cours particulier 25-60 €/h, formation pro 500-1 500 €/jour, auto-école forfait 1 200-2 000 €.",
  nettoyage:     "Tarifs nettoyage France 2025. Ex : ménage domicile 15-25 €/h, nettoyage bureaux 18-30 €/h, vitres 3-8 €/m².",
  animaux:       "Tarifs animaliers France 2025. Ex : toilettage chien 40-80 €, pension journalière 20-40 €, dressage 50-80 €/séance.",
  immobilier: `Honoraires France 2025 :
• Agence immobilière mandat de vente : 4-8 % du prix de vente TTC (mandat exclusif souvent 4-6 %, mandat simple 5-8 %). Pour appartement à 280 000 € → 11 200-22 400 € d'honoraires. Toujours estimer le montant en € même si le calcul est en %.
• Gestion locative : 6-10 % du loyer mensuel TTC encaissé, frais de mise en location 1 mois de loyer.
• Expertise comptable : forfait annuel TPE/auto-entrepreneur 1 200-2 500 €/an, SARL/SAS 2 500-6 000 €/an selon CA, ou 80-200 €/h.
• Conseil juridique : 150-400 €/h. Forfaits courants : rédaction CGV/CGU site e-commerce 800-2 500 €, statuts SARL 800-1 500 €, pacte d'associés 1 500-4 000 €.
• Consultant : TJM 600-1 200 €/j selon expertise.

⚠ Quand un % est dû (commission agence, gestion locative), tu DOIS estimer le montant en € à partir du prix mentionné par l'utilisateur. Ne laisse jamais prix_unitaire à null.`,
  mode:          "Tarifs couture France 2025. Ex : retouche simple 10-30 €, ourlet 15-25 €, robe sur-mesure 200-800 €.",
  general:       "Tarifs du marché France 2025. Adapte les prix, les unités et le vocabulaire au métier exact déclaré par l'utilisateur, en t'appuyant sur ta connaissance professionnelle de ce métier (tarifs pratiqués, conventions, spécificités). Évite toute réponse générique.",
};

export const SECTOR_TVA = {
  btp: `TVA BTP — 3 taux légaux + autoliquidation sous-traitance :

▸ 5,5 % (art. 278-0 bis A CGI) — Amélioration énergétique dans logement d'habitation achevé depuis > 2 ans :
  Isolation thermique (combles, murs, plancher bas), PAC (air/air, air/eau, géothermique), chaudière biomasse, chauffe-eau thermodynamique, panneaux solaires thermiques, VMC double flux, fenêtres et portes-fenêtres double/triple vitrage, volets isolants. RGE souvent exigé pour accès aux aides clients.

▸ 10 % (art. 279-0 bis CGI) — Rénovation/entretien dans logement d'habitation achevé depuis > 2 ans :
  Tous les autres travaux : plomberie, électricité, peinture, carrelage, couverture, maçonnerie d'entretien, menuiserie de remplacement (hors critères énergétiques), sanitaire, charpente de réfection. Les fournitures incluses dans la même facture sont aussi à 10 % si elles ne dépassent pas 30 % du prix total HT.

▸ 20 % — Taux normal :
  Construction neuve, extension, surélévation, locaux à usage professionnel/commercial, logement achevé depuis < 2 ans, fournitures vendues sans pose, modification de structure portante. Maçonnerie de gros œuvre même sur bâtiment existant si elle crée de la surface ou modifie la structure.

⚠ Règle des 30 % : si les fournitures dépassent 30 % du prix total HT, facturer les fournitures à 20 % et la main-d'œuvre au taux réduit applicable. Séparer en lots distincts dans le JSON.
⚠ Attestation simplifiée : le client doit remettre une attestation certifiant que le local est un logement à usage d'habitation achevé depuis > 2 ans. Sans attestation signée, applique 20 % par défaut.
⚠ Autoliquidation sous-traitance (art. 283-2 nonies CGI) : si l'utilisateur mentionne l'un de ces signaux — "sous-traitant", "sous-traitance", "promoteur", "maître d'œuvre", "entreprise générale", "donneur d'ordre", "constructeur", "maître d'ouvrage délégué", ou si le client est clairement une société du bâtiment (SAS, SARL, EI assujettie à la TVA) — la TVA est autoliquidée par le donneur d'ordre. Dans ce cas : tva_rate = 0 sur TOUTES les lignes ET ajoute la mention "Autoliquidation de la TVA — art. 283-2 nonies CGI. TVA due par le preneur assujetti." dans l'objet du devis ou dans un lot dédié de type commentaire.

Si une même facture mélange plusieurs taux, décomposer impérativement par lots distincts avec tva_rate explicite sur chaque ligne.`,
  alimentaire: `TVA :
- 5.5% : produits alimentaires de base (pain, épicerie, pâtisserie non luxe).
- 10% : restauration, plats cuisinés, traiteur.
- 20% : boissons alcoolisées, confiseries, chocolat.`,
  sante: `TVA : 20% pour les soins non remboursés (coaching, naturopathie, nutrition). Actes paramédicaux conventionnés : tva_rate 0. En cas de doute, applique 20%.`,
  nettoyage: `TVA : 10% pour les services à la personne à domicile (résidence principale). 20% pour locaux professionnels.`,
  default: `TVA : 20% par défaut pour les prestations de services en France.`,
};

// Connaissance technique par sous-métier BTP — normes, décomposition, mentions légales.
export const BTP_SUBTRADE_KNOWLEDGE = {
  electricite: {
    keywords: ["électricité", "électricien", "domotique"],
    normes: "NF C 15-100 (installation électrique BT domestique), NFC 14-100 (branchement réseau).",
    mentions: "CONSUEL : attestation de conformité obligatoire pour toute installation neuve ou modification substantielle (nouveau tableau, extension de circuit). Sans CONSUEL, le fournisseur d'énergie refuse la mise en service. Mentionner sur le devis si CONSUEL inclus ou en sus.",
    decomposition: "Décomposer SYSTÉMATIQUEMENT en : 1) Fournitures — câbles (ml + section : 1,5 mm² éclairage, 2,5 mm² prises, 6 mm² cuisinière), tableau (u, nombre de modules, marque : Hager, Schneider, Legrand), prises/interrupteurs (u, gamme). 2) Main-d'œuvre pose (h ou forfait). Ne jamais regrouper MO + fournitures si le détail est possible.",
    details: "Préciser : marque et gamme appareillage, section câbles, type de tableau, nombre de circuits protégés. Inclure test d'isolement et mesure de terre dans le devis.",
  },
  isolation: {
    keywords: ["isolation", "isolant", "combles", "ite", "iti"],
    normes: "RE 2020 (bâtiments neufs). Arrêté CEE (Certificats d'Économies d'Énergie) pour travaux en rénovation. Seuils 2025 : combles perdus ≥ R 7, rampants ≥ R 6, murs ≥ R 3,7, plancher bas ≥ R 3.",
    mentions: "RGE (Reconnu Garant de l'Environnement) : qualification obligatoire pour que le client bénéficie de MaPrimeRénov' et des CEE. Mentionner le numéro de certification RGE sur le devis. Garantie décennale obligatoire.",
    decomposition: "Indiquer OBLIGATOIREMENT dans la désignation : type d'isolant + matériau + épaisseur + valeur R cible. Ex : « Isolation combles perdus soufflés, ouate de cellulose, R ≥ 7 m²·K/W, ép. 36 cm ».",
    details: "Matériaux : laine de verre (λ 0,032–0,040), laine de roche, ouate de cellulose soufflée ou en panneau, polyuréthane projeté, laine de bois. ITE avec crépi : séparer lot isolation (5,5 %) et lot ravalement (10 %).",
  },
  charpente: {
    keywords: ["charpente", "charpentier", "ossature bois", "fermette", "faîtage", "combles"],
    normes: "DTU 31.1 (ossatures bois), DTU 31.3 (charpente traditionnelle), Eurocode 5 (calcul structure bois).",
    mentions: "Assurance décennale obligatoire : mentionner numéro de police et assureur sur le devis. Note de calcul structure disponible sur demande.",
    decomposition: "Décomposer : 1) Bois structure (m³ ou ml, section précise et essence). 2) Quincaillerie et assemblages (u). 3) Main-d'œuvre. 4) Traitement fongicide/insecticide si Classe ≥ 2.",
    details: "Préciser : essence (Douglas C24, sapin S10, épicéa, chêne), section des pièces (ex. « chevrons 63×175 mm », « pannes 80×160 mm », « faîtière 80×200 mm »), classe de service (CS1 = intérieur sec, CS2 = couvert extérieur, CS3 = exposé).",
  },
  plomberie: {
    keywords: ["plomberie", "plombier", "sanitaire", "chauffage", "pac", "pompe à chaleur", "chaudière"],
    normes: "DTU 60.1 (plomberie sanitaire), DTU 65.11 (chauffage central). NF EN 1717 (protection contre la pollution).",
    mentions: "Test de pression obligatoire : réseau eau froide/chaude testé à 10 bars pendant 30 min minimum. Préciser sur le devis si inclus.",
    decomposition: "Décomposer : 1) Tubes + raccords (ml + u, matériau : cuivre, PER, multicouche). 2) Appareils sanitaires (u, marque/gamme). 3) Robinetterie (u, type : mitigeur, thermostatique). 4) Main-d'œuvre. 5) Test d'étanchéité. Pour PAC/chaudière : préciser marque + puissance (kW) + COP.",
    details: "Matériaux réseau : cuivre soudé, PER réticulé, multicouche alu+PER. Évacuations : PVC, grès pour enterré. PAC : préciser SCOP/COP, régime eau (35/55°C).",
  },
  couverture: {
    keywords: ["couverture", "toiture", "zinguerie", "étanchéité", "ardoise", "tuile", "zinc"],
    normes: "DTU 40.11 (ardoises naturelles), DTU 40.21 (tuiles terre cuite), DTU 40.29 (tuiles béton), DTU 40.41 (zinc), DTU 43.1 (étanchéité toiture terrasse).",
    mentions: "Assurance décennale obligatoire pour l'étanchéité toiture : mentionner numéro de police et assureur.",
    decomposition: "Décomposer : 1) Dépose + évacuation ancienne couverture. 2) Liteaux/contre-liteaux (ml, section). 3) Écran sous-toiture / pare-pluie (m²). 4) Couverture principale (m², matériau + référence + coloris). 5) Zinguerie (ml : faîtage, rives, noues, chéneaux, descentes EP). 6) MO.",
    details: "Pentes minimales : ardoise naturelle 25°, tuile mécanique 20°, zinc joint debout 3°. Préciser ventilation sous-toiture. Chéneaux : préciser développé (mm) et matériau (zinc, alu, cuivre).",
  },
  maconnerie: {
    keywords: ["maçonnerie", "maçon", "gros œuvre", "béton", "fondation", "dalle", "agglo", "parpaing", "enduit", "façade"],
    normes: "DTU 20.1 (parois et murs maçonnerie), DTU 20.12 (soubassements), DTU 13.11 (fondations superficielles).",
    mentions: "Assurance décennale obligatoire pour gros œuvre et structure. Mentionner numéro de police et assureur.",
    decomposition: "Décomposer : 1) Terrassement/fouilles (m³). 2) Fondations (m³, résistance béton : C20/25, C25/30). 3) Maçonnerie (m² ou m³, type de bloc). 4) Ferraillage (kg ou ml, diamètre HA). 5) Coffrage. 6) Enduits (m², type : monocouche, bi-couche, isolant). 7) MO.",
    details: "Spécifier : résistance béton (C16/20, C20/25, C25/30), type de blocs (parpaing 20, brique monomur, brique Monomur R37), armatures (HA8, HA10, HA12, treillis soudé), classe d'exposition XC1–XC4.",
  },
  peinture: {
    keywords: ["peinture", "peintre", "ravalement", "papier peint"],
    normes: "DTU 59.1 (peintures et vernis). Produits classe A+ en émission COV.",
    mentions: "Garantie biennale (2 ans) sur les travaux de peinture. Pour ravalement façade : garantie décennale sur l'étanchéité.",
    decomposition: "Décomposer : 1) Préparation support (dépoussiérage, ponçage, ragréage léger, impression). 2) Application (préciser nombre de couches). 3) Fournitures peinture (litrage estimé, marque/gamme). 4) MO.",
    details: "Préciser : finition (mat, velours, satin, brillant), type de liant (acrylique ou glycéro), teinte (RAL ou NCS si connue), nombre de couches, surface en m². Ravalement : typer enduit (monocouche teinté, enduit minéral, crépi projeté).",
  },
  carrelage: {
    keywords: ["carrelage", "carreleur", "faïence", "revêtement sol", "ragréage", "parquet"],
    normes: "DTU 52.1 (pose de carrelage et mosaïque). NF EN 14411 (classification carrelages). DTU 51.3 (parquet collé).",
    mentions: "Garantie biennale (2 ans) sur la pose.",
    decomposition: "Décomposer : 1) Dépose + évacuation. 2) Ragréage autonivelant si nécessaire (m², épaisseur). 3) Fourniture carrelage (m², format + référence). 4) Colle (C2S1 mural, C2S2 sol déformable). 5) Pose (m²). 6) Joints (époxy ou ciment, teinte). 7) Plinthes/profilés de finition.",
    details: "Préciser : format (30×60, 60×60, 80×80…), type (grès cérame pleine masse, faïence, pierre naturelle), finition (mat, poli, structuré), classe UPEC pour sol. Prévoir 10 % de chutes minimum dans les quantités.",
  },
  menuiserie: {
    keywords: ["menuiserie", "menuisier", "fenêtre", "porte", "baie vitrée", "volet", "portail", "parquet"],
    normes: "DTU 36.1 (menuiseries bois extérieures), DTU 36.5 (fenêtres et portes-fenêtres aluminium/PVC), NF EN 14351 (performances thermiques et acoustiques).",
    mentions: "Assurance décennale obligatoire pour menuiseries extérieures (étanchéité à l'eau et à l'air). Préciser les performances sur le devis : Uw (W/m²·K) pour le thermique, Rw (dB) pour l'acoustique.",
    decomposition: "Décomposer : 1) Dépose menuiseries existantes + évacuation. 2) Fourniture (u, préciser dimensions H×L, matériau : bois/PVC/alu, vitrage : double/triple, Uw cible). 3) Pose + calfeutrement + joints périphériques. 4) Quincaillerie et serrurerie. 5) Finitions (habillage tableau, appui de fenêtre).",
    details: "Matériaux : PVC (entretien facile, Uw ≈ 1,3), aluminium (esthétique, Uw ≈ 1,6), bois (Uw ≈ 1,4). Vitrages : double vitrage 4/16/4 standard, triple vitrage 4/12/4/12/4 pour passif. Préciser ouvrant, oscillo-battant, fixe ou coulissant.",
  },
  vitrerie: {
    keywords: ["vitrerie", "vitrier", "vitrage", "miroir", "double vitrage", "miroiterie"],
    normes: "DTU 39.1 (vitrerie miroiterie), NF EN 12150 (verre trempé), NF EN 14449 (verre feuilleté). Règlement de sécurité ERP pour vitrages de sécurité.",
    mentions: "Garantie décennale pour vitrages structurels ou façades vitrées. Préciser la classe de sécurité du vitrage (feuilleté anti-effraction, anti-chute selon hauteur).",
    decomposition: "Décomposer : 1) Dépose vitrage existant + évacuation. 2) Fourniture vitrage (m² ou u, préciser composition : 4/16Ar/4 VSG, épaisseur, traitement : Low-E, feuilleté, trempé). 3) Pose + masticage ou profilerie. 4) Joints périphériques.",
    details: "Types de vitrages : simple (U = 5,8), double (U = 1,1–2,8), triple (U = 0,5–0,8). Ug (conductivité vitrage seul), Uw (conductivité fenêtre complète), Sw (facteur solaire). Feuilleté : 33.1 (anti-chute), 44.2 (anti-effraction P2A). Trempé : résistance ×5 au choc.",
  },
  sols_souples: {
    keywords: ["sols souples", "revêtement souple", "lino", "linoléum", "vinyl", "moquette", "sol pvc"],
    normes: "DTU 53.1 (revêtements de sol plastiques collés), DTU 53.2 (moquettes). Classement UPEC obligatoire pour tout sol (U = usure, P = poinçonnement, E = eau, C = chimie).",
    mentions: "Garantie biennale (2 ans) sur la pose. Contrôler le taux d'humidité du support avant pose (< 3 % pour béton, < 5 % pour anhydrite).",
    decomposition: "Décomposer : 1) Dépose + évacuation ancien revêtement. 2) Ragréage autonivelant si nécessaire (m², épaisseur). 3) Fourniture revêtement (m², préciser marque, épaisseur, classement UPEC). 4) Colle (m², type selon support). 5) Pose. 6) Profilés de finition et plinthes.",
    details: "Classements courants : U2P2E1C0 (chambre), U3P3E1C1 (séjour), U4P3E2C2 (bureau/commerce). LVT/SPC : rigide, pose flottante possible, résistant à l'eau. Vinyl en lé : pose collée obligatoire, lés de 2 ou 4 m de largeur. Épaisseur couche d'usure : 0,2 mm (résidentiel léger) à 0,7 mm (intensif).",
  },
  vrd: {
    keywords: ["vrd", "voirie", "réseau", "terrassement", "assainissement", "enrobé", "bordure", "trottoir", "canalisations"],
    normes: "DTU 12 (terrassement général). Guides techniques SETRA/Cerema pour voirie. DTU 64.1 (assainissement non collectif). Fascicule 70 (réseaux EU/EP).",
    mentions: "Déclaration de travaux ou permis de voirie selon collectivité. DT/DICT obligatoire avant tout terrassement (déclaration de travaux à proximité de réseaux). Assurance décennale pour ouvrages hydrauliques et voirie.",
    decomposition: "Décomposer : 1) Décaissement + évacuation (m³). 2) Sous-couche (m², préciser épaisseur + matériau : GNT 0/31,5, ballast). 3) Revêtement (m², préciser : enrobé ép., béton dosage, pavés dimensions). 4) Bordures/caniveaux (ml, type T2/T3/CS1). 5) Réseaux EU/EP (ml, matériau, diamètre). 6) Regards de visite (u, type). 7) MO.",
    details: "Enrobé : préciser épaisseur couche de base (BB3 ou GB) + couche de roulement (BBSG 0/10 ou 0/6). Béton voirie : C25/30, dosage 350 kg/m³, armé si > 12 cm. Assainissement : PVC ø 160 (branchement), ø 200 (collecteur). Pentes mini EU 0,5 %, EP 0,3 %.",
  },
};

// Retourne le bloc de connaissance technique pour les sous-métiers BTP détectés.
export const getBTPSubtradeContext = (tradeNames) => {
  if (!tradeNames || tradeNames.length === 0) return null;
  const joined = tradeNames.join(" ").toLowerCase();
  const matched = Object.values(BTP_SUBTRADE_KNOWLEDGE).filter(st =>
    st.keywords.some(kw => joined.includes(kw))
  );
  if (matched.length === 0) return null;
  return matched.map(st => [
    `  • Normes : ${st.normes}`,
    `  • Mentions à inclure : ${st.mentions}`,
    `  • Décomposition des lignes : ${st.decomposition}`,
    `  • Spécifications techniques : ${st.details}`,
  ].join("\n")).join("\n\n");
};

export const buildSectorContext = (sectors, vatRegime) => {
  const expertDomain = sectors.map(s => SECTOR_LABELS[s] || s).join(" et ");
  const units = [...new Set(sectors.flatMap(s => (SECTOR_UNITS[s] || SECTOR_UNITS.general).split(", ")))].join(", ");
  const pricing = sectors.map(s => SECTOR_PRICING[s] || SECTOR_PRICING.general).join("\n");
  const vocab = sectors.includes("btp") ? "travaux / ouvrages" : "prestations / services";
  const tvaContext = vatRegime === "franchise"
    ? `TVA — RÈGLE ABSOLUE : franchise en base (art. 293 B). TOUS les ouvrages ont "tva_rate": 0. Ne propose jamais d'autre taux. Ne mentionne pas la TVA dans le chat.\n💡 Mention légale document : après le </DEVIS>, rappelle UNE SEULE FOIS que le devis imprimé doit porter la mention obligatoire : "TVA non applicable, art. 293 B du CGI".`
    : (SECTOR_TVA[sectors.find(s => SECTOR_TVA[s])] || SECTOR_TVA.default);
  return { expertDomain, units, pricing, vocab, tvaContext };
};

export const SECTOR_GREETING_EXAMPLE = {
  btp:           "Ex : *Pose carrelage 40m² à 25€/m², fourniture incluse*",
  beaute:        "Ex : *Coupe + couleur femme 80€, soin visage 60€*",
  sante:         "Ex : *Séance kiné 45€ × 4, bilan posture 90€*",
  tech:          "Ex : *Site vitrine 5j × 500€/j, maintenance 2h/mois × 80€*",
  alimentaire:   "Ex : *Buffet cocktail 35€/pers × 50 pers, livraison 80€*",
  transport:     "Ex : *Déménagement T2 Paris–Lyon forfait 650€, emballage 80€*",
  communication: "Ex : *Reportage photo 8h × 120€, retouches forfait 200€*",
  evenementiel:  "Ex : *DJ soirée 6h 800€, sono & lumières forfait 400€*",
  education:     "Ex : *Cours de maths 2h/sem × 35€/h, bilan pédagogique 90€*",
  nettoyage:     "Ex : *Nettoyage bureaux 80m² × 18€/m², vitrerie 20m² × 5€/m²*",
  animaux:       "Ex : *Toilettage golden 65€, bain + séchage 30€*",
  immobilier:    "Ex : *Gestion locative 6 mois × 120€/mois, état des lieux 180€*",
  mode:          "Ex : *Ourlet pantalon 20€ × 3, retouche robe de soirée 60€*",
  general:       "Ex : *Prestation 2h × 60€/h, fourniture matériel forfait 120€*",
};

// 4 suggestions cliquables par secteur, affichées au 1er tour du chat.
// Anti-page-blanche pour les utilisateurs non-tech : 1 clic = devis rempli.
export const SECTOR_QUICKSTARTS = {
  btp:           ["Rénovation salle de bain 6 m² complète", "Pose carrelage 40 m² fourniture incluse", "Peinture 3 pièces murs + plafonds", "Isolation combles 80 m²"],
  beaute:        ["Coupe + couleur + brushing femme", "Soin visage complet 1h", "Pose ongles semi-permanente + nail art", "Forfait mariée maquillage + coiffure"],
  sante:         ["3 séances kiné + bilan initial", "Consultation ostéo adulte 1h", "Bilan nutritionnel + suivi 3 mois", "10 séances coaching sportif individuel"],
  tech:          ["Site vitrine 5 pages responsive", "Refonte logo + charte graphique", "Audit SEO complet + plan d'action", "Maintenance mensuelle site web"],
  alimentaire:   ["Buffet cocktail 50 personnes", "Plateau repas entreprise 20 pers", "Pièce montée mariage 80 parts", "Traiteur anniversaire 30 pers"],
  transport:     ["Déménagement T3 région parisienne", "Révision complète auto + vidange", "Livraison express Paris-Lyon", "Forfait VTC aéroport aller-retour"],
  communication: ["Reportage photo mariage journée", "Vidéo institutionnelle 2 min", "Shooting produit 30 visuels", "Logo + charte + carte de visite"],
  evenementiel:  ["DJ soirée 6h sono incluse", "Décoration mariage salle + cérémonie", "Animation enfants anniversaire 3h", "Prestation photo + vidéo événement"],
  education:     ["20h cours particuliers maths lycée", "Formation bureautique 2 jours", "Forfait permis B 20h + code", "Stage d'été intensif anglais"],
  nettoyage:     ["Nettoyage bureaux 200 m² hebdo", "Grand nettoyage fin de chantier", "Vitrerie immeuble 3 étages", "Désinfection locaux 300 m²"],
  animaux:       ["Toilettage complet chien moyen", "Pension chat 10 jours", "3 séances éducation canine", "Visite vétérinaire + vaccins"],
  immobilier:    ["Bilan comptable TPE annuel", "Conseil juridique création SARL", "Gestion locative 6 mois", "État des lieux entrée + sortie"],
  mode:          ["Retouche robe de mariée", "5 ourlets pantalons", "Réfection fauteuil Voltaire", "Réparation maroquinerie sac cuir"],
  general:       ["Prestation forfait journée", "10 h de consultation expert", "Intervention urgente sur site", "Pack 3 prestations + suivi"],
};

export const quickStartsFor = (brand) => {
  const tradeNames = tradesLabels(brand?.trades || []);
  const sectors = detectSectors(tradeNames, brand?.companyName || "");
  const primary = sectors[0] || "general";
  return SECTOR_QUICKSTARTS[primary] || SECTOR_QUICKSTARTS.general;
};

export const buildAgentGreeting = (brand) => {
  const tradeNames = tradesLabels(brand?.trades || []);
  const sectors = detectSectors(tradeNames, brand?.companyName || "");
  const { expertDomain } = buildSectorContext(sectors, brand?.vatRegime);
  const example = SECTOR_GREETING_EXAMPLE[sectors[0]] || SECTOR_GREETING_EXAMPLE.general;
  return `Bonjour 👋 Je suis votre assistant spécialisé en **${expertDomain}**.\n\nDécrivez votre besoin ligne par ligne, dans la langue de votre choix (français, arabe, darija, espagnol, anglais, portugais…). Je rédige le devis en français professionnel.\n\n${example}`;
};
