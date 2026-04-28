import { describe, it, expect } from "vitest";
import { checkEnvelope } from "./envelope.js";

const TYPOLOGY = {
  main_dimension: { name: "surface_sol", unit: "m²" },
  envelope: { min_per_unit: 800, max_per_unit: 1200, tolerance_pct: 15 },
};

function makeDevis(lignes) {
  return { lignes };
}

describe("checkEnvelope", () => {
  it("passe si la typologie n'a pas d'enveloppe définie", () => {
    const result = checkEnvelope(makeDevis([]), { main_dimension: null, envelope: null }, {});
    expect(result.status).toBe("pass");
    expect(result.issues).toEqual([]);
  });

  it("passe si la dimension principale n'est pas fournie", () => {
    const result = checkEnvelope(makeDevis([]), TYPOLOGY, {});
    expect(result.status).toBe("pass");
  });

  it("passe si la dimension principale est ≤ 0", () => {
    const result = checkEnvelope(makeDevis([]), TYPOLOGY, { surface_sol: 0 });
    expect(result.status).toBe("pass");
  });

  it("passe si le total HT est nul", () => {
    const result = checkEnvelope(makeDevis([]), TYPOLOGY, { surface_sol: 35 });
    expect(result.status).toBe("pass");
  });

  it("passe quand le total est dans la fourchette tolérée", () => {
    // 35 m² × 1000 €/m² = 35 000 € → dans [800-1200]
    const lignes = [
      { type_ligne: "ouvrage", quantite: 1, prix_unitaire: 35000 },
    ];
    const result = checkEnvelope(makeDevis(lignes), TYPOLOGY, { surface_sol: 35 });
    expect(result.status).toBe("pass");
  });

  it("passe à la borne basse avec tolérance (15%)", () => {
    // 35 m² × 680 €/m² = 23 800 € → 800 × 0.85 = 680 (limite basse OK)
    const lignes = [
      { type_ligne: "ouvrage", quantite: 1, prix_unitaire: 23800 },
    ];
    const result = checkEnvelope(makeDevis(lignes), TYPOLOGY, { surface_sol: 35 });
    expect(result.status).toBe("pass");
  });

  it("échoue quand le total est largement sous la fourchette", () => {
    // 35 m² × 100 €/m² = 3 500 € → bien sous 800 €/m²
    const lignes = [
      { type_ligne: "ouvrage", quantite: 1, prix_unitaire: 3500 },
    ];
    const result = checkEnvelope(makeDevis(lignes), TYPOLOGY, { surface_sol: 35 });
    expect(result.status).toBe("fail");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("ENVELOPE_OUT_OF_RANGE");
    expect(result.issues[0].severity).toBe("error");
    expect(result.issues[0].expected_range).toEqual([28000, 42000]);
    expect(result.issues[0].got).toBe(3500);
  });

  it("échoue quand le total est largement au-dessus de la fourchette", () => {
    const lignes = [
      { type_ligne: "ouvrage", quantite: 1, prix_unitaire: 100000 },
    ];
    const result = checkEnvelope(makeDevis(lignes), TYPOLOGY, { surface_sol: 35 });
    expect(result.status).toBe("fail");
    expect(result.issues[0].got).toBe(100000);
  });

  it("ignore les lignes non-ouvrage dans le total HT", () => {
    const lignes = [
      { type_ligne: "lot", quantite: 1, prix_unitaire: 999999 },
      { type_ligne: "ouvrage", quantite: 1, prix_unitaire: 35000 },
    ];
    const result = checkEnvelope(makeDevis(lignes), TYPOLOGY, { surface_sol: 35 });
    expect(result.status).toBe("pass");
  });

  it("utilise la tolérance par défaut (15%) si non spécifiée", () => {
    const typo = {
      main_dimension: { name: "surface_sol", unit: "m²" },
      envelope: { min_per_unit: 800, max_per_unit: 1200 },
    };
    const lignes = [{ type_ligne: "ouvrage", quantite: 1, prix_unitaire: 30000 }];
    const result = checkEnvelope(makeDevis(lignes), typo, { surface_sol: 35 });
    expect(result.status).toBe("pass");
  });
});
