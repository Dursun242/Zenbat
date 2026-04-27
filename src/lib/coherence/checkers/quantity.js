import { evaluateFormula } from "../formula.js";

// Tolérance de 20 % par défaut (plus souple que la spec initiale de 10 %)
// pour absorber les déductions d'ouvertures et géométries non rectilignes BTP.
const QTY_TOLERANCE = 0.20;

// Vérifie la cohérence des quantités dérivées (ex. surface_murs = périmètre × hauteur).
// Ne s'active que si la ligne porte un champ `quantity_source` explicite —
// les lignes sans ce champ passent silencieusement (rétrocompatibilité).
export function checkQuantities(devis, typology, projectParams) {
  const lines = devis.lignes || [];
  const issues = [];

  for (const derived of typology.derived_quantities || []) {
    const allParams = { ...(derived.default_inputs || {}), ...projectParams };

    let expectedValue;
    try {
      expectedValue = evaluateFormula(derived.formula, allParams);
    } catch {
      continue; // paramètres manquants — on passe
    }

    if (!expectedValue || expectedValue <= 0) continue;

    const matchingLines = lines.filter(
      l => l.type_ligne === "ouvrage" && l.quantity_source === derived.target
    );

    for (const line of matchingLines) {
      const qty = Number(line.quantite) || 0;
      if (qty <= 0) continue;

      const delta = Math.abs(qty - expectedValue) / expectedValue;
      if (delta > QTY_TOLERANCE) {
        issues.push({
          severity: "error",
          code: "QTY_MISMATCH",
          line_ref: line.designation,
          message: `Quantité ${qty} ${line.unite || ""} incohérente : ${derived.target} calculé = ${Math.round(expectedValue * 10) / 10} (formule : ${derived.formula})`,
          expected: Math.round(expectedValue * 10) / 10,
          got: qty,
        });
      }
    }
  }

  return {
    checker: "QuantityChecker",
    status: issues.length > 0 ? "fail" : "pass",
    issues,
  };
}
