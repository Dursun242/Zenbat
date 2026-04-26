import { describe, it, expect } from "vitest";
import { calcInvoiceTotals } from "./invoiceCalc.js";

const ouvrage = (quantite, prix_unitaire, tva_rate = 20) => ({
  type_ligne: "ouvrage",
  quantite,
  prix_unitaire,
  tva_rate,
});

const lot = (designation) => ({ type_ligne: "lot", designation });

describe("calcInvoiceTotals — régime normal", () => {
  it("calcule correctement HT, TVA et TTC pour une ligne", () => {
    const { ht, tva, ttc } = calcInvoiceTotals([ouvrage(10, 100, 20)], "normal");
    expect(ht).toBe(1000);
    expect(tva).toBe(200);
    expect(ttc).toBe(1200);
  });

  it("somme plusieurs lignes avec TVA différente", () => {
    const lignes = [
      ouvrage(10, 100, 20),  // 1000 HT, 200 TVA
      ouvrage(5,  200, 10),  // 1000 HT, 100 TVA
    ];
    const { ht, tva, ttc } = calcInvoiceTotals(lignes, "normal");
    expect(ht).toBe(2000);
    expect(tva).toBe(300);
    expect(ttc).toBe(2300);
  });

  it("ignore les lignes de type lot", () => {
    const lignes = [
      lot("MAÇONNERIE"),
      ouvrage(2, 500, 20),  // 1000 HT
      lot("CARRELAGE"),
    ];
    const { ht } = calcInvoiceTotals(lignes, "normal");
    expect(ht).toBe(1000);
  });

  it("utilise TVA 20% par défaut si tva_rate absent", () => {
    const ligne = { type_ligne: "ouvrage", quantite: 10, prix_unitaire: 100 };
    const { tva } = calcInvoiceTotals([ligne], "normal");
    expect(tva).toBe(200);
  });

  it("renvoie 0 pour une liste vide", () => {
    const { ht, tva, ttc } = calcInvoiceTotals([], "normal");
    expect(ht).toBe(0);
    expect(tva).toBe(0);
    expect(ttc).toBe(0);
  });

  it("renvoie 0 pour undefined", () => {
    const { ht, tva, ttc } = calcInvoiceTotals(undefined, "normal");
    expect(ht).toBe(0);
    expect(tva).toBe(0);
    expect(ttc).toBe(0);
  });

  it("tolère les valeurs non-numériques (quantite/prix vides)", () => {
    const ligne = { type_ligne: "ouvrage", quantite: "", prix_unitaire: null };
    const { ht, tva } = calcInvoiceTotals([ligne], "normal");
    expect(ht).toBe(0);
    expect(tva).toBe(0);
  });

  it("calcule correctement avec TVA réduite 5,5%", () => {
    const { ht, tva, ttc } = calcInvoiceTotals([ouvrage(1, 1000, 5.5)], "normal");
    expect(ht).toBe(1000);
    expect(tva).toBeCloseTo(55, 5);
    expect(ttc).toBeCloseTo(1055, 5);
  });
});

describe("calcInvoiceTotals — régime franchise (art. 293 B CGI)", () => {
  it("TVA = 0 quel que soit le taux de la ligne", () => {
    const { tva, ttc } = calcInvoiceTotals([ouvrage(10, 100, 20)], "franchise");
    expect(tva).toBe(0);
    expect(ttc).toBe(1000); // ttc = ht quand franchise
  });

  it("utilise taux 0 si tva_rate absent en franchise", () => {
    const ligne = { type_ligne: "ouvrage", quantite: 10, prix_unitaire: 100 };
    const { tva } = calcInvoiceTotals([ligne], "franchise");
    expect(tva).toBe(0);
  });

  it("HT reste correct en franchise", () => {
    const { ht } = calcInvoiceTotals([ouvrage(5, 200, 20)], "franchise");
    expect(ht).toBe(1000);
  });
});

describe("calcInvoiceTotals — cas limites réels BTP", () => {
  it("chantier mixte — salle de bain demo (scénario DEMO_DEVIS)", () => {
    const lignes = [
      { type_ligne: "lot", designation: "DÉMOLITION" },
      { type_ligne: "ouvrage", designation: "Dépose carrelage",  quantite: 24, prix_unitaire: 18,   tva_rate: 20 }, // 432
      { type_ligne: "ouvrage", designation: "Évacuation gravats",quantite: 1,  prix_unitaire: 320,  tva_rate: 20 }, // 320
      { type_ligne: "lot", designation: "REVÊTEMENTS" },
      { type_ligne: "ouvrage", designation: "Carrelage grès",    quantite: 24, prix_unitaire: 55,   tva_rate: 10 }, // 1320
      { type_ligne: "ouvrage", designation: "Faïence murale",    quantite: 18, prix_unitaire: 48,   tva_rate: 10 }, // 864
      { type_ligne: "lot", designation: "PLOMBERIE" },
      { type_ligne: "ouvrage", designation: "WC suspendu",       quantite: 1,  prix_unitaire: 650,  tva_rate: 20 }, // 650
      { type_ligne: "ouvrage", designation: "Douche italienne",  quantite: 1,  prix_unitaire: 1200, tva_rate: 20 }, // 1200
    ];
    // HT total = 432 + 320 + 1320 + 864 + 650 + 1200 = 4786
    // TVA 20% lignes : (432 + 320 + 650 + 1200) * 0.20 = 2602 * 0.20 = 520.40
    // TVA 10% lignes : (1320 + 864) * 0.10 = 2184 * 0.10 = 218.40
    const { ht, tva } = calcInvoiceTotals(lignes, "normal");
    expect(ht).toBeCloseTo(4786, 2);
    expect(tva).toBeCloseTo(738.8, 1);
  });

  it("gros chantier — montant > 100k€", () => {
    const { ht, tva } = calcInvoiceTotals([ouvrage(1, 142500, 20)], "normal");
    expect(ht).toBe(142500);
    expect(tva).toBe(28500);
  });
});
