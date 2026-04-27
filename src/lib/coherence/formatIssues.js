// Formate les issues du moteur de cohérence en français lisible
// pour les injecter dans le prompt de correction envoyé à Claude.

function fmt(n) {
  return n?.toLocaleString("fr-FR") ?? n;
}

export function formatIssuesForPrompt(validationResult) {
  const allIssues = (validationResult.checks || []).flatMap(c => c.issues || []);
  if (!allIssues.length) return "";

  const lines = [
    `Le devis présente ${allIssues.length} incohérence${allIssues.length > 1 ? "s" : ""} à corriger :\n`,
  ];

  for (const issue of allIssues) {
    switch (issue.code) {
      case "MISSING_LOT":
        lines.push(`• ${issue.message}. ${issue.suggestion || ""}`);
        break;
      case "QTY_MISMATCH":
        lines.push(`• ${issue.message}`);
        break;
      case "PU_OUT_OF_RANGE":
        lines.push(`• ${issue.message}`);
        break;
      case "ENVELOPE_OUT_OF_RANGE": {
        const [min, max] = issue.expected_range || [];
        lines.push(
          `• **Total hors fourchette** : ${issue.message}. ` +
          `Le total corrigé doit être entre ${fmt(min)} € et ${fmt(max)} € HT.`
        );
        break;
      }
      default:
        lines.push(`• ${issue.message}`);
    }
  }

  return lines.join("\n");
}

// Construit le message de correction complet envoyé à Claude lors d'un retry.
export function buildCorrectionPrompt(validationResult) {
  const issueText = formatIssuesForPrompt(validationResult);

  const envelopeIssue = (validationResult.checks || [])
    .find(c => c.checker === "GlobalEnvelopeChecker")
    ?.issues?.[0];

  const rangeHint = envelopeIssue?.expected_range
    ? `\nFourchette attendue pour ce type de projet : ${fmt(envelopeIssue.expected_range[0])} – ${fmt(envelopeIssue.expected_range[1])} € HT.`
    : "";

  return (
    `${issueText}${rangeHint}\n\n` +
    `Corrige le devis complet en intégrant TOUTES ces corrections. ` +
    `Retourne uniquement le <DEVIS>…</DEVIS> corrigé, au même format JSON, sans texte avant ni après.`
  );
}
