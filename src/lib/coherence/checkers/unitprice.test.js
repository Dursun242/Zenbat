import { describe, it, expect } from "vitest";
import { checkUnitPrices } from "./unitprice.js";

const TYPOLOGY = {
  lots: [
    {
      lot_id: "maconnerie",
      items: [
        {
          item_id: "parpaing_20",
          label: "Élévation parpaings 20 cm",
          unit_price: { min: 50, max: 80 },
        },
        {
          item_id: "enduit_mono",
          label: "Enduit monocouche extérieur",
          unit_price: { min: 30, max: 45 },
        },
      ],
    },
  ],
};

describe("checkUnitPrices", () => {
  it("passe quand le PU est dans la fourchette (matching par item_id)", () => {
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", item_id: "parpaing_20", designation: "Parpaings", unite: "m²", quantite: 60, prix_unitaire: 65 },
      ],
    };
    const result = checkUnitPrices(devis, TYPOLOGY);
    expect(result.status).toBe("pass");
  });

  it("génère un warn pour un écart < 30%", () => {
    // max=80, pu=95 → déviation = 15/80 = 18.75% → warn
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", item_id: "parpaing_20", designation: "Parpaings", unite: "m²", quantite: 60, prix_unitaire: 95 },
      ],
    };
    const result = checkUnitPrices(devis, TYPOLOGY);
    expect(result.status).toBe("warn");
    expect(result.issues[0].severity).toBe("warn");
    expect(result.issues[0].code).toBe("PU_OUT_OF_RANGE");
  });

  it("génère un error pour un écart > 30%", () => {
    // max=80, pu=200 → déviation = 120/80 = 150% → error
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", item_id: "parpaing_20", designation: "Parpaings", unite: "m²", quantite: 60, prix_unitaire: 200 },
      ],
    };
    const result = checkUnitPrices(devis, TYPOLOGY);
    expect(result.status).toBe("fail");
    expect(result.issues[0].severity).toBe("error");
  });

  it("matche par fuzzy tokenisation quand item_id manque", () => {
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", designation: "Élévation parpaings 20 cm pour murs", unite: "m²", quantite: 60, prix_unitaire: 65 },
      ],
    };
    const result = checkUnitPrices(devis, TYPOLOGY);
    expect(result.status).toBe("pass");
  });

  it("ignore les unités forfaitaires (forfait, ens, u)", () => {
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", item_id: "parpaing_20", designation: "Lot global parpaings", unite: "forfait", quantite: 1, prix_unitaire: 10000 },
      ],
    };
    const result = checkUnitPrices(devis, TYPOLOGY);
    expect(result.status).toBe("pass");
  });

  it("ignore les lignes non-ouvrage", () => {
    const devis = {
      lignes: [
        { type_ligne: "lot", item_id: "parpaing_20", designation: "Maçonnerie", unite: "m²", prix_unitaire: 9999 },
      ],
    };
    const result = checkUnitPrices(devis, TYPOLOGY);
    expect(result.status).toBe("pass");
  });

  it("ne déclenche aucun match si le score fuzzy est < 60%", () => {
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", designation: "Pose totale différente xyz", unite: "m²", quantite: 1, prix_unitaire: 9999 },
      ],
    };
    const result = checkUnitPrices(devis, TYPOLOGY);
    expect(result.status).toBe("pass");
  });

  it("matche les unités m² et m2 (variantes)", () => {
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", item_id: "parpaing_20", designation: "Parpaings", unite: "m2", quantite: 60, prix_unitaire: 65 },
      ],
    };
    const result = checkUnitPrices(devis, TYPOLOGY);
    expect(result.status).toBe("pass");
  });

  it("expose la fourchette attendue dans l'issue", () => {
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", item_id: "parpaing_20", designation: "Parpaings", unite: "m²", quantite: 60, prix_unitaire: 200 },
      ],
    };
    const result = checkUnitPrices(devis, TYPOLOGY);
    expect(result.issues[0].expected_range).toEqual([50, 80]);
    expect(result.issues[0].got).toBe(200);
    expect(result.issues[0].item_id).toBe("parpaing_20");
  });

  it("ne mélange pas warn et error : status=fail dès qu'il y a une erreur", () => {
    const devis = {
      lignes: [
        { type_ligne: "ouvrage", item_id: "parpaing_20", designation: "Parpaings", unite: "m²", quantite: 60, prix_unitaire: 95 },   // warn
        { type_ligne: "ouvrage", item_id: "enduit_mono", designation: "Enduit", unite: "m²", quantite: 80, prix_unitaire: 200 },     // error
      ],
    };
    const result = checkUnitPrices(devis, TYPOLOGY);
    expect(result.status).toBe("fail");
    expect(result.issues).toHaveLength(2);
  });
});
