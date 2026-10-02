// Vérifie que tous les lots obligatoires de la typologie sont présents dans le devis.
// La correspondance est basée sur les keywords de chaque lot : robuste aux variations
// de libellés générées par le LLM.
// Signaux d'une demande « complète » (mêmes mots que la règle TYPE 3 du
// prompt) : un lot obligatoire manquant y est une erreur. Pour une demande
// partielle (« pose sanitaires », « plomberie salle de bain »), ce n'est
// qu'un avertissement : l'agent ne doit pas ajouter des lots non demandés.
const FULL_SCOPE_RE = /compl[eè]te?|totale?|cl[eé]s? en main|tous corps d[' ]?[eé]tat|de a [aà] z|int[eé]grale?|globale?/i;

export function checkCompleteness(devis, typology) {
  const lines = devis.lignes || [];
  // Typologie complète par nature (extension neuve, rénovation totale) ou
  // objet inconnu : comportement strict.
  const fullScope = typology.full_scope === true
    || !String(devis.objet || "").trim() || FULL_SCOPE_RE.test(devis.objet);

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
        severity: fullScope ? "error" : "warn",
        code: "MISSING_LOT",
        lot_id: reqLotId,
        message: `Lot obligatoire manquant : ${label}`,
        suggestion: lotDef?.suggestion || `Ajouter un lot "${label}"`,
      });
    }
  }

  return {
    checker: "CompletenessChecker",
    status: issues.length === 0 ? "pass" : fullScope ? "fail" : "warn",
    issues,
  };
}
