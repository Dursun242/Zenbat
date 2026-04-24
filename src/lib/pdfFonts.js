// Configuration des fontes pour le PDF natif.
//
// On utilise les fontes PDF built-in (Helvetica / Times) plutôt que les
// fontes brand (DM Sans / Playfair / Space Grotesk) parce que les .woff2
// de @fontsource déclenchent "Out of bounds access" dans le décodeur de
// fontkit/react-pdf en bundle Vite. Helvetica/Times sont garanties dans
// tous les lecteurs PDF, sans round-trip réseau.
//
// Astuce : Font.register avec un src parmi STANDARD_FONTS (Helvetica,
// Helvetica-Bold, Times-Roman, Times-Bold...) court-circuite fontkit et
// utilise les fontes natives PDFKit. Ça nous permet de mapper les poids
// (400/700) vers les bonnes variantes built-in, donc le `fontWeight`
// dans les styles continue de fonctionner naturellement.
import { Font } from "@react-pdf/renderer";

let registered = false;

export function ensurePdfFontsRegistered() {
  if (registered) return;
  registered = true;

  Font.register({
    family: "Helvetica",
    fonts: [
      { src: "Helvetica",      fontWeight: 400 },
      { src: "Helvetica",      fontWeight: 500 },
      { src: "Helvetica-Bold", fontWeight: 600 },
      { src: "Helvetica-Bold", fontWeight: 700 },
      { src: "Helvetica-Bold", fontWeight: 800 },
    ],
  });

  Font.register({
    family: "Times-Roman",
    fonts: [
      { src: "Times-Roman", fontWeight: 400 },
      { src: "Times-Bold",  fontWeight: 700 },
    ],
  });

  // Désactive la césure auto : on garde le comportement HTML (wrap par mots).
  Font.registerHyphenationCallback((word) => [word]);
}

export function pdfFontFamily(brand) {
  if (brand?.fontStyle === "elegant") return "Times-Roman";
  // "modern" et "tech" : Helvetica donne un rendu sans-serif net,
  // proche visuellement de DM Sans / Space Grotesk.
  return "Helvetica";
}
