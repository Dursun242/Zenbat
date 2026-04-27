// Au-delà de 30 % d'écart → erreur, sinon avertissement.
const PU_ERROR_THRESHOLD = 0.30;

// Vérifie que les prix unitaires de chaque ligne restent dans la fourchette
// définie dans le pack.  Ne s'active que si la ligne porte un champ `item_id`
// correspondant à une entrée du pack (rétrocompatibilité totale).
export function checkUnitPrices(devis, typology) {
  const lines = devis.lignes || [];
  const issues = [];

  // Aplatit tous les items de tous les lots en une map item_id → définition
  const itemMap = {};
  for (const lot of typology.lots || []) {
    for (const item of lot.items || []) {
      itemMap[item.item_id] = { ...item, lot_id: lot.lot_id };
    }
  }

  for (const line of lines) {
    if (line.type_ligne !== "ouvrage" || !line.item_id) continue;

    const itemDef = itemMap[line.item_id];
    if (!itemDef?.unit_price) continue;

    const pu = Number(line.prix_unitaire) || 0;
    const { min, max } = itemDef.unit_price;

    if (pu < min || pu > max) {
      const deviation = pu < min ? (min - pu) / min : (pu - max) / max;
      issues.push({
        severity: deviation > PU_ERROR_THRESHOLD ? "error" : "warn",
        code: "PU_OUT_OF_RANGE",
        line_ref: line.designation,
        item_id: line.item_id,
        message: `PU ${pu} €/${line.unite} hors fourchette [${min}–${max} €/${line.unite}] pour "${itemDef.label}"`,
        expected_range: [min, max],
        got: pu,
      });
    }
  }

  const hasError = issues.some(i => i.severity === "error");
  const hasWarn  = issues.some(i => i.severity === "warn");

  return {
    checker: "UnitPriceChecker",
    status: hasError ? "fail" : hasWarn ? "warn" : "pass",
    issues,
  };
}
