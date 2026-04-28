// Au-delà de 30 % d'écart → erreur, sinon avertissement.
const PU_ERROR_THRESHOLD = 0.30;

// Unités quantifiées : seules les lignes avec ces unités sont vérifiées.
// Les lignes forfaitaires (u, forfait, ens, ou sans unité) sont ignorées
// pour éviter les faux positifs (un forfait 8 000 € ≠ un PU à 8 000 €/m²).
const QUANTIFIED_UNITS = new Set(["m²", "m2", "ml", "m", "m³", "m3", "h", "j", "min", "sem", "mois", "kg", "g", "t", "L", "cl", "km"]);

function tokenize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[\s,/()×.-]+/)
    .filter(w => w.length >= 4);
}

// Cherche l'item de pack dont le libellé correspond le mieux à la désignation de ligne.
// Requiert que ≥ 60 % des tokens du libellé item soient présents dans la désignation.
function findItemForLine(designation, typology) {
  const lineSet = new Set(tokenize(designation));
  if (lineSet.size === 0) return null;

  let best = null, bestScore = 0;
  for (const lot of typology.lots || []) {
    for (const item of lot.items || []) {
      if (!item.unit_price) continue;
      const itemTokens = tokenize(item.label);
      if (itemTokens.length === 0) continue;
      const overlap = itemTokens.filter(t => lineSet.has(t)).length;
      const score = overlap / itemTokens.length;
      if (score >= 0.6 && score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
  }
  return best;
}

export function checkUnitPrices(devis, typology) {
  const lines = devis.lignes || [];
  const issues = [];

  const itemById = {};
  for (const lot of typology.lots || []) {
    for (const item of lot.items || []) {
      if (item.item_id) itemById[item.item_id] = item;
    }
  }

  for (const line of lines) {
    if (line.type_ligne !== "ouvrage") continue;
    if (!QUANTIFIED_UNITS.has((line.unite || "").toLowerCase())) continue;

    const itemDef = line.item_id
      ? (itemById[line.item_id] ?? findItemForLine(line.designation, typology))
      : findItemForLine(line.designation, typology);
    if (!itemDef?.unit_price) continue;

    const pu = Number(line.prix_unitaire) || 0;
    const { min, max } = itemDef.unit_price;
    if (pu >= min && pu <= max) continue;

    const deviation = pu < min ? (min - pu) / min : (pu - max) / max;
    issues.push({
      severity: deviation > PU_ERROR_THRESHOLD ? "error" : "warn",
      code: "PU_OUT_OF_RANGE",
      line_ref: line.designation,
      item_id: itemDef.item_id,
      message: `PU ${pu} €/${line.unite} hors fourchette [${min}–${max} €/${line.unite}] pour "${itemDef.label}"`,
      expected_range: [min, max],
      got: pu,
    });
  }

  const hasError = issues.some(i => i.severity === "error");
  const hasWarn  = issues.some(i => i.severity === "warn");
  return {
    checker: "UnitPriceChecker",
    status: hasError ? "fail" : hasWarn ? "warn" : "pass",
    issues,
  };
}
