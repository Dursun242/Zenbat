import { describe, it, expect } from "vitest";
import { uid, displayName, fmt, isValidEmail, sanitizeEmail } from "./utils.js";

describe("uid", () => {
  it("génère une chaîne non vide", () => {
    expect(typeof uid()).toBe("string");
    expect(uid().length).toBeGreaterThan(0);
  });
  it("génère des valeurs uniques", () => {
    const ids = new Set(Array.from({ length: 100 }, uid));
    expect(ids.size).toBe(100);
  });
});

describe("displayName", () => {
  it("utilise la raison_sociale en priorité", () => {
    expect(displayName({ raison_sociale: "Dupont SAS", nom: "Dupont", prenom: "Jean" })).toBe("Dupont SAS");
  });
  it("concatène prénom + nom si pas de raison_sociale", () => {
    expect(displayName({ nom: "Martin", prenom: "Sophie" })).toBe("Sophie Martin");
  });
  it("ignore les espaces vides dans raison_sociale", () => {
    expect(displayName({ raison_sociale: "   ", nom: "Martin", prenom: "Sophie" })).toBe("Sophie Martin");
  });
  it("renvoie — pour un client null/undefined", () => {
    expect(displayName(null)).toBe("—");
    expect(displayName(undefined)).toBe("—");
  });
  it("renvoie — si tout est vide", () => {
    expect(displayName({ raison_sociale: "", nom: "", prenom: "" })).toBe("—");
  });
  it("fonctionne avec seulement un nom", () => {
    expect(displayName({ nom: "Legrand" })).toBe("Legrand");
  });
});

describe("fmt", () => {
  it("formate en euros avec centimes", () => {
    const result = fmt(1500.5);
    expect(result).toContain("1");
    expect(result).toContain("€");
  });
  it("accepte 0", () => {
    expect(fmt(0)).toContain("0");
  });
});

describe("sanitizeEmail", () => {
  it("supprime les espaces internes (cas mobile Kontelec)", () => {
    expect(sanitizeEmail("Kontelec76@gmail. Com")).toBe("Kontelec76@gmail.Com");
  });
  it("supprime les espaces en début et fin", () => {
    expect(sanitizeEmail("   user@example.fr   ")).toBe("user@example.fr");
  });
  it("supprime les espaces insécables (U+00A0)", () => {
    expect(sanitizeEmail("user @example.fr")).toBe("user@example.fr");
  });
  it("renvoie une chaîne vide pour null/undefined", () => {
    expect(sanitizeEmail(null)).toBe("");
    expect(sanitizeEmail(undefined)).toBe("");
  });
});

describe("isValidEmail", () => {
  it("accepte les formats standards", () => {
    expect(isValidEmail("user@example.fr")).toBe(true);
    expect(isValidEmail("first.last@sub.domain.co")).toBe(true);
    expect(isValidEmail("kontelec76@gmail.com")).toBe(true);
  });
  it("rejette les emails sans @", () => {
    expect(isValidEmail("plainstring")).toBe(false);
    expect(isValidEmail("user.example.fr")).toBe(false);
  });
  it("rejette les emails sans domaine", () => {
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("@example.fr")).toBe(false);
  });
  it("rejette les emails sans TLD", () => {
    expect(isValidEmail("user@example")).toBe(false);
  });
  it("accepte après sanitize (espaces internes retirés)", () => {
    expect(isValidEmail(" Kontelec76@gmail.com ")).toBe(true);
    // Cas réel observé en prod : autocap iOS + espace → toujours rattrapable
    // par sanitize. Le domaine `gmail.Com` reste valide (casse non significative).
    expect(isValidEmail("Kontelec76@gmail. Com")).toBe(true);
  });
  it("rejette si après sanitize il manque toujours @ ou TLD", () => {
    expect(isValidEmail("kontelec76 gmail.com")).toBe(false);
    expect(isValidEmail("kontelec76@gmail")).toBe(false);
  });
  it("rejette une chaîne vide", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });
});
