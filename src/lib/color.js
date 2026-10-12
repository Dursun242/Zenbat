// Couleur de l'artisan utilisable comme fond d'un bouton à texte blanc :
// on garde sa teinte, mais on l'assombrit jusqu'au contraste AA (4,5:1).
// Utilisé là où l'identité de l'artisan s'affiche (page de signature client).
const FALLBACK = "#1A1612";

function parseHex(hex) {
  const m = String(hex || "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map(c => c + c).join("") : m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

const toHex = rgb => "#" + rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

function luminance([r, g, b]) {
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastWithWhite(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  return 1.05 / (luminance(rgb) + 0.05);
}

export function readableAccent(hex, fallback = FALLBACK) {
  let rgb = parseHex(hex);
  if (!rgb) return fallback;
  for (let i = 0; i < 30 && 1.05 / (luminance(rgb) + 0.05) < 4.5; i++) {
    rgb = rgb.map(v => v * 0.9);
  }
  return toHex(rgb);
}
