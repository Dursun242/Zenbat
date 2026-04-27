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
  beaute: `PRIX BEAUTÉ ET BIEN-ÊTRE FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Si un prix est sous les minimums ci-dessous, CORRIGE avant d'émettre le JSON.
Coiffure : coupe femme (shampooing+coupe+brushing) 35–80 € | coupe homme 15–35 € | couleur complète 60–130 € | balayage / ombre hair 80–250 € | coupe+couleur+brushing 90–250 € | lissage brésilien 120–300 € | permanente 80–200 €
Onglerie : pose ongles gel 50–100 € | semi-permanent 35–70 € | nail art 5–20 €/ongle | extension cils volume russe 120–250 € | retouche cils 40–90 €
Épilation : jambes complètes 40–80 € | maillot brésilien 25–55 € | aisselles 15–30 € | visage 15–40 €
Soins : soin visage 1h 60–120 € | massage relaxant 1h 70–130 € | massage sportif 70–120 € | gommage corps 80–150 €
Forfaits : forfait mariée (coiffure + maquillage) 200–500 € | maquillage événementiel 80–200 €`,

  sante: `PRIX SANTÉ ET PARAMÉDICAL FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Si un prix est sous les minimums ci-dessous, CORRIGE avant d'émettre le JSON.
Séances individuelles : kiné non conventionné 40–80 €/séance | ostéopathie 60–100 € | naturopathie 60–120 € | diététique / nutrition 60–90 € | psychologue 60–120 € | sophrologie 50–90 €
Coaching / sport : coaching sportif individuel 50–100 €/h | séance collective 15–35 €/pers | bilan forme complet 90–200 €
Forfaits : suivi 10 séances kiné 400–800 € | programme coaching 3 mois (12 séances) 600–1 800 € | coaching nutrition 3 mois 400–1 200 € | formation 1 jour (8h) 500–1 500 €`,

  tech: `PRIX TECH ET NUMÉRIQUE FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Si un TJM ou forfait est sous les minimums ci-dessous, CORRIGE avant d'émettre le JSON.
TJM (taux journalier moyen) : dev web junior 350–500 €/j | dev web senior 600–950 €/j | dev mobile (iOS/Android) 550–1 000 €/j | designer UI/UX 350–700 €/j | graphiste 300–550 €/j | chef de projet digital 500–850 €/j | consultant SEO/SEA 400–800 €/j | data scientist 600–1 000 €/j | community manager 200–450 €/j
Forfaits projets : site vitrine 5 pages 1 500–5 000 € | site e-commerce 5 000–25 000 € | application mobile native 15 000–80 000 € | logo simple 300–1 200 € | charte graphique complète 1 000–6 000 € | audit SEO 500–3 000 € | maintenance mensuelle 150–600 €/mois`,

  alimentaire: `PRIX ARTISANAT ALIMENTAIRE ET RESTAURATION FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Si un prix est sous les minimums ci-dessous, CORRIGE avant d'émettre le JSON.
Traiteur / restauration : buffet cocktail dinatoire 25–60 €/pers | plateau repas entreprise 12–30 €/pers | menu gastronomique servi 45–150 €/pers | brunch traiteur 25–50 €/pers | apéritif dinatoire 20–45 €/pers | personnel de service 25–40 €/h
Pâtisserie : gâteau anniversaire sur-mesure 4–10 €/part (min 20 parts) | wedding cake / pièce montée 400–3 000 € | macaron 1,50–3 €/pièce | pain artisanal 6–15 €/kg | viennoiserie 1–3 €/u
Livraison / logistique : livraison IDF 50–150 € | location vaisselle 100 couverts 200–500 €`,

  transport: `PRIX TRANSPORT ET AUTOMOBILE FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Si un prix est sous les minimums ci-dessous, CORRIGE avant d'émettre le JSON.
Déménagement : studio (< 30 m²) 400–900 € | T2 (30–50 m²) 700–1 400 € | T3 (50–80 m²) 1 000–2 200 € | T4+ 1 500–4 000 € | taux horaire (MO + camion) 80–150 €/h | carton 3–6 €/u
VTC / Taxi : mise à disposition 1h 50–100 € | transfert aéroport 30 km 50–100 €
Mécanique auto : MO atelier 80–130 €/h | vidange + filtre 80–200 € | révision complète 300–800 € | embrayage fourni posé 600–1 500 € | distribution fournie posée 500–1 200 € | pneumatique (pneu+montage+équil.) 80–250 €/u
Vitrage auto : remplacement pare-brise fourni posé 200–600 € | réparation impact 60–130 €`,

  communication: `PRIX COMMUNICATION ET CRÉATIF FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Si un prix est sous les minimums ci-dessous, CORRIGE avant d'émettre le JSON.
Photographie : reportage événementiel demi-journée 400–900 € | reportage journée 700–1 800 € | mariage journée (galerie incluse) 1 200–3 500 € | shooting produit 30 visuels 400–1 200 € | portrait pro 10 retouches 150–500 € | drone demi-journée 500–1 500 €
Vidéo : vidéo institutionnelle 2 min 1 500–6 000 € | clip musical 1 500–8 000 € | reel / vidéo sociale 300–1 200 €/u
Design : logo (3 propositions + déclinaisons) 500–2 500 € | charte graphique complète 1 000–6 000 € | flyer A5 recto-verso 150–500 € | plaquette 8 pages 500–2 000 €
Rédaction / copywriting : article blog 800 mots 80–300 € | page web 150–500 € | email marketing 100–400 €`,

  evenementiel: `PRIX ÉVÉNEMENTIEL ET ANIMATION FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Si un prix est sous les minimums ci-dessous, CORRIGE avant d'émettre le JSON.
Musique / Son : DJ soirée 6h (sono+lumières) 600–2 000 € | DJ sans sono 300–1 200 € | groupe live 3h 800–3 000 € | cocktail musical 2h 400–1 200 € | location sono+lumières+technicien 500–2 000 €
Mariage / réception : wedding planner coordination journée 1 500–5 000 € | décoration florale salle+cérémonie 1 000–6 000 € | photo+vidéo mariage journée 2 000–5 500 € | photographe seul journée 1 200–3 500 €
Animation enfants : animateur 3h 300–700 € | magicien 1h30 200–500 € | structures gonflables demi-journée 150–400 €
Corporate : animateur soirée entreprise 500–1 500 € | team building 2h 20 pers 600–2 000 €`,

  education: `PRIX ENSEIGNEMENT ET FORMATION FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Si un prix est sous les minimums ci-dessous, CORRIGE avant d'émettre le JSON.
Cours particuliers : primaire/collège 20–40 €/h | lycée (toutes matières) 25–60 €/h | prépa/BTS/université 35–80 €/h | langues (FLE, anglais…) 25–60 €/h | cours de musique/dessin 30–70 €/h | forfait mensuel 8h 180–450 €
Auto-école : forfait permis B (20h conduite + code) 1 200–2 500 € | heure de conduite 50–80 €/h | code en ligne 30–100 €
Formation professionnelle : journée formateur (8h) 500–1 800 €/j | module e-learning 100–800 €/module
Coaching : coaching carrière / bilan compétences 80–200 €/h | stage intensif anglais 5 jours 500–2 000 €`,

  nettoyage: `PRIX NETTOYAGE ET ENTRETIEN FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Si un prix est sous les minimums ci-dessous, CORRIGE avant d'émettre le JSON.
Ménage courant : domicile particulier 15–30 €/h | haut de gamme / conciergerie 25–50 €/h | bureaux/locaux pro 18–35 €/h | forfait mensuel bureaux 100 m² 200–600 €/mois
Vitrerie : intérieure 1 face 3–8 €/m² | façade (nacelle) 8–20 €/m²
Grand nettoyage / fin de chantier : remise en état après travaux 8–18 €/m² | grand ménage fin de bail 70 m² 400–900 € | nettoyage fin de chantier 200 m² 1 000–3 000 €
Prestations spéciales : désinfection/désinsectisation 100 m² 200–800 € | dératisation 150–500 € | nettoyage après sinistre 40–150 €/m² | ramonage cheminée 1 conduit 80–180 €`,

  animaux: `PRIX SERVICES ANIMALIERS FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Si un prix est sous les minimums ci-dessous, CORRIGE avant d'émettre le JSON.
Toilettage : petit chien (< 10 kg) 40–75 € | chien moyen (10–25 kg) 60–100 € | grand chien (> 25 kg) 80–140 € | bain+séchage seul 25–55 € | coupe des griffes 10–25 €
Pension : chien journée 20–45 € | chien nuit 25–55 € | chat journée 15–30 € | pet-sitting 1 visite 30 min 15–30 € | dog-sitting nuit domicile 40–80 €
Éducation : séance individuelle 1h 50–90 € | cours collectif 6 pers 20–40 €/pers | bilan comportemental 80–160 € | forfait 10 séances 400–800 €
Vétérinaire : consultation 35–80 € | vaccination annuelle 50–120 € | stérilisation chatte 150–350 € | stérilisation chien 200–450 €`,

  immobilier: `PRIX IMMOBILIER, COMPTABILITÉ ET CONSEIL FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Si un prix est sous les minimums ci-dessous, CORRIGE avant d'émettre le JSON.
Expertise comptable : bilan TPE (CA < 300 K€) 1 500–5 000 €/an | bilan SA/SAS (CA > 300 K€) 4 000–15 000 €/an | tenue comptabilité 100–500 €/mois | conseil fiscal 150–400 €/h | création d'entreprise (dossier complet) 500–2 000 €
Juridique : consultation avocat 150–500 €/h | rédaction contrat commercial 500–3 000 € | médiation / arbitrage 200–600 €/h
Gestion patrimoine / immobilier : bilan patrimonial 300–1 500 € | gestion locative 5–12 % loyer/mois | état des lieux entrée ou sortie 120–300 € | mandat de gestion annuel 500–2 000 €`,

  mode: `PRIX COUTURE, RETOUCHE ET TEXTILE FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Si un prix est sous les minimums ci-dessous, CORRIGE avant d'émettre le JSON.
Retouches simples : ourlet pantalon 12–28 € | ourlet robe/jupe 15–35 € | cintre veste (reprise épaules) 30–80 € | pose fermeture éclair 20–55 € | rétrécissement manche 25–60 €
Retouches élaborées : reprise robe de mariée 100–500 € | transformation silhouette 80–300 € | reprise costume sur-mesure 50–200 €
Sur-mesure : robe cocktail 250–1 000 € | robe de mariée 800–5 000 € | costume homme 600–3 000 € | pantalon sur-mesure 200–600 €
Maroquinerie / Sellerie : réparation sac cuir 30–100 € | teinture cuir 50–150 € | remplacement poignées 40–120 € | réfection fauteuil Voltaire 300–1 200 € | sellerie siège auto 150–500 €/siège`,

  general: `PRIX DU MARCHÉ FRANCE 2025 — vérifier chaque tarif avant d'émettre :
⚠ Adapte les prix, les unités et le vocabulaire au métier exact déclaré. Si un prix paraît trop bas par rapport aux tarifs pratiqués dans ce secteur en France, CORRIGE-le avant d'émettre.
Évite toute réponse générique : fais appel à ta connaissance précise du métier concerné (tarifs pratiqués, conventions, charges, valeur marché).`,

  btp: `PRIX BTP FRANCE 2025 — BENCHMARKS OBLIGATOIRES :

⚠ VÉRIFICATION ANTI-SOUS-CHIFFRAGE (calcul mental AVANT d'émettre le JSON) :
Divise ton total HT par la surface du projet. Si le résultat est sous les minimums ci-dessous, AUGMENTE les prix unitaires — un devis trop bas est une erreur professionnelle grave.

FOURCHETTES GLOBALES €/m² HT selon type de chantier :
• Extension clé en main (fondations + maçonnerie + charpente + couverture + menuiseries + élec + plomberie + carrelage + peinture) : 1 400–2 200 €/m²
• Extension gros œuvre + enveloppe uniquement (hors finitions intérieures) : 900–1 400 €/m²
• Construction neuve maison individuelle (hors terrain, hors VRD) : 1 200–2 000 €/m²
• Surélévation structure bois : 1 800–3 000 €/m²
• Rénovation complète tout corps d'état : 800–1 500 €/m²
• Rénovation cosmétique (peinture + sols + sanitaire) : 300–700 €/m²
• ITE + ravalement : 100–220 €/m² de façade
• Toiture complète (dépose + repose) : 80–250 €/m² de surface toiture
• Salle de bain complète (≈ 6 m²) : 5 000–15 000 € HT selon gamme

TARIFS UNITAIRES PAR CORPS D'ÉTAT (MO + mat sauf mention) :
Gros œuvre / maçonnerie :
  Terrassement fouilles en rigole : 20–50 €/m³
  Béton de propreté dosé 150 kg/m³ : 60–110 €/m²
  Fondations béton armé semelles filantes : 150–320 €/ml | dalle BA : 80–170 €/m²
  Maçonnerie parpaings 20 cm élévation : 80–160 €/m² mur
  Brique monomur 37 cm : 110–210 €/m²
  Chaînages horizontaux HA10 : 25–60 €/ml
  Appuis de fenêtre préfabriqués : 30–75 €/ml
  Enduit monocouche extérieur gratté : 25–55 €/m²
  Remblai compacté : 15–40 €/m³

Charpente :
  Traditionnelle (sapin traité) fournie posée : 65–140 €/m² toiture
  Fermettes industrielles : 35–75 €/m²
  Ossature bois extension : 110–220 €/m²

Couverture :
  Tuiles mécaniques avec litteau + écran HPV + pose : 45–90 €/m²
  Ardoise naturelle posée : 90–200 €/m²
  Zinc joint debout : 110–220 €/m²
  Zinguerie (faîtage, rives, noues, chéneaux) : 40–100 €/ml

Menuiseries extérieures PVC DV fournie + posée :
  Fenêtre 100×120 cm : 350–750 €/u
  Porte-fenêtre 2 vantaux 200×240 cm : 650–1 500 €/u
  Porte d'entrée : 800–2 800 €/u

Électricité :
  Main-d'œuvre : 45–75 €/h
  Installation complète maison neuve : 80–170 €/m² (tableau + réseaux + appareillage)

Plomberie / Chauffage :
  Main-d'œuvre : 50–85 €/h
  Réseau cuivre fourni posé : 30–65 €/ml
  Salle de bain complète équipée (fourniture + pose) : 4 500–12 000 €

Isolation :
  Combles perdus soufflés R ≥ 7 : 22–50 €/m²
  Rampants R ≥ 6 : 35–85 €/m²
  Plancher bas R ≥ 3 : 20–55 €/m²

Carrelage / revêtements : fourniture + pose gamme courante : 45–95 €/m² | ragréage 15–35 €/m²

Peinture intérieure 2 couches (préparation incluse) : 14–32 €/m² mur

⚠ RÈGLE "CLÉ EN MAIN" : Si la demande précise "clé en main", "tout compris" ou "livré prêt à habiter", le devis DOIT inclure TOUS les corps d'état : fondations, maçonnerie, charpente, couverture, menuiseries, isolation, électricité, plomberie/sanitaire, carrelage, peinture. Omettre un corps d'état sur un "clé en main" est une erreur professionnelle qui peut engager la responsabilité de l'artisan.`,
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
  btp: `TVA BTP — 3 taux légaux + autoliquidation sous-traitance :

▸ 5,5 % (art. 278-0 bis A CGI) — Amélioration énergétique dans logement d'habitation achevé depuis > 2 ans :
  Isolation thermique (combles, murs, plancher bas), PAC (air/air, air/eau, géothermique), chaudière biomasse, chauffe-eau thermodynamique, panneaux solaires thermiques, VMC double flux, fenêtres et portes-fenêtres double/triple vitrage, volets isolants. RGE souvent exigé pour accès aux aides clients.

▸ 10 % (art. 279-0 bis CGI) — Rénovation/entretien dans logement d'habitation achevé depuis > 2 ans :
  Tous les autres travaux : plomberie, électricité, peinture, carrelage, couverture, maçonnerie d'entretien, menuiserie de remplacement (hors critères énergétiques), sanitaire, charpente de réfection. Les fournitures incluses dans la même facture sont aussi à 10 % si elles ne dépassent pas 30 % du prix total HT.

▸ 20 % — Taux normal :
  Construction neuve, extension, surélévation, locaux à usage professionnel/commercial, logement achevé depuis < 2 ans, fournitures vendues sans pose, modification de structure portante. Maçonnerie de gros œuvre même sur bâtiment existant si elle crée de la surface ou modifie la structure.

⚠ Règle des 30 % : si les fournitures dépassent 30 % du prix total HT, facturer les fournitures à 20 % et la main-d'œuvre au taux réduit applicable. Séparer en lots distincts dans le JSON.
⚠ Attestation simplifiée : le client doit remettre une attestation certifiant que le local est un logement à usage d'habitation achevé depuis > 2 ans. Sans attestation signée, applique 20 % par défaut.
⚠ Autoliquidation sous-traitance (art. 283-2 nonies CGI) : si le client est lui-même un assujetti TVA (entreprise, autre artisan, promoteur) et que tu interviens en tant que sous-traitant, la TVA est autoliquidée par le donneur d'ordre. Dans ce cas : tva_rate = 0 sur TOUTES les lignes ET ajoute la mention "Autoliquidation de la TVA — art. 283-2 nonies CGI. TVA due par le preneur assujetti." dans le champ objet ou dans un lot de type commentaire.

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
