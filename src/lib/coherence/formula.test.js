import { describe, it, expect } from "vitest";
import { evaluateFormula } from "./formula.js";

describe("evaluateFormula", () => {
  it("évalue une expression arithmétique simple", () => {
    expect(evaluateFormula("2 + 3", {})).toBe(5);
    expect(evaluateFormula("10 - 4", {})).toBe(6);
    expect(evaluateFormula("6 * 7", {})).toBe(42);
    expect(evaluateFormula("20 / 4", {})).toBe(5);
  });

  it("substitue les variables nommées par leur valeur", () => {
    expect(evaluateFormula("a + b", { a: 3, b: 4 })).toBe(7);
    expect(evaluateFormula("surface * hauteur", { surface: 20, hauteur: 2.5 })).toBe(50);
  });

  it("respecte la priorité des opérateurs et les parenthèses", () => {
    expect(evaluateFormula("2 + 3 * 4", {})).toBe(14);
    expect(evaluateFormula("(2 + 3) * 4", {})).toBe(20);
  });

  it("remplace les clés les plus longues d'abord (évite les sous-chaînes)", () => {
    // surface_sol doit être remplacé avant surface, sinon "surface_sol" deviendrait "20_sol"
    const result = evaluateFormula("surface_sol * 2", { surface: 10, surface_sol: 35 });
    expect(result).toBe(70);
  });

  it("gère les valeurs décimales", () => {
    expect(evaluateFormula("hauteur * 2", { hauteur: 2.5 })).toBe(5);
    expect(evaluateFormula("0.5 + 0.25", {})).toBe(0.75);
  });

  it("rejette une formule contenant du code injecté après substitution", () => {
    expect(() => evaluateFormula("alert(1)", {})).toThrow(/Invalid formula/);
    expect(() => evaluateFormula("constructor", {})).toThrow(/Invalid formula/);
    expect(() => evaluateFormula("a + b", { a: "1; process.exit()", b: 2 })).toThrow();
  });

  it("rejette les variables non-numériques en silence (ignore la substitution)", () => {
    // Une valeur NaN n'est pas substituée → la formule reste invalide → throw
    expect(() => evaluateFormula("a + 1", { a: "abc" })).toThrow(/Invalid formula/);
  });

  it("ignore les variables non utilisées dans la formule", () => {
    expect(evaluateFormula("a + 1", { a: 5, unused: 999 })).toBe(6);
  });

  it("lève une erreur sur formule vide ou invalide", () => {
    expect(() => evaluateFormula("a + b", {})).toThrow();
  });

  it("préserve le mode strict (pas de fuite globale)", () => {
    // Si la formule pouvait s'évader, elle pourrait modifier globalThis
    expect(() => evaluateFormula("this.x = 1", {})).toThrow();
  });
});
