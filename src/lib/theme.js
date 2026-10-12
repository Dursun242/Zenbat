// Système « Bordereau » côté JS : mêmes valeurs que les variables CSS --zb-*
// de src/index.css. À utiliser quand une couleur doit être manipulée en JS
// (transparence ajoutée, prop d'un composant qui concatène un suffixe hex) ;
// sinon préférer var(--zb-…) dans les styles.
//
// La couleur choisie par l'artisan (brand.color) ne colore jamais l'interface :
// elle reste réservée à ses documents (PDF, page de signature client).
export const ZB = {
  paper:      "#FBFAF7",
  paper2:     "#F3F0E9",
  sheet:      "#FFFFFF",
  ink:        "#1A1612",
  ink2:       "#5C544B",
  ink3:       "#6E655B",
  rule:       "#D9D2C5",
  ruleSoft:   "#ECE7DE",
  field:      "#8F857A",  // bordure des champs de saisie (3,6:1 sur la feuille, 3,5:1 sur le papier)
  accent:     "#A4461F",
  accentSoft: "#F6E7DF",
  stamp:      "#1E7B3C",
  stampSoft:  "#E3F1E7",
  danger:     "#B42318",
  dangerSoft: "#FBE9E7",
  warn:       "#8A5A00",
  warnSoft:   "#FBF0D9",
  onInk:      "#F3F0E9",  // texte sur les barres encre
  onInk2:     "#A89E92",  // texte secondaire sur les barres encre (6,6:1)
  font:       "var(--zb-font)",
};

// Montants : chiffres tabulaires pour que les colonnes s'alignent.
export const NUM = { fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum" 1' };
