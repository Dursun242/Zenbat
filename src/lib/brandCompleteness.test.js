import { describe, it, expect } from "vitest";
import { brandCompleteness } from "./brandCompleteness.js";

const FULL_BRAND = {
  // critical
  companyName: "Zenbat SARL",
  siret: "12345678900015",
  address: "12 rue des Artisans",
  city: "75001 Paris",
  phone: "0123456789",
  email: "contact@zenbat.fr",
  iban: "FR7612345678901234567890123",
  mentionsLegales: "Assurance MAAF — Régime franchise TVA",
  // recommended
  logo: "https://example.com/logo.png",
  tva: "FR12345678900",
  website: "https://zenbat.fr",
  bic: "BNPAFRPP",
  trades: ["plombier", "chauffagiste"],
};

describe("brandCompleteness", () => {
  it("retourne 100% et niveau 'pro' avec un profil complet", () => {
    const result = brandCompleteness(FULL_BRAND);
    expect(result.percent).toBe(100);
    expect(result.level.id).toBe("pro");
    expect(result.isCleanQuote).toBe(true);
    expect(result.missingCritical).toEqual([]);
    expect(result.missingRecommended).toEqual([]);
  });

  it("retourne 0% et niveau 'basic' sur un objet vide", () => {
    const result = brandCompleteness({});
    expect(result.percent).toBe(0);
    expect(result.level.id).toBe("basic");
    expect(result.isCleanQuote).toBe(false);
  });

  it("tolère un brand null/undefined sans crasher", () => {
    expect(() => brandCompleteness(null)).not.toThrow();
    expect(() => brandCompleteness(undefined)).not.toThrow();
    const result = brandCompleteness(null);
    expect(result.level.id).toBe("basic");
  });

  it("compte un champ rempli avec un tableau non vide (trades)", () => {
    const result = brandCompleteness({ ...FULL_BRAND, trades: ["plombier"] });
    expect(result.missingRecommended).toEqual([]);
  });

  it("traite un tableau vide comme manquant", () => {
    const result = brandCompleteness({ ...FULL_BRAND, trades: [] });
    expect(result.missingRecommended.some(f => f.key === "trades")).toBe(true);
  });

  it("traite une chaîne d'espaces blancs comme manquante", () => {
    const result = brandCompleteness({ ...FULL_BRAND, companyName: "   " });
    expect(result.missingCritical.some(f => f.key === "companyName")).toBe(true);
  });

  it("niveau 'partial' (Correct) avec 1-4 champs critiques manquants", () => {
    const partial = { ...FULL_BRAND };
    delete partial.iban;
    const result = brandCompleteness(partial);
    expect(result.level.id).toBe("partial");
    expect(result.missingCritical).toHaveLength(1);
    expect(result.isCleanQuote).toBe(false);
  });

  it("niveau 'basic' (À compléter) à partir de 5 champs critiques manquants", () => {
    const minimal = { companyName: "X", siret: "123", address: "Y" };
    const result = brandCompleteness(minimal);
    expect(result.level.id).toBe("basic");
    expect(result.missingCritical.length).toBeGreaterThanOrEqual(5);
  });

  it("niveau 'good' avec uniquement des recommandés manquants", () => {
    const noRecommended = { ...FULL_BRAND };
    delete noRecommended.logo;
    const result = brandCompleteness(noRecommended);
    expect(result.level.id).toBe("good");
    expect(result.isCleanQuote).toBe(true);
    expect(result.missingCritical).toEqual([]);
    expect(result.missingRecommended.some(f => f.key === "logo")).toBe(true);
  });

  it("calcule un pourcentage cohérent (arrondi)", () => {
    // 13 champs au total ; 1 manquant ⇒ 12/13 = 92.3 → 92
    const partial = { ...FULL_BRAND };
    delete partial.bic;
    const result = brandCompleteness(partial);
    expect(result.percent).toBe(92);
  });

  it("expose les métadonnées de chaque champ manquant (label, step, impact)", () => {
    const result = brandCompleteness({ siret: "123" });
    const missingCompany = result.missingCritical.find(f => f.key === "companyName");
    expect(missingCompany.label).toBe("Nom de l'entreprise");
    expect(missingCompany.step).toBe(0);
    expect(missingCompany.impact).toMatch(/en-tête/);
  });
});
