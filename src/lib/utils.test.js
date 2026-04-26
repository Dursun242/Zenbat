import { describe, it, expect } from "vitest";
import { uid, displayName, fmt } from "./utils.js";

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
