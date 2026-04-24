// Enregistrement des polices Google pour @react-pdf/renderer.
// Vite bundle les .woff2 de @fontsource via `?url` → asset local servi par
// l'app, donc pas de dépendance CDN à l'exécution. fontkit (utilisé par
// react-pdf) sait décoder le woff2 nativement.
import { Font } from "@react-pdf/renderer";

import dmSans400  from "@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2?url";
import dmSans500  from "@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2?url";
import dmSans600  from "@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff2?url";
import dmSans700  from "@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2?url";
import dmSans800  from "@fontsource/dm-sans/files/dm-sans-latin-800-normal.woff2?url";

import playfair700 from "@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url";

import grotesk400 from "@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?url";
import grotesk600 from "@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff2?url";
import grotesk700 from "@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2?url";

let registered = false;

export function ensurePdfFontsRegistered() {
  if (registered) return;
  registered = true;

  Font.register({
    family: "DM Sans",
    fonts: [
      { src: dmSans400, fontWeight: 400 },
      { src: dmSans500, fontWeight: 500 },
      { src: dmSans600, fontWeight: 600 },
      { src: dmSans700, fontWeight: 700 },
      { src: dmSans800, fontWeight: 800 },
    ],
  });

  Font.register({
    family: "Playfair Display",
    fonts: [{ src: playfair700, fontWeight: 700 }],
  });

  Font.register({
    family: "Space Grotesk",
    fonts: [
      { src: grotesk400, fontWeight: 400 },
      { src: grotesk600, fontWeight: 600 },
      { src: grotesk700, fontWeight: 700 },
    ],
  });

  // Désactive la césure auto : on garde le comportement HTML (wrap par mots).
  Font.registerHyphenationCallback((word) => [word]);
}

export function pdfFontFamily(brand) {
  if (brand?.fontStyle === "elegant") return "Playfair Display";
  if (brand?.fontStyle === "tech")    return "Space Grotesk";
  return "DM Sans";
}
