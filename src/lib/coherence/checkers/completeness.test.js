import { describe, it, expect } from "vitest";
import { checkCompleteness } from "./completeness.js";

const TYPOLOGY = {
  required_lots: ["fondations", "maconnerie", "couverture"],
  lots: [
    { lot_id: "fondations",  label: "Fondations",  match_keywords: ["fondation", "terrassement", "fouille"], suggestion: "Ajouter un lot fondations" },
    { lot_id: "maconnerie",  label: "Maçonnerie",  match_keywords: ["maçonnerie", "parpaing", "élévation"] },
    { lot_id: "couverture",  label: "Couverture",  match_keywords: ["couverture", "tuile", "toiture"] },
  ],
};

describe("checkCompleteness", () => {
  it("passe quand tous les lots requis sont présents (via lot)", () => {
    const devis = {
      lignes: [
        { type_ligne: "lot", designation: "Terrassement et fondations" },
        { type_ligne: "lot", designation: "Maçonnerie" },
        { type_ligne: "lot", designation: "Couverture tuiles" },
      ],
    };
    const result = checkCompleteness(devis, TYPOLOGY);
    expect(result.status).toBe("pass");
    expect(result.issues).toEqual([]);
  });

  it("passe quand les keywords matchent dans le champ 'lot' des ouvrages", () => {
    // La fonction priorise l.lot puis l.designation
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", lot: "Terrassement et fondations", designation: "Fouilles" },
        { type_ligne: "ouvrage", lot: "Maçonnerie", designation: "Murs" },
        { type_ligne: "ouvrage", lot: "Couverture", designation: "Toiture" },
      ],
    };
    const result = checkCompleteness(devis, TYPOLOGY);
    expect(result.status).toBe("pass");
  });

  it("matche sur la designation quand le champ 'lot' est absent", () => {
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", designation: "Fouilles en rigoles" },
        { type_ligne: "ouvrage", designation: "Élévation parpaings" },
        { type_ligne: "ouvrage", designation: "Pose de tuiles" },
      ],
    };
    const result = checkCompleteness(devis, TYPOLOGY);
    expect(result.status).toBe("pass");
  });

  it("échoue avec un lot manquant", () => {
    const devis = {
      lignes: [
        { type_ligne: "lot", designation: "Fondations" },
        { type_ligne: "lot", designation: "Maçonnerie" },
        // pas de couverture
      ],
    };
    const result = checkCompleteness(devis, TYPOLOGY);
    expect(result.status).toBe("fail");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("MISSING_LOT");
    expect(result.issues[0].lot_id).toBe("couverture");
    expect(result.issues[0].severity).toBe("error");
  });

  it("remonte la suggestion du lot si définie", () => {
    const devis = { lignes: [] };
    const result = checkCompleteness(devis, TYPOLOGY);
    const fondations = result.issues.find(i => i.lot_id === "fondations");
    expect(fondations.suggestion).toBe("Ajouter un lot fondations");
  });

  it("génère une suggestion par défaut quand aucune n'est fournie", () => {
    const devis = { lignes: [] };
    const result = checkCompleteness(devis, TYPOLOGY);
    const couverture = result.issues.find(i => i.lot_id === "couverture");
    expect(couverture.suggestion).toMatch(/Couverture/);
  });

  it("ne tient pas compte de la casse pour les keywords", () => {
    const devis = {
      lignes: [
        { type_ligne: "lot", designation: "FONDATIONS" },
        { type_ligne: "lot", designation: "Maçonnerie" },
        { type_ligne: "lot", designation: "TUILE béton" },
      ],
    };
    const result = checkCompleteness(devis, TYPOLOGY);
    expect(result.status).toBe("pass");
  });

  it("ignore les lignes texte / autres types", () => {
    const devis = {
      lignes: [
        { type_ligne: "texte", designation: "fondation maçonnerie couverture" },
      ],
    };
    const result = checkCompleteness(devis, TYPOLOGY);
    expect(result.status).toBe("fail");
    expect(result.issues).toHaveLength(3);
  });

  it("retourne pass si aucun lot requis n'est défini", () => {
    const result = checkCompleteness({ lignes: [] }, { required_lots: [] });
    expect(result.status).toBe("pass");
  });

  it("utilise un fallback à partir du lot_id quand match_keywords manque", () => {
    const typo = {
      required_lots: ["isolation_thermique"],
      lots: [{ lot_id: "isolation_thermique", label: "Isolation" }],
    };
    const devis = {
      lignes: [{ type_ligne: "lot", designation: "isolation thermique extérieure" }],
    };
    const result = checkCompleteness(devis, typo);
    expect(result.status).toBe("pass");
  });
});
