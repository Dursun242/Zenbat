import { findTypologyForText } from "./engine.js";

// Repères de prix injectés dans le prompt AVANT la génération.
//
// Le moteur de cohérence contrôle le devis APRÈS coup (fourchette €/m², prix
// unitaires de référence) et redemande une correction si ça ne passe pas.
// Donner ces mêmes fourchettes à l'IA dès le départ lui permet de viser juste
// du premier coup — surtout pour les modèles moins « connaisseurs » des prix
// du BTP français (Mistral) — et évite des allers-retours de correction.

// Surfaces par défaut (alignées sur « DIMENSIONS PAR DÉFAUT » de prompt.js).
const DEFAULT_SURFACES = [
  [/\bstudio\b/, 25], [/\bt1\b|\b1 pi[eè]ce\b/, 28], [/\bt2\b|\b2 pi[eè]ces\b/, 45],
  [/\bt3\b|\b3 pi[eè]ces\b/, 65], [/\bt4\b|\b4 pi[eè]ces\b/, 85], [/\bt5\b|\b5 pi[eè]ces\b/, 100],
  [/\bpetite maison\b/, 70], [/\bgrande maison\b/, 150], [/\bmaison\b/, 100],
];

// Typologies mesurées sur tout le logement : seules celles-ci peuvent utiliser
// la surface par défaut « T3 → 65 m² ». Pour une SdB ou une cuisine, la surface
// du logement n'est pas la surface de la pièce.
const WHOLE_DWELLING = new Set([
  "renovation_plomberie_partielle", "renovation_electrique_partielle",
  "renovation_peinture_interieure", "renovation_interieure",
]);
// Typologies à l'échelle d'une pièce : un « 65 m² » dans la demande désigne
// souvent le logement, pas la pièce → on ne calcule pas de total.
const ROOM_SCALE = new Set(["renovation_sdb", "cuisine_cle_en_main"]);

function fmt(n) {
  return Math.round(n).toLocaleString("fr-FR");
}

// Surface explicite (« 65 m² », « 65m2 ») sinon surface par défaut du logement.
export function guessSurface(text, { allowDefaults = true } = {}) {
  const t = String(text || "").toLowerCase();
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|m2|m 2)(?![\p{L}\d])/u);
  if (m) return { value: Number(m[1].replace(",", ".")), estimated: false };
  if (!allowDefaults) return null;
  for (const [re, value] of DEFAULT_SURFACES) {
    if (re.test(t)) return { value, estimated: true };
  }
  return null;
}

function envelopeLines(typology, text) {
  const { main_dimension: dim, envelope } = typology;
  if (!dim || !envelope) return [];
  const { min_per_unit: min, max_per_unit: max } = envelope;

  if (dim.unit === "€") {
    return [`• Montant attendu : ${fmt(min * 100)}–${fmt(max * 100)} % du ${dim.label.toLowerCase()} (HT).`];
  }
  const lines = [`• Total HT attendu : ${fmt(min)}–${fmt(max)} € HT par ${dim.unit} (${dim.label.toLowerCase()}).`];
  if (dim.unit === "m²" && !ROOM_SCALE.has(typology.typology_id)) {
    const surface = guessSurface(text, { allowDefaults: WHOLE_DWELLING.has(typology.typology_id) });
    if (surface?.value > 0) {
      lines.push(
        `  → Pour ${fmt(surface.value)} m²${surface.estimated ? " (surface par défaut)" : ""} : ` +
        `total entre ${fmt(min * surface.value)} et ${fmt(max * surface.value)} € HT.`
      );
    }
  }
  return lines;
}

function lotLines(typology) {
  const lots = typology.lots || [];
  const byId = Object.fromEntries(lots.map(l => [l.lot_id, l]));
  const required = (typology.required_lots || []).map(id => byId[id]?.label).filter(Boolean);
  const out = [];
  if (required.length) out.push(`• Lots attendus : ${required.join(", ")}.`);

  const priced = lots.flatMap(l => (l.items || []).filter(i => i.unit_price));
  if (priced.length) {
    out.push("• Prix unitaires de référence (HT, fourniture et pose) :");
    for (const item of priced) {
      const { min, max, typical } = item.unit_price;
      out.push(`  – ${item.label} : ${fmt(min)}–${fmt(max)} €/${item.unit}${typical ? ` (courant : ${fmt(typical)} €)` : ""}`);
    }
  }
  return out;
}

// userTexts : messages utilisateur de la conversation, du plus ancien au plus
// récent. La dernière demande prime ; à défaut, on cherche dans tout l'échange
// (ex : « et avec la douche à l'italienne ? » après une demande de SdB).
export function buildPriceHints(userTexts, userSettings = null) {
  const texts = (Array.isArray(userTexts) ? userTexts : [userTexts]).filter(Boolean).map(String);
  if (!texts.length) return "";
  const last = texts[texts.length - 1];
  const all  = texts.join("\n");

  let text = last;
  let typology = findTypologyForText(last, userSettings);
  if (!typology) { text = all; typology = findTypologyForText(all, userSettings); }
  if (!typology) return "";

  const body = [...envelopeLines(typology, text), ...lotLines(typology)];
  if (!body.length) return "";

  return [
    `REPÈRES DE PRIX POUR CETTE DEMANDE — ${typology.label}`,
    `Ton devis sera contrôlé automatiquement contre ces fourchettes (marché France, HT). ` +
      `Vise le milieu de fourchette, sauf indication contraire de l'artisan (gamme, accès, urgence). ` +
      `Un prix ou une quantité donnés par l'artisan priment toujours.`,
    ...body,
  ].join("\n");
}
