// Enregistrement des fontes custom pour @react-pdf/renderer.
// On utilise @expo-google-fonts qui fournit les .ttf (contrairement à
// @fontsource v5 qui ne ship que woff2 — la décompression Brotli
// dans fontkit bundle Vite plante avec "Out of bounds access").
// Les TTF sont bundlés par Vite via `?url`, servis comme assets locaux
// de l'app : aucun round-trip CDN à l'exécution.
import { Font } from "@react-pdf/renderer";

import dmSans400 from "@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf?url";
import dmSans500 from "@expo-google-fonts/dm-sans/500Medium/DMSans_500Medium.ttf?url";
import dmSans600 from "@expo-google-fonts/dm-sans/600SemiBold/DMSans_600SemiBold.ttf?url";
import dmSans700 from "@expo-google-fonts/dm-sans/700Bold/DMSans_700Bold.ttf?url";
import dmSans800 from "@expo-google-fonts/dm-sans/800ExtraBold/DMSans_800ExtraBold.ttf?url";

import playfair700 from "@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf?url";

import grotesk400 from "@expo-google-fonts/space-grotesk/400Regular/SpaceGrotesk_400Regular.ttf?url";
import grotesk600 from "@expo-google-fonts/space-grotesk/600SemiBold/SpaceGrotesk_600SemiBold.ttf?url";
import grotesk700 from "@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf?url";

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

  // Playfair est un serif d'affichage : pas de medium/regular utile pour nos
  // devis. On enregistre Bold en 400 ET 700 pour que tous les poids du
  // document (qui sont tous en 700 dans le cas "elegant") aient un glyph.
  Font.register({
    family: "Playfair Display",
    fonts: [
      { src: playfair700, fontWeight: 400 },
      { src: playfair700, fontWeight: 700 },
    ],
  });

  Font.register({
    family: "Space Grotesk",
    fonts: [
      { src: grotesk400, fontWeight: 400 },
      { src: grotesk400, fontWeight: 500 },
      { src: grotesk600, fontWeight: 600 },
      { src: grotesk700, fontWeight: 700 },
      { src: grotesk700, fontWeight: 800 },
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
