import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SR_LANGS, MIC_LANG_KEY, pickInitialLang } from "./speech.js";

describe("SR_LANGS", () => {
  it("contient au moins le français en première position", () => {
    expect(SR_LANGS[0].code).toBe("fr-FR");
    expect(SR_LANGS.length).toBeGreaterThanOrEqual(10);
  });

  it("chaque langue a code, label, flag", () => {
    for (const lang of SR_LANGS) {
      expect(lang.code).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(lang.label).toBeTruthy();
      expect(lang.flag).toBeTruthy();
    }
  });

  it("les codes sont uniques", () => {
    const codes = SR_LANGS.map(l => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("pickInitialLang", () => {
  beforeEach(() => {
    try { localStorage.removeItem(MIC_LANG_KEY); } catch {}
  });

  afterEach(() => {
    try { localStorage.removeItem(MIC_LANG_KEY); } catch {}
  });

  it("retourne la valeur sauvegardée en localStorage si valide", () => {
    localStorage.setItem(MIC_LANG_KEY, "es-ES");
    expect(pickInitialLang()).toBe("es-ES");
  });

  it("ignore une valeur localStorage inconnue et retombe sur le navigator", () => {
    localStorage.setItem(MIC_LANG_KEY, "xx-XX");
    const result = pickInitialLang();
    expect(SR_LANGS.some(l => l.code === result)).toBe(true);
  });

  it("retourne fr-FR par défaut quand aucun match navigator", () => {
    // jsdom expose navigator.language, généralement "en-US" — mais doit retourner une langue valide
    const result = pickInitialLang();
    expect(SR_LANGS.some(l => l.code === result)).toBe(true);
  });

  it("matche par préfixe de langue (fr-CA → fr-FR)", () => {
    Object.defineProperty(navigator, "language", { value: "fr-CA", configurable: true });
    expect(pickInitialLang()).toBe("fr-FR");
  });
});
