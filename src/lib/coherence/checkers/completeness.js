// Vérifie que tous les lots obligatoires de la typologie sont présents dans le devis.
// La correspondance est basée sur les keywords de chaque lot : robuste aux variations
// de libellés générées par le LLM.
export function checkCompleteness(devis, typology) {
  const lines = devis.lignes || [];

  // Collecte tous les textes de lot/désignation en minuscules pour la recherche
  const presentTexts = lines
    .filter(l => l.type_ligne === "ouvrage" || l.type_ligne === "lot")
    .map(l => (l.lot || l.designation || "").toLowerCase());

  const issues = [];

  for (const reqLotId of typology.required_lots || []) {
    const lotDef = (typology.lots || []).find(l => l.lot_id === reqLotId);
    const keywords = lotDef?.match_keywords || [reqLotId.replace(/_/g, " ")];
    const label = lotDef?.label || reqLotId;

    const found = keywords.some(kw =>
      presentTexts.some(t => t.includes(kw.toLowerCase()))
    );

    if (!found) {
      issues.push({
        severity: "error",
        code: "MISSING_LOT",
        lot_id: reqLotId,
        message: `Lot obligatoire manquant : ${label}`,
        suggestion: lotDef?.suggestion || `Ajouter un lot "${label}"`,
      });
    }
  }

  return {
    checker: "CompletenessChecker",
    status: issues.length > 0 ? "fail" : "pass",
    issues,
  };
}
