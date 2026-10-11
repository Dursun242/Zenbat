import { describe, it, expect } from "vitest";
import { calcInvoiceTotals, invoiceAmounts, splitByRate, ventilatedLines } from "./invoiceCalc.js";

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

describe("calcInvoiceTotals — autoliquidation et arrondis", () => {
  it("autoliquidation BTP : TVA à 0 même avec des lignes à 20 %", () => {
    const { tva, ttc, tvaRows } = calcInvoiceTotals([ouvrage(10, 100, 20)], "normal", true);
    expect(tva).toBe(0);
    expect(ttc).toBe(1000);
    expect(tvaRows).toEqual([{ rate: 0, base: 1000, montant: 0 }]);
  });

  it("arrondit la TVA par taux, pas par ligne (BR-CO-14)", () => {
    // 2 lignes de 0,05 € à 10 % : par ligne on aurait 0,01 + 0,01 ;
    // par taux : base 0,10 € → TVA 0,01 €.
    const { ht, tva, ttc } = calcInvoiceTotals([ouvrage(1, 0.05, 10), ouvrage(1, 0.05, 10)], "normal");
    expect(ht).toBe(0.1);
    expect(tva).toBe(0.01);
    expect(ttc).toBe(0.11);
  });

  it("arrondit chaque total de ligne au centime", () => {
    const { ht } = calcInvoiceTotals([ouvrage(3, 0.333, 20)], "normal");
    expect(ht).toBe(1); // 0,999 → 1,00
  });

  it("utilise le taux du document pour une ligne sans taux", () => {
    const ligne = { type_ligne: "ouvrage", quantite: 1, prix_unitaire: 100 };
    expect(calcInvoiceTotals([ligne], "normal", false, 10).tva).toBe(10);
  });
});

describe("invoiceAmounts", () => {
  it("renvoie les trois montants à enregistrer", () => {
    expect(invoiceAmounts([ouvrage(2, 50, 10)], "normal")).toEqual({ montant_ht: 100, montant_tva: 10, montant_ttc: 110 });
  });
});

describe("splitByRate / ventilatedLines — acompte et solde", () => {
  const devis = [ouvrage(1, 3000, 10), ouvrage(1, 1000, 20)]; // 4000 HT : 75 % à 10 %, 25 % à 20 %

  it("ventile au prorata des taux du devis", () => {
    expect(splitByRate(1200, devis)).toEqual([{ rate: 10, ht: 900 }, { rate: 20, ht: 300 }]);
  });

  it("la somme retombe juste au centime", () => {
    const parts = splitByRate(100, [ouvrage(1, 1, 5.5), ouvrage(1, 1, 10), ouvrage(1, 1, 20)]);
    expect(parts.reduce((s, p) => s + p.ht, 0)).toBeCloseTo(100, 10);
  });

  it("une ligne par taux, TVA correcte sur un acompte de 30 % d'un devis à 10/20 %", () => {
    const lignes = ventilatedLines(1200, devis, { designation: "Acompte" });
    expect(lignes).toHaveLength(2);
    expect(lignes[0].designation).toBe("Acompte — part TVA 10 %");
    expect(invoiceAmounts(lignes, "normal")).toEqual({ montant_ht: 1200, montant_tva: 150, montant_ttc: 1350 });
  });

  it("devis à un seul taux : une seule ligne, libellé inchangé", () => {
    const lignes = ventilatedLines(500, [ouvrage(1, 2000, 5.5)], { designation: "Solde" });
    expect(lignes).toEqual([expect.objectContaining({ designation: "Solde", tva_rate: 5.5, prix_unitaire: 500 })]);
  });

  it("franchise ou autoliquidation : une ligne à 0 %", () => {
    const lignes = ventilatedLines(1200, devis, { noTva: true, designation: "Acompte" });
    expect(lignes).toEqual([expect.objectContaining({ tva_rate: 0, prix_unitaire: 1200 })]);
  });
});
