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
  btp:           "Prix réalistes BTP France 2025. Ex : main-d'œuvre élec 45-65 €/h, pose carrelage 30-50 €/m², isolation combles 20-40 €/m².",
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
  immobilier:    "Honoraires France 2025. Ex : gestion locative 5-10%/mois, expertise comptable 80-200 €/h, consultant juridique 150-400 €/h.",
  mode:          "Tarifs couture France 2025. Ex : retouche simple 10-30 €, ourlet 15-25 €, robe sur-mesure 200-800 €.",
  general:       "Tarifs du marché France 2025. Adapte les prix, les unités et le vocabulaire au métier exact déclaré par l'utilisateur, en t'appuyant sur ta connaissance professionnelle de ce métier (tarifs pratiqués, conventions, spécificités). Évite toute réponse générique.",
};

export const SECTOR_TVA = {
  btp: `TVA : applique le taux correct par ouvrage selon la réglementation française :
- 5.5% : travaux d'amélioration énergétique (isolation, PAC, fenêtres dans logement >2 ans).
- 10% : entretien/rénovation/amélioration dans logement d'habitation >2 ans.
- 20% : neuf, gros œuvre, locaux professionnels, fournitures sans pose.`,
  alimentaire: `TVA :
- 5.5% : produits alimentaires de base (pain, épicerie, pâtisserie non luxe).
- 10% : restauration, plats cuisinés, traiteur.
- 20% : boissons alcoolisées, confiseries, chocolat.`,
  sante: `TVA : 20% pour les soins non remboursés (coaching, naturopathie, nutrition). Actes paramédicaux conventionnés : tva_rate 0. En cas de doute, applique 20%.`,
  nettoyage: `TVA : 10% pour les services à la personne à domicile (résidence principale). 20% pour locaux professionnels.`,
  default: `TVA : 20% par défaut pour les prestations de services en France.`,
};

export const buildSectorContext = (sectors, vatRegime) => {
  const expertDomain = sectors.map(s => SECTOR_LABELS[s] || s).join(" et ");
  const units = [...new Set(sectors.flatMap(s => (SECTOR_UNITS[s] || SECTOR_UNITS.general).split(", ")))].join(", ");
  const pricing = sectors.map(s => SECTOR_PRICING[s] || SECTOR_PRICING.general).join("\n");
  const vocab = sectors.includes("btp") ? "travaux / ouvrages" : "prestations / services";
  const tvaContext = vatRegime === "franchise"
    ? `TVA — RÈGLE ABSOLUE : franchise en base (art. 293 B). TOUS les ouvrages ont "tva_rate": 0. Ne propose jamais d'autre taux. Ne mentionne pas la TVA dans le chat.`
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

export const buildAgentGreeting = (brand) => {
  const tradeNames = tradesLabels(brand?.trades || []);
  const sectors = detectSectors(tradeNames, brand?.companyName || "");
  const { expertDomain } = buildSectorContext(sectors, brand?.vatRegime);
  const example = SECTOR_GREETING_EXAMPLE[sectors[0]] || SECTOR_GREETING_EXAMPLE.general;
  return `Bonjour 👋 Je suis votre assistant spécialisé en **${expertDomain}**.\n\nDécrivez votre besoin ligne par ligne, dans la langue de votre choix (français, arabe, darija, espagnol, anglais, portugais…). Je rédige le devis en français professionnel.\n\n${example}`;
};
