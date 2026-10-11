---
name: Zenbat
description: Devis et factures pour artisans du bâtiment, dictés puis rédigés par l'IA.
colors:
  paper: "#FBFAF7"
  paper-2: "#F3F0E9"
  sheet: "#FFFFFF"
  ink: "#1A1612"
  ink-2: "#5C544B"
  ink-3: "#6E655B"
  rule: "#D9D2C5"
  rule-soft: "#ECE7DE"
  terre-cuite: "#A4461F"
  terre-cuite-deep: "#8E3B19"
  terre-cuite-soft: "#F6E7DF"
  stamp-green: "#1E7B3C"
  stamp-green-soft: "#E3F1E7"
  danger: "#B42318"
  danger-soft: "#FBE9E7"
  warn-ochre: "#8A5A00"
  warn-ochre-soft: "#FBF0D9"
  on-ink: "#F3F0E9"
  on-ink-2: "#A89E92"
typography:
  total:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  lot:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    letterSpacing: "0.04em"
  body:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
components:
  button-primary:
    backgroundColor: "{colors.terre-cuite}"
    textColor: "{colors.sheet}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.terre-cuite-deep}"
  button-text:
    textColor: "{colors.terre-cuite}"
    height: "48px"
  sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.md}"
    padding: "18px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "48px"
  mic-button:
    backgroundColor: "{colors.terre-cuite}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.pill}"
    size: "56px"
  mic-button-active:
    backgroundColor: "{colors.danger}"
---

# Design System: Zenbat

## Overview

**Creative North Star: "Le Bordereau"**

L'écran est le document. Un devis Zenbat se présente comme un bordereau de prix posé sur le papier : en-tête de l'entreprise, objet, lots tracés au filet, désignations à gauche, montants à droite, total TTC souligné d'un double trait. Ce que l'artisan dicte s'y inscrit ligne par ligne. Rien ne ressemble à une messagerie : l'IA parle par une note courte sous le document, l'historique s'ouvre à la demande.

Le monde est celui du papier et de l'encre : un fond papier chaud, une feuille blanche, une encre brun-noir, des filets fins, et une seule couleur d'action, la terre cuite. Le vert tampon est réservé à ce qui est acquis (signé, payé, enregistré). La densité est celle d'un document de travail lisible au soleil sur un chantier : 15 px minimum pour les lignes, 16 px dans les champs, cibles de 44 px au moins.

L'application parle à l'artisan (tutoiement) ; les documents qu'il envoie restent à son identité (logo, couleur, vouvoiement du client). La couleur choisie par l'artisan ne colore jamais l'interface.

**Key Characteristics:**
- Une feuille sur du papier, des filets plutôt que des cartes.
- Montants en chiffres tabulaires, alignés à droite, toujours en encre.
- Une seule couleur d'action (terre cuite) par écran, sur l'action principale et le micro.
- Les lignes s'inscrivent (fondu de gauche à droite), le total monte.
- Mouvement réduit respecté partout.

## Colors

Papier chaud, encre brun-noir, une terre cuite pour agir, un vert tampon pour ce qui est acquis.

### Primary
- **Terre cuite** (terre-cuite) : l'action principale de l'écran (« Enregistrer le devis »), le micro au repos, les liens d'action (« Ajouter une ligne », « Historique »), la sélection, l'anneau de focus, l'onglet actif et les pastilles de compteur (« à traiter »). Survol : terre cuite profonde. Fond de sélection : terre cuite pâle.

### Secondary
- **Vert tampon** (stamp-green) : état acquis (devis signé, facture payée, retour enregistré, « Merci »). Jamais pour une action.

### Neutral
- **Papier** (paper) : fond de toutes les pages et de la barre de dictée.
- **Papier gris** (paper-2) : second plan (survol d'une ligne, panneaux).
- **Feuille** (sheet) : le document posé sur le papier, les champs.
- **Encre** (ink) : texte, montants, filet sous les colonnes et sous la barre du haut, double trait du total, barre du bas et barre latérale (ordinateur).
- **Sur encre** (on-ink) et **sur encre 2** (on-ink-2) : texte actif et texte au repos sur les barres encre.
- **Encre 2** (ink-2) : texte secondaire (date, sous-ligne « qté × PU », libellés de colonnes).
- **Encre 3** (ink-3) : indications et valeurs vides (placeholder, total à 0,00 €, trait de plume).
- **Filet** (rule) et **filet léger** (rule-soft) : séparations de lots et de lignes, bordures de champs.

### Semantic
- **Rouge** (danger) : erreur de l'IA, micro en écoute (bouton stop), confirmation d'effacement.
- **Ocre** (warn-ochre) : uniquement une ligne « à chiffrer » (prix manquant).

### Named Rules
**The One Action Rule.** La terre cuite marque une seule action principale par écran ; les autres actions sont du texte terre cuite ou de l'encre.

**The Red Means Wrong Rule.** Le rouge signale une erreur, un refus, une écoute en cours ou une suppression à confirmer, jamais un simple compteur ; un compteur « à traiter » est une pastille terre cuite.

**The Interface Is Not The Brand Rule.** La couleur de l'artisan (brand.color) reste sur ses PDF et sa page de signature client ; l'interface garde la terre cuite.

## Typography

**Display Font:** Archivo Variable (auto-hébergée, axe de largeur), avec system-ui en secours
**Body Font:** Archivo Variable

**Character:** une grotesque de chantier, robuste et un peu large, qui tient aussi bien les gros totaux que les petites sous-lignes. Une seule famille pour toute l'interface.

### Hierarchy
- **Total** (700, 28px, -0.01em, chiffres tabulaires) : le total TTC du devis.
- **Headline** (700, 21px, 1.25) : l'objet du devis, sur deux lignes si besoin.
- **Title** (700, 16px) : libellés forts (Total TTC, bouton principal).
- **Lot** (700, 14px, 0.04em, capitales) : titre de lot, sous-total dans la marge en 15px/700 encre.
- **Body** (500, 15px, 1.35–1.45) : désignations, note de l'IA (14px), historique.
- **Label** (600, 13px) : en-têtes de colonnes, sous-lignes, statut sous la barre de dictée. Rien sous 12px.

### Named Rules
**The Tabular Money Rule.** Tout montant est en chiffres tabulaires (`font-variant-numeric: tabular-nums`, helper `NUM` de `src/lib/theme.js`), aligné à droite, en encre.

## Layout

Une colonne de document centrée (largeur max 760px) avec 12–18px de marge sur téléphone. La feuille a 18px de rembourrage ; les lignes 12px verticalement, 56px de hauteur mini. En-tête de colonnes avec filet encre de 2px ; lots séparés par un filet, lignes par un filet léger.

La barre de dictée est fixe, collée au-dessus de la barre de navigation (ou du clavier) : bouton langue 48px, champ 48px qui grandit jusqu'à 120px, micro 56px. Pendant la rédaction, une bande « Total TTC en cours » reste collée au bas de la feuille. Sur ordinateur, la même colonne, plus aérée ; aucune mise en page spécifique au bureau pour l'instant.

## Elevation & Depth

Plat. La profondeur vient des filets et du contraste papier / feuille, pas des ombres. Seules exceptions : les menus flottants (liste des langues) portent une ombre douce `0 10px 30px rgba(26,22,18,.16)` pour se détacher du document.

### Named Rules
**The Ruled Not Raised Rule.** On sépare par un filet, jamais par une ombre ou un halo ; une carte arrondie dans une carte est exclue.

## Shapes

Coins doux et sobres : 8px pour la feuille et les champs, 10px pour les boutons pleins, 6px pour les petits éléments, cercle pour le micro. Les lignes du bordereau n'ont pas de coins : ce sont des rangées tracées. Le total TTC est souligné d'un double trait de 3px.

## Components

### Buttons
- **Shape:** coins de 10px, 52px de haut pour l'action principale.
- **Primary:** fond terre cuite, texte blanc 16px/700, pleine largeur sur téléphone.
- **Hover / Focus:** terre cuite profonde au survol ; focus = anneau terre cuite 2px décalé de 2px.
- **Text:** « Ajouter une ligne », « Historique » : texte terre cuite 15px/600 sans fond, 44–48px de cible.
- **Destructive:** « Tout effacer » en encre 2 ; premier appui → « Appuie encore pour tout effacer » en rouge, annulé après 4 s.

### Inputs / Fields
- **Style:** fond feuille, filet de 1px, coins de 8px, texte 16px (pas de zoom iOS).
- **Focus:** la bordure passe en terre cuite.
- **Error / Active:** bordure rouge pendant l'écoute du micro.

### Navigation
- **Barre du haut :** fond papier, titre de l'écran en 22px/700 à gauche (« Devis », « Factures »…), indicateur d'enregistrement (vert tampon une fois enregistré) et bouton menu 44px à droite ; filet encre de 2px dessous. En PWA iOS, une bande encre de la hauteur de la barre d'état reste au-dessus (l'heure s'écrit en blanc). Les écrans ne répètent pas ce titre.
- **Bandeau de quota (gratuit) :** papier gris sous la barre du haut, « N devis sur 5 cette semaine. » en encre 2 et lien terre cuite « Passer en Pro » ; fond rouge pâle une fois la limite atteinte.
- **Barre du bas (téléphone) :** 5 onglets encre (Accueil, Clients, Agent IA, Devis, Factures), libellés 12px sur encre 2, actif en blanc avec un trait terre cuite qui glisse en haut ; bouton central « Agent IA » en disque terre cuite cerné d'un anneau de la couleur de la barre, sans halo ; pastilles de compteur terre cuite.
- **Barre latérale (ordinateur, 1024px et plus) :** même encre, rangées de 44px, actif en blanc gras souligné terre cuite sur un fond légèrement éclairci, pastilles terre cuite.
- **Menu :** panneau feuille avec l'ombre des menus flottants, rangées de 44px avec icône 22px, déconnexion en rouge.

### Bordereau (signature)
La feuille du devis : en-tête (logo ou nom, « Devis · date », réglages de vérification des prix), objet modifiable, colonnes « Désignation / Montant HT », lots en capitales avec sous-total dans la marge, chaque ligne avec sa sous-ligne « qté unité × PU · TVA » et ouverte à l'édition d'un appui. Pendant la rédaction : lignes vierges réglées avec un trait de plume, puis les lignes s'inscrivent une à une (fondu de gauche à droite, 320ms) et les sous-totaux montent. Vide : trois exemples du métier comme lignes, total à 0,00 €.

### Fiche devis (signature)
Le devis se lit comme le document du client : le même bordereau que l'Agent IA (pièces partagées dans `src/components/bordereau/parts.jsx`), en-tête avec le numéro, la date et le **tampon de statut**, ligne client (« Changer »), objet, lieu du chantier. Un appui sur une ligne ou un titre de lot l'ouvre à l'édition (monter, descendre, supprimer en deux appuis). Un devis signé ne se modifie plus.
- **Tampon :** capitales 13px/800 espacées, double filet de 4px, penché de -3°. Encre 3 pour brouillon et remplacé, encre 2 pour envoyé, encre pour « À signer » et « Modifications demandées », vert tampon pour « Signé », rouge pour « Refusé ».
- **Barre d'action :** collée en bas de l'écran (au pouce), une seule action terre cuite selon le statut : « Envoyer au client » (brouillon), « Relancer {client} » (envoyé, à signer), « Facturer » (signé). Envoyer, relancer et les statuts posés à la main passent par une confirmation dans la barre, qui nomme le destinataire et le montant TTC. Les actions rares sont dans le menu « ⋯ ».

### Barre de dictée (signature)
Note de l'IA (3 lignes max, pouces haut / bas, « Historique »), langue, champ, micro. Un appui démarre, un second arrête et envoie ; en écoute le micro devient un carré stop rouge qui pulse.

## Do's and Don'ts

### Do:
- **Do** passer par les variables `--zb-*` de `src/index.css` ou l'objet `ZB` de `src/lib/theme.js`, jamais une couleur en dur.
- **Do** afficher les montants en encre, chiffres tabulaires, alignés à droite.
- **Do** tutoyer l'artisan dans l'interface, et garder le vouvoiement dans ce qui part chez le client.
- **Do** garder des cibles de 44px minimum et du texte de 12px minimum.
- **Do** prévoir `prefers-reduced-motion` pour chaque animation.

### Don't:
- **Don't** afficher la conversation en bulles de chat ; l'IA parle par une note courte.
- **Don't** poser d'ombre décorative ni de halo coloré ; séparer par des filets.
- **Don't** utiliser la couleur de l'artisan dans l'interface.
- **Don't** utiliser l'ocre ailleurs que pour une ligne à chiffrer, ni le vert pour une action.
- **Don't** recopier un calcul de montant : `src/lib/invoiceCalc.js` est la seule source.
