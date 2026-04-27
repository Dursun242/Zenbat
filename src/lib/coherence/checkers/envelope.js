// Vérifie que le total HT du devis tombe dans la fourchette de marché
// attendue pour la dimension principale de la typologie
// (ex. 800–1 200 €/m² pour une extension neuve gros œuvre).
export function checkEnvelope(devis, typology, projectParams) {
  const { main_dimension, envelope } = typology;

  if (!main_dimension || !envelope) {
    return { checker: "GlobalEnvelopeChecker", status: "pass", issues: [] };
  }

  const mainValue = Number(projectParams[main_dimension.name]);
  if (!mainValue || mainValue <= 0) {
    return { checker: "GlobalEnvelopeChecker", status: "pass", issues: [] };
  }

  const lines = devis.lignes || [];
  const totalHT = lines
    .filter(l => l.type_ligne === "ouvrage")
    .reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);

  if (totalHT <= 0) {
    return { checker: "GlobalEnvelopeChecker", status: "pass", issues: [] };
  }

  const ratio = totalHT / mainValue;
  const tol   = (envelope.tolerance_pct || 15) / 100;
  const minOk = envelope.min_per_unit * (1 - tol);
  const maxOk = envelope.max_per_unit * (1 + tol);

  if (ratio >= minOk && ratio <= maxOk) {
    return { checker: "GlobalEnvelopeChecker", status: "pass", issues: [] };
  }

  const expectedMin = Math.round(envelope.min_per_unit * mainValue);
  const expectedMax = Math.round(envelope.max_per_unit * mainValue);

  return {
    checker: "GlobalEnvelopeChecker",
    status: "fail",
    issues: [
      {
        severity: "error",
        code: "ENVELOPE_OUT_OF_RANGE",
        message: `Total ${Math.round(totalHT).toLocaleString("fr-FR")} € HT (${Math.round(ratio)} €/${main_dimension.unit}) hors fourchette marché [${envelope.min_per_unit}–${envelope.max_per_unit} €/${main_dimension.unit} HT]`,
        expected_range: [expectedMin, expectedMax],
        got: Math.round(totalHT),
        ratio: Math.round(ratio),
      },
    ],
  };
}
