import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompt.js";

describe("buildSystemPrompt", () => {
  it("retourne un prompt non vide pour un brand minimal", () => {
    const result = buildSystemPrompt({ brand: {}, historySummary: null });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(500);
  });

  it("contient les sections obligatoires (règles, format, exemples)", () => {
    const result = buildSystemPrompt({ brand: {}, historySummary: null });
    expect(result).toContain("RÈGLE N°1");
    expect(result).toContain("FORMAT DE SORTIE");
    expect(result).toContain("<DEVIS>");
    expect(result).toContain("</DEVIS>");
    expect(result).toContain("EXEMPLES");
  });

  it("inclut la liste des métiers quand brand.trades est fourni", () => {
    const result = buildSystemPrompt({
      brand: { trades: ["plomberie", "electricite"] },
      historySummary: null,
    });
    expect(result).toContain("Métiers :");
    expect(result).toContain("Plomberie");
    expect(result).toContain("Électricité");
  });

  it("affiche un fallback générique sans métiers", () => {
    const result = buildSystemPrompt({ brand: {}, historySummary: null });
    expect(result).toContain("Artisan ou prestataire");
  });

  it("expose le domaine d'expertise BTP pour un plombier", () => {
    const result = buildSystemPrompt({
      brand: { trades: ["plomberie"] },
      historySummary: null,
    });
    expect(result).toContain("BTP");
  });

  it("inclut le contexte TVA franchise si vatRegime='franchise'", () => {
    const result = buildSystemPrompt({
      brand: { trades: ["plomberie"], vatRegime: "franchise" },
      historySummary: null,
    });
    expect(result).toContain("franchise");
    expect(result).toContain("293 B");
  });

  it("inclut le contexte technique BTP pour un sous-métier connu", () => {
    const result = buildSystemPrompt({
      brand: { trades: ["plomberie"] },
      historySummary: null,
    });
    expect(result).toContain("CONNAISSANCE TECHNIQUE MÉTIER");
    expect(result).toContain("DTU 60.1");
  });

  it("n'ajoute pas de bloc CONNAISSANCE TECHNIQUE pour un secteur non-BTP", () => {
    const result = buildSystemPrompt({
      brand: { trades: ["coiffure"] },
      historySummary: null,
    });
    expect(result).not.toContain("CONNAISSANCE TECHNIQUE MÉTIER");
  });

  it("inclut l'historique quand un summary est fourni", () => {
    const summary = {
      total: 5,
      accepted: 2,
      avgValue: 3000,
      dateFrom: "2025-01",
      dateTo: "2025-06",
      topOuvrages: [{ label: "Pose carrelage", unite: "m²", medianPrice: 65, count: 3 }],
      topLots: [{ label: "CARRELAGE", count: 3 }],
      recentDevis: [],
    };
    const result = buildSystemPrompt({ brand: {}, historySummary: summary });
    expect(result).toContain("HISTORIQUE DE L'ENTREPRISE");
    expect(result).toContain("Pose carrelage");
  });

  it("rappelle le format JSON et la langue de réponse", () => {
    const result = buildSystemPrompt({ brand: {}, historySummary: null });
    expect(result).toContain("LANGUE");
    expect(result).toContain("français");
    expect(result).toContain("champs_a_completer");
    expect(result).toContain("suggestions");
  });

  it("inclut la règle anti-débordement : prestation nommée = TYPE 2 strict, tous secteurs", () => {
    const result = buildSystemPrompt({ brand: {}, historySummary: null });
    // La règle générique qui empêche le débordement de périmètre
    expect(result).toContain("CAS CRITIQUE");
    expect(result).toMatch(/JAMAIS TYPE 3/);
    expect(result).toMatch(/qualifier précis.*l'emporte TOUJOURS/);
    // Couvre plusieurs secteurs (pas que BTP)
    expect(result).toContain("rénovation électrique");
    expect(result).toContain("coupe + couleur");
    expect(result).toContain("création logo");
    expect(result).toContain("buffet cocktail");
    expect(result).toContain("reportage photo");
    expect(result).toContain("retouche pantalon");
    // Heuristique de tie-break : en cas de doute, TYPE 2
    expect(result).toMatch(/HÉSITES.*TYPE 2/);
  });
});
