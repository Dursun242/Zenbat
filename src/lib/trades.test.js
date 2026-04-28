import { describe, it, expect } from "vitest";
import {
  ALL_TRADES,
  searchTrades,
  tradesLabels,
  firstDevisExampleFor,
  TRADE_EXAMPLES,
  BTP_TRADES,
} from "./trades.js";

describe("ALL_TRADES", () => {
  it("contient un nombre raisonnable d'entrées (>= 80)", () => {
    expect(ALL_TRADES.length).toBeGreaterThanOrEqual(80);
  });

  it("ne contient pas de doublons", () => {
    expect(new Set(ALL_TRADES).size).toBe(ALL_TRADES.length);
  });
});

describe("searchTrades", () => {
  it("renvoie [] pour une requête vide ou whitespace", () => {
    expect(searchTrades("")).toEqual([]);
    expect(searchTrades("   ")).toEqual([]);
  });

  it("trouve un métier par préfixe", () => {
    expect(searchTrades("plomb")).toContain("Plomberie");
  });

  it("ignore les accents (NFD)", () => {
    expect(searchTrades("electricite")).toContain("Électricité");
    expect(searchTrades("macon")).toContain("Maçonnerie");
  });

  it("est insensible à la casse", () => {
    expect(searchTrades("PLOMB")).toContain("Plomberie");
  });

  it("limite les résultats à 8", () => {
    const results = searchTrades("a");
    expect(results.length).toBeLessThanOrEqual(8);
  });
});

describe("tradesLabels", () => {
  it("renvoie [] pour aucun input", () => {
    expect(tradesLabels()).toEqual([]);
    expect(tradesLabels([])).toEqual([]);
  });

  it("convertit les anciens IDs BTP en labels", () => {
    expect(tradesLabels(["plomberie", "electricite"])).toEqual(["Plomberie", "Électricité"]);
  });

  it("conserve les labels modernes inchangés", () => {
    expect(tradesLabels(["Coiffure", "Photographie"])).toEqual(["Coiffure", "Photographie"]);
  });

  it("tolère un mélange ID legacy + label moderne", () => {
    expect(tradesLabels(["maconnerie", "Coiffure"])).toEqual(["Maçonnerie", "Coiffure"]);
  });
});

describe("firstDevisExampleFor", () => {
  it("renvoie un exemple générique sans métier", () => {
    const out = firstDevisExampleFor([]);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(10);
  });

  it("renvoie un exemple spécifique pour un métier connu", () => {
    const out = firstDevisExampleFor(["plomberie"]);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("fallback sur secteur si métier non mappé directement", () => {
    const out = firstDevisExampleFor(["Métier inexistant"]);
    expect(typeof out).toBe("string");
  });
});

describe("TRADE_EXAMPLES & BTP_TRADES", () => {
  it("TRADE_EXAMPLES expose au moins 4 métiers visibles", () => {
    expect(TRADE_EXAMPLES.length).toBeGreaterThanOrEqual(4);
  });

  it("BTP_TRADES expose des entrées { id, label }", () => {
    expect(BTP_TRADES.length).toBeGreaterThan(0);
    for (const t of BTP_TRADES) {
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("label");
    }
  });
});
