import { describe, it, expect } from "vitest";
import { formatIssuesForPrompt, buildCorrectionPrompt } from "./formatIssues.js";

describe("formatIssuesForPrompt", () => {
  it("retourne une chaîne vide quand il n'y a aucune issue", () => {
    expect(formatIssuesForPrompt({ checks: [] })).toBe("");
    expect(formatIssuesForPrompt({ checks: [{ issues: [] }] })).toBe("");
  });

  it("utilise le singulier pour une seule incohérence", () => {
    const result = formatIssuesForPrompt({
      checks: [{ issues: [{ code: "MISSING_LOT", message: "Lot manquant" }] }],
    });
    expect(result).toMatch(/1 incohérence /);
    expect(result).not.toMatch(/incohérences/);
  });

  it("utilise le pluriel pour plusieurs incohérences", () => {
    const result = formatIssuesForPrompt({
      checks: [{
        issues: [
          { code: "MISSING_LOT", message: "Lot 1" },
          { code: "MISSING_LOT", message: "Lot 2" },
        ],
      }],
    });
    expect(result).toMatch(/2 incohérences/);
  });

  it("formate les issues MISSING_LOT avec leur suggestion", () => {
    const result = formatIssuesForPrompt({
      checks: [{
        issues: [
          { code: "MISSING_LOT", message: "Lot couverture manquant", suggestion: "Ajouter une couverture" },
        ],
      }],
    });
    expect(result).toContain("Lot couverture manquant");
    expect(result).toContain("Ajouter une couverture");
  });

  it("formate les issues ENVELOPE_OUT_OF_RANGE avec la fourchette", () => {
    const result = formatIssuesForPrompt({
      checks: [{
        issues: [{
          code: "ENVELOPE_OUT_OF_RANGE",
          message: "Total 3 500 € HT hors fourchette",
          expected_range: [28000, 42000],
        }],
      }],
    });
    expect(result).toContain("Total hors fourchette");
    // toLocaleString("fr-FR") utilise une espace fine insécable (U+202F)
    expect(result).toMatch(/28[\s  ]000/);
    expect(result).toMatch(/42[\s  ]000/);
  });

  it("agrège les issues de plusieurs checkers", () => {
    const result = formatIssuesForPrompt({
      checks: [
        { issues: [{ code: "MISSING_LOT", message: "Lot A" }] },
        { issues: [{ code: "QTY_MISMATCH", message: "Quantité B" }] },
        { issues: [{ code: "PU_OUT_OF_RANGE", message: "PU C" }] },
      ],
    });
    expect(result).toContain("Lot A");
    expect(result).toContain("Quantité B");
    expect(result).toContain("PU C");
    expect(result).toMatch(/3 incohérences/);
  });

  it("utilise la branche default pour un code inconnu", () => {
    const result = formatIssuesForPrompt({
      checks: [{ issues: [{ code: "UNKNOWN_CODE", message: "Truc bizarre" }] }],
    });
    expect(result).toContain("Truc bizarre");
  });
});

describe("buildCorrectionPrompt", () => {
  it("inclut un rappel de fourchette quand l'enveloppe est hors range", () => {
    const result = buildCorrectionPrompt({
      checks: [{
        checker: "GlobalEnvelopeChecker",
        issues: [{
          code: "ENVELOPE_OUT_OF_RANGE",
          message: "Total hors fourchette",
          expected_range: [28000, 42000],
        }],
      }],
    });
    expect(result).toContain("Fourchette attendue");
    expect(result).toMatch(/28[\s  ]000/);
    expect(result).toContain("Retourne uniquement le <DEVIS>");
  });

  it("n'inclut pas de rappel de fourchette si l'enveloppe est OK", () => {
    const result = buildCorrectionPrompt({
      checks: [{
        checker: "CompletenessChecker",
        issues: [{ code: "MISSING_LOT", message: "Lot X manquant" }],
      }],
    });
    expect(result).not.toContain("Fourchette attendue");
    expect(result).toContain("Lot X manquant");
  });

  it("rappelle toujours le format <DEVIS>", () => {
    const result = buildCorrectionPrompt({ checks: [] });
    expect(result).toContain("<DEVIS>");
    expect(result).toContain("JSON");
  });
});
