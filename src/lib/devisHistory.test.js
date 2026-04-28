import { describe, it, expect } from "vitest";
import { buildDevisHistorySummary, formatHistoryPrompt } from "./devisHistory.js";

const makeDevis = (overrides = {}) => ({
  objet: "Devis test",
  statut: "accepte",
  montant_ht: 1000,
  date_emission: "2025-03-15",
  ville_chantier: "Paris",
  lignes: [
    { type_ligne: "lot", designation: "Lot A" },
    { type_ligne: "ouvrage", lot: "Lot A", designation: "Pose carrelage", unite: "m²", prix_unitaire: 65 },
  ],
  ...overrides,
});

describe("buildDevisHistorySummary", () => {
  it("retourne null pour un tableau vide ou invalide", () => {
    expect(buildDevisHistorySummary([])).toBeNull();
    expect(buildDevisHistorySummary(null)).toBeNull();
    expect(buildDevisHistorySummary(undefined)).toBeNull();
  });

  it("retourne null si aucun devis n'a de ligne ouvrage", () => {
    const devis = [{
      objet: "Sans ouvrage",
      lignes: [{ type_ligne: "lot", designation: "X" }],
    }];
    expect(buildDevisHistorySummary(devis)).toBeNull();
  });

  it("calcule le total et le montant moyen accepté", () => {
    const devis = [
      makeDevis({ statut: "accepte", montant_ht: 1000 }),
      makeDevis({ statut: "accepte", montant_ht: 2000 }),
      makeDevis({ statut: "envoye",  montant_ht: 5000 }),
    ];
    const result = buildDevisHistorySummary(devis);
    expect(result.total).toBe(3);
    expect(result.accepted).toBe(2);
    expect(result.avgValue).toBe(1500);
  });

  it("calcule le prix médian sur plusieurs occurrences", () => {
    // Pour le même libellé, prix : 50, 60, 70 → médiane 60
    const devis = [50, 60, 70].map(price =>
      makeDevis({
        lignes: [
          { type_ligne: "ouvrage", designation: "Pose carrelage 60×60", unite: "m²", prix_unitaire: price },
        ],
      })
    );
    const result = buildDevisHistorySummary(devis);
    expect(result.topOuvrages[0].medianPrice).toBe(60);
    expect(result.topOuvrages[0].count).toBe(3);
  });

  it("calcule la médiane sur un nombre pair (moyenne des deux centrales)", () => {
    const devis = [40, 50, 70, 80].map(price =>
      makeDevis({
        lignes: [{ type_ligne: "ouvrage", designation: "Item X", unite: "u", prix_unitaire: price }],
      })
    );
    const result = buildDevisHistorySummary(devis);
    expect(result.topOuvrages[0].medianPrice).toBe(60);
  });

  it("normalise les libellés (casse + espaces) pour agréger", () => {
    const devis = [
      makeDevis({ lignes: [{ type_ligne: "ouvrage", designation: "Pose Carrelage", unite: "m²", prix_unitaire: 60 }] }),
      makeDevis({ lignes: [{ type_ligne: "ouvrage", designation: "  pose   carrelage  ", unite: "m²", prix_unitaire: 70 }] }),
    ];
    const result = buildDevisHistorySummary(devis);
    expect(result.topOuvrages).toHaveLength(1);
    expect(result.topOuvrages[0].count).toBe(2);
  });

  it("récupère la plage de dates dateFrom/dateTo au format YYYY-MM", () => {
    const devis = [
      makeDevis({ date_emission: "2024-12-01" }),
      makeDevis({ date_emission: "2025-06-30" }),
    ];
    const result = buildDevisHistorySummary(devis);
    expect(result.dateFrom).toBe("2024-12");
    expect(result.dateTo).toBe("2025-06");
  });

  it("agrège les lots avec leur fréquence (nombre de devis distincts)", () => {
    const devis = [
      makeDevis({ lignes: [
        { type_ligne: "lot", designation: "PLOMBERIE" },
        { type_ligne: "ouvrage", lot: "PLOMBERIE", designation: "X", unite: "u", prix_unitaire: 100 },
        { type_ligne: "ouvrage", lot: "PLOMBERIE", designation: "Y", unite: "u", prix_unitaire: 100 }, // déjà compté
      ]}),
      makeDevis({ lignes: [
        { type_ligne: "lot", designation: "PLOMBERIE" },
        { type_ligne: "ouvrage", lot: "PLOMBERIE", designation: "Z", unite: "u", prix_unitaire: 100 },
      ]}),
    ];
    const result = buildDevisHistorySummary(devis);
    const plomberie = result.topLots.find(l => l.label === "PLOMBERIE");
    expect(plomberie.count).toBe(2);
  });

  it("trie les ouvrages par fréquence puis nombre de prix collectés", () => {
    const devis = [
      ...Array(3).fill(0).map(() => makeDevis({
        lignes: [{ type_ligne: "ouvrage", designation: "Pose A", unite: "m²", prix_unitaire: 50 }],
      })),
      makeDevis({ lignes: [{ type_ligne: "ouvrage", designation: "Pose B", unite: "m²", prix_unitaire: 60 }] }),
    ];
    const result = buildDevisHistorySummary(devis);
    expect(result.topOuvrages[0].label).toBe("Pose A");
    expect(result.topOuvrages[0].count).toBe(3);
  });

  it("limite recentDevis aux 6 plus récents", () => {
    const devis = Array(10).fill(0).map((_, i) => makeDevis({
      objet: `Devis ${i}`,
      date_emission: `2025-0${(i % 9) + 1}-01`,
    }));
    const result = buildDevisHistorySummary(devis);
    expect(result.recentDevis.length).toBeLessThanOrEqual(6);
  });
});

describe("formatHistoryPrompt", () => {
  it("retourne une chaîne vide pour un summary vide ou null", () => {
    expect(formatHistoryPrompt(null)).toBe("");
    expect(formatHistoryPrompt(undefined)).toBe("");
    expect(formatHistoryPrompt({ total: 0 })).toBe("");
  });

  it("formate l'en-tête avec le nombre de devis et la plage de dates", () => {
    const result = formatHistoryPrompt({
      total: 5, accepted: 2, avgValue: 3000,
      dateFrom: "2025-01", dateTo: "2025-06",
      topOuvrages: [], topLots: [], recentDevis: [],
    });
    expect(result).toContain("HISTORIQUE DE L'ENTREPRISE");
    expect(result).toContain("5 devis");
    expect(result).toContain("2025-01");
    expect(result).toContain("2025-06");
    expect(result).toContain("2 devis accepté");
    expect(result).toContain("3000");
  });

  it("inclut les tarifs habituels avec unité et fréquence", () => {
    const result = formatHistoryPrompt({
      total: 3, accepted: 0, avgValue: 0,
      topOuvrages: [{ label: "Pose carrelage", unite: "m²", medianPrice: 65, count: 3 }],
      topLots: [], recentDevis: [],
    });
    expect(result).toContain("TARIFS HABITUELS");
    expect(result).toContain("Pose carrelage");
    expect(result).toContain("/ m²");
    expect(result).toContain("65 €");
    expect(result).toContain("3× utilisé");
  });

  it("inclut les lots fréquents séparés par middot", () => {
    const result = formatHistoryPrompt({
      total: 2, accepted: 0, avgValue: 0,
      topOuvrages: [],
      topLots: [{ label: "PLOMBERIE", count: 2 }, { label: "ÉLECTRICITÉ", count: 1 }],
      recentDevis: [],
    });
    expect(result).toContain("PLOMBERIE (2×)");
    expect(result).toContain("ÉLECTRICITÉ (1×)");
    expect(result).toContain(" · ");
  });

  it("marque les devis signés / refusés dans la liste récente", () => {
    const result = formatHistoryPrompt({
      total: 3, accepted: 1, avgValue: 1000,
      topOuvrages: [], topLots: [],
      recentDevis: [
        { objet: "Cuisine", ville: "Lyon", statut: "accepte", montant: 5000 },
        { objet: "Salle de bain", ville: "Paris", statut: "refuse", montant: 3000 },
        { objet: "Brouillon", ville: "", statut: "envoye", montant: 2000 },
      ],
    });
    expect(result).toContain("✓ signé");
    expect(result).toContain("(refusé)");
    expect(result).toContain("Cuisine");
    expect(result).toContain("Lyon");
  });

  it("tronque le prompt au-delà de 5000 caractères", () => {
    const manyOuvrages = Array(500).fill(0).map((_, i) => ({
      label: `Ouvrage très long avec beaucoup de texte numéro ${i}`,
      unite: "m²",
      medianPrice: 100 + i,
      count: 5,
    }));
    const result = formatHistoryPrompt({
      total: 100, accepted: 50, avgValue: 1000,
      topOuvrages: manyOuvrages, topLots: [], recentDevis: [],
    });
    expect(result.length).toBeLessThanOrEqual(5100);
    expect(result).toContain("historique tronqué");
  });
});
