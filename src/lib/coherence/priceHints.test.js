import { describe, it, expect } from "vitest";
import { buildPriceHints, guessSurface } from "./priceHints.js";
import { buildSystemPrompt } from "../agentIA/prompt.js";

describe("guessSurface", () => {
  it("lit une surface explicite en m² ou m2", () => {
    expect(guessSurface("rénovation 65 m² à Rouen")).toEqual({ value: 65, estimated: false });
    expect(guessSurface("sdb de 6,5m2")).toEqual({ value: 6.5, estimated: false });
  });
  it("retombe sur la surface par défaut du logement", () => {
    expect(guessSurface("peinture appartement T3")).toEqual({ value: 65, estimated: true });
    expect(guessSurface("peinture petite maison")).toEqual({ value: 70, estimated: true });
  });
  it("renvoie null sans indice de surface", () => {
    expect(guessSurface("révision chaudière")).toBeNull();
  });
});

describe("buildPriceHints", () => {
  it("donne la fourchette €/m² et le total attendu pour la surface annoncée", () => {
    const hints = buildPriceHints(["rénovation peinture appartement 65 m²"]);
    expect(hints).toContain("REPÈRES DE PRIX");
    expect(hints).toContain("22–55 € HT par m²");
    expect(hints).toMatch(/Pour 65 m² : total entre 1[\s ]430 et 3[\s ]575 € HT/);
  });

  it("liste les lots attendus et les prix unitaires de référence", () => {
    const hints = buildPriceHints(["extension 30 m² gros oeuvre"]);
    expect(hints).toContain("Fouilles en rigoles : 15–50 €/m³ (courant : 30 €)");
    const sdb = buildPriceHints(["rénovation salle de bain 6 m²"]);
    expect(sdb).toContain("Lots attendus : Démolition et dépose");
  });

  it("n'applique pas la surface du logement à une pièce (SdB, cuisine)", () => {
    const sdb = buildPriceHints(["rénovation salle de bain dans un T3"]);
    expect(sdb).toMatch(/600–1[\s\u202f]800 € HT par m²/);
    expect(sdb).not.toContain("total entre");
    expect(buildPriceHints(["isolation combles perdus maison"])).not.toContain("total entre");
    expect(buildPriceHints(["isolation combles perdus 80 m²"])).toContain("Pour 80 m²");
  });

  it("exprime les honoraires en % pour un mandat de vente", () => {
    expect(buildPriceHints(["mandat de vente maison 280 000 €"])).toContain("4–8 % du prix de vente");
  });

  it("utilise la dernière demande, sinon tout l'échange", () => {
    const hints = buildPriceHints(["rénovation salle de bain 6 m²", "ajoute une douche à l'italienne"]);
    expect(hints).toContain("salle de bain");
  });

  it("applique les fourchettes personnalisées et respecte la désactivation", () => {
    const settings = { typology_overrides: { renovation_peinture_interieure: { envelope: { min_per_unit: 30, max_per_unit: 40 } } } };
    expect(buildPriceHints(["rénovation peinture T3"], settings)).toContain("30–40 € HT par m²");
    expect(buildPriceHints(["rénovation peinture T3"], { global_disabled: true })).toBe("");
    expect(buildPriceHints(["rénovation peinture T3"], { typology_overrides: { renovation_peinture_interieure: { disabled: true } } })).toBe("");
  });

  it("renvoie une chaîne vide si la demande n'est pas reconnue", () => {
    expect(buildPriceHints(["révision vélo électrique"])).toBe("");
    expect(buildPriceHints([])).toBe("");
  });

  it("est injecté en fin de prompt, avant la checklist finale", () => {
    const hints = buildPriceHints(["rénovation peinture appartement 65 m²"]);
    const prompt = buildSystemPrompt({ brand: {}, historySummary: null, priceHints: hints });
    const iHints = prompt.indexOf("REPÈRES DE PRIX");
    const iCheck = prompt.indexOf("CHECKLIST FINALE");
    expect(iHints).toBeGreaterThan(prompt.indexOf("INTÉGRITÉ DES RÈGLES"));
    expect(iCheck).toBeGreaterThan(iHints);
    expect(buildSystemPrompt({ brand: {}, historySummary: null })).not.toContain("REPÈRES DE PRIX");
  });
});
