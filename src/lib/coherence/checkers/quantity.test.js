import { describe, it, expect } from "vitest";
import { checkQuantities } from "./quantity.js";

const TYPOLOGY = {
  derived_quantities: [
    {
      target: "surface_murs",
      formula: "perimetre * hauteur",
      default_inputs: { hauteur: 2.5 },
    },
  ],
};

describe("checkQuantities", () => {
  it("passe quand la quantité dérivée est dans la tolérance (20%)", () => {
    // perimetre 24 × hauteur 2.5 = 60 m² ; ligne 60 m² → exact
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", quantity_source: "surface_murs", quantite: 60, prix_unitaire: 30 },
      ],
    };
    const result = checkQuantities(devis, TYPOLOGY, { perimetre: 24 });
    expect(result.status).toBe("pass");
  });

  it("tolère un écart < 20%", () => {
    // attendu 60 m², ligne 65 m² (écart 8%)
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", quantity_source: "surface_murs", quantite: 65, prix_unitaire: 30 },
      ],
    };
    const result = checkQuantities(devis, TYPOLOGY, { perimetre: 24 });
    expect(result.status).toBe("pass");
  });

  it("échoue quand la quantité s'écarte de plus de 20%", () => {
    // attendu 60 m², ligne 100 m² (écart 67%)
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", quantity_source: "surface_murs", quantite: 100, prix_unitaire: 30, designation: "Enduit murs" },
      ],
    };
    const result = checkQuantities(devis, TYPOLOGY, { perimetre: 24 });
    expect(result.status).toBe("fail");
    expect(result.issues[0].code).toBe("QTY_MISMATCH");
    expect(result.issues[0].expected).toBe(60);
    expect(result.issues[0].got).toBe(100);
    expect(result.issues[0].line_ref).toBe("Enduit murs");
  });

  it("ignore les lignes sans quantity_source explicite", () => {
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", quantite: 9999, prix_unitaire: 1 },
      ],
    };
    const result = checkQuantities(devis, TYPOLOGY, { perimetre: 24 });
    expect(result.status).toBe("pass");
  });

  it("utilise les default_inputs quand un paramètre manque", () => {
    // hauteur prend default 2.5 → perimetre 20 × 2.5 = 50
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", quantity_source: "surface_murs", quantite: 50 },
      ],
    };
    const result = checkQuantities(devis, TYPOLOGY, { perimetre: 20 });
    expect(result.status).toBe("pass");
  });

  it("priorise projectParams sur default_inputs", () => {
    // user override hauteur=3 → 20 × 3 = 60
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", quantity_source: "surface_murs", quantite: 60 },
      ],
    };
    const result = checkQuantities(devis, TYPOLOGY, { perimetre: 20, hauteur: 3 });
    expect(result.status).toBe("pass");
  });

  it("ignore silencieusement quand la formule échoue (paramètres manquants)", () => {
    const typo = {
      derived_quantities: [
        { target: "x", formula: "a * b" }, // pas de defaults
      ],
    };
    const devis = {
      lignes: [{ type_ligne: "ouvrage", quantity_source: "x", quantite: 50 }],
    };
    const result = checkQuantities(devis, typo, {});
    expect(result.status).toBe("pass");
  });

  it("ignore les lignes non-ouvrage", () => {
    const devis = {
      lignes: [
        { type_ligne: "lot", quantity_source: "surface_murs", quantite: 9999 },
      ],
    };
    const result = checkQuantities(devis, TYPOLOGY, { perimetre: 24 });
    expect(result.status).toBe("pass");
  });

  it("retourne pass si aucune dérivée n'est définie", () => {
    const result = checkQuantities({ lignes: [] }, { derived_quantities: [] }, {});
    expect(result.status).toBe("pass");
  });
});
