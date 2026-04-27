import { describe, it, expect } from "vitest";
import { runCoherenceCheck } from "./engine.js";
import { evaluateFormula }   from "./formula.js";
import { buildCorrectionPrompt } from "./formatIssues.js";

// ─── Cas déclencheur de la spec : extension 35 m² à 298 €/m² ─────────────────

const EXTENSION_FAIL = {
  objet: "Extension maison gros œuvre 35 m²",
  typology_id: "extension_neuve_go",
  project_params: { surface_sol: 35 },
  lignes: [
    { type_ligne: "lot",     designation: "Terrassement et fondations" },
    { type_ligne: "ouvrage", lot: "Terrassement et fondations", designation: "Fouilles en rigoles", quantite: 20, prix_unitaire: 30,  tva_rate: 20 },
    { type_ligne: "lot",     designation: "Maçonnerie" },
    { type_ligne: "ouvrage", lot: "Maçonnerie", designation: "Élévation parpaings", quantite: 60, prix_unitaire: 45, tva_rate: 20 },
    // Pas de charpente, couverture, enduits, évacuations → lots manquants
    // Total = 600 + 2700 = 3300 € → 94 €/m² → hors fourchette [800–1200]
  ],
};

const EXTENSION_PASS = {
  objet: "Extension maison gros œuvre 35 m²",
  typology_id: "extension_neuve_go",
  project_params: { surface_sol: 35 },
  lignes: [
    { type_ligne: "lot",     designation: "Terrassement et fondations" },
    { type_ligne: "ouvrage", lot: "Terrassement et fondations",  designation: "Fouilles",      quantite: 1,  prix_unitaire: 4000, tva_rate: 20 },
    { type_ligne: "lot",     designation: "Maçonnerie gros œuvre" },
    { type_ligne: "ouvrage", lot: "Maçonnerie gros œuvre",       designation: "Parpaings",     quantite: 60, prix_unitaire: 60,   tva_rate: 20 },
    { type_ligne: "lot",     designation: "Charpente bois" },
    { type_ligne: "ouvrage", lot: "Charpente bois",              designation: "Fermettes",     quantite: 40, prix_unitaire: 75,   tva_rate: 20 },
    { type_ligne: "lot",     designation: "Couverture tuiles" },
    { type_ligne: "ouvrage", lot: "Couverture tuiles",           designation: "Tuile béton",   quantite: 40, prix_unitaire: 70,   tva_rate: 20 },
    { type_ligne: "lot",     designation: "Enduits extérieurs" },
    { type_ligne: "ouvrage", lot: "Enduits extérieurs",          designation: "Enduit monocouche", quantite: 80, prix_unitaire: 35, tva_rate: 20 },
    { type_ligne: "lot",     designation: "Évacuations" },
    { type_ligne: "ouvrage", lot: "Évacuations",                 designation: "Réseaux EP/EU", quantite: 1,  prix_unitaire: 3200, tva_rate: 20 },
    // Total = 4000 + 3600 + 3000 + 2800 + 2800 + 3200 = 19400 → 554 €/m²
    // min acceptable = 800 × 0.85 = 680 → hors fourchette également
    // Ajoutons plus de valeur :
  ],
};

// Devis à ~35 000 € pour 35 m² = 1000 €/m² (dans [680–1380])
const EXTENSION_PASS_OK = {
  objet: "Extension maison gros œuvre 35 m²",
  typology_id: "extension_neuve_go",
  project_params: { surface_sol: 35 },
  lignes: [
    { type_ligne: "lot",     designation: "Terrassement et fondations" },
    { type_ligne: "ouvrage", lot: "Terrassement et fondations",  designation: "Fouilles + béton fondations", quantite: 1,  prix_unitaire: 8000, tva_rate: 20 },
    { type_ligne: "lot",     designation: "Gros œuvre maçonnerie" },
    { type_ligne: "ouvrage", lot: "Gros œuvre maçonnerie",       designation: "Élévation parpaings",         quantite: 60, prix_unitaire: 65,   tva_rate: 20 },
    { type_ligne: "lot",     designation: "Charpente bois" },
    { type_ligne: "ouvrage", lot: "Charpente bois",              designation: "Fermettes industrielles",     quantite: 40, prix_unitaire: 90,   tva_rate: 20 },
    { type_ligne: "lot",     designation: "Couverture" },
    { type_ligne: "ouvrage", lot: "Couverture",                  designation: "Tuile béton",                 quantite: 40, prix_unitaire: 85,   tva_rate: 20 },
    { type_ligne: "lot",     designation: "Enduits extérieurs" },
    { type_ligne: "ouvrage", lot: "Enduits extérieurs",          designation: "Enduit monocouche",           quantite: 80, prix_unitaire: 40,   tva_rate: 20 },
    { type_ligne: "lot",     designation: "Évacuations et réseaux" },
    { type_ligne: "ouvrage", lot: "Évacuations et réseaux",      designation: "Réseaux EP/EU + VRD",         quantite: 1,  prix_unitaire: 4200, tva_rate: 20 },
    // Total = 8000 + 3900 + 3600 + 3400 + 3200 + 4200 = 26300 → 751 €/m²
    // Encore un peu juste. Ajoutons une ligne divers
    { type_ligne: "lot",     designation: "Divers et imprévus" },
    { type_ligne: "ouvrage", lot: "Divers et imprévus",          designation: "Imprévus chantier",           quantite: 1,  prix_unitaire: 8700, tva_rate: 20 },
    // 26300 + 8700 = 35000 → 1000 €/m² ✓ dans [680–1380]
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GlobalEnvelopeChecker", () => {
  it("détecte le devis extension 35 m² hors fourchette (298 €/m²)", () => {
    const result = runCoherenceCheck(EXTENSION_FAIL);
    const check  = result.checks.find(c => c.checker === "GlobalEnvelopeChecker");
    expect(result.overall_status).toBe("fail");
    expect(check.status).toBe("fail");
    expect(check.issues[0].code).toBe("ENVELOPE_OUT_OF_RANGE");
  });

  it("accepte un devis extension correctement valorisé (1 000 €/m²)", () => {
    const result = runCoherenceCheck(EXTENSION_PASS_OK);
    const check  = result.checks.find(c => c.checker === "GlobalEnvelopeChecker");
    expect(check.status).toBe("pass");
  });
});

describe("CompletenessChecker", () => {
  it("signale les lots manquants (charpente, couverture, enduits, évacuations)", () => {
    const result  = runCoherenceCheck(EXTENSION_FAIL);
    const check   = result.checks.find(c => c.checker === "CompletenessChecker");
    const missing = check.issues.map(i => i.lot_id);
    expect(check.status).toBe("fail");
    expect(missing).toContain("charpente");
    expect(missing).toContain("couverture");
    expect(missing).toContain("enduits_exterieurs");
    expect(missing).toContain("evacuations");
  });

  it("passe quand tous les lots obligatoires sont présents", () => {
    const result = runCoherenceCheck(EXTENSION_PASS_OK);
    const check  = result.checks.find(c => c.checker === "CompletenessChecker");
    expect(check.status).toBe("pass");
  });
});

describe("Détection automatique de typologie", () => {
  it("détecte extension_neuve_go via le champ objet sans typology_id explicite", () => {
    const devis = {
      objet: "Devis pour une extension maison en gros œuvre",
      project_params: { surface_sol: 35 },
      lignes: [
        { type_ligne: "ouvrage", lot: "Terrassement", designation: "Fouilles", quantite: 1, prix_unitaire: 500, tva_rate: 20 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("extension_neuve_go");
  });

  it("retourne pass pour un devis sans typologie reconnue", () => {
    const devis = {
      objet: "Prestation de coiffure",
      lignes: [
        { type_ligne: "ouvrage", designation: "Coupe femme", quantite: 1, prix_unitaire: 55, tva_rate: 20 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.overall_status).toBe("pass");
    expect(result.typology_id).toBeNull();
  });
});

describe("evaluateFormula", () => {
  it("évalue perimetre × hauteur_etage", () => {
    expect(evaluateFormula("perimetre * hauteur_etage", { perimetre: 24, hauteur_etage: 2.5 })).toBe(60);
  });

  it("évalue surface_sol × coef_pente", () => {
    expect(evaluateFormula("surface_sol * coef_pente", { surface_sol: 35, coef_pente: 1.15 })).toBeCloseTo(40.25);
  });

  it("refuse une formule contenant du code", () => {
    expect(() => evaluateFormula("process.exit(1)", {})).toThrow();
  });
});

describe("buildCorrectionPrompt", () => {
  it("génère un prompt lisible avec les issues", () => {
    const result = runCoherenceCheck(EXTENSION_FAIL);
    const prompt = buildCorrectionPrompt(result);
    expect(prompt).toContain("incohérence");
    expect(prompt).toContain("hors fourchette");
    expect(prompt).toContain("<DEVIS>");
  });
});
