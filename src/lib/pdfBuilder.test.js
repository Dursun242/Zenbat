import { describe, it, expect } from "vitest";
import { hexToRgb, mixRgb, pickTextColor } from "./pdfBuilder.js";

const WHITE = [255, 255, 255];
const DARK  = [26, 22, 18];

describe("hexToRgb", () => {
  it("convertit un hex 6 chiffres", () => {
    expect(hexToRgb("#22c55e")).toEqual([34, 197, 94]);
  });

  it("accepte un hex sans #", () => {
    expect(hexToRgb("ff0000")).toEqual([255, 0, 0]);
  });

  it("développe un hex 3 chiffres", () => {
    expect(hexToRgb("#f0a")).toEqual([255, 0, 170]);
  });

  it("retourne null sur input invalide", () => {
    expect(hexToRgb("zzzzzz")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
    expect(hexToRgb("")).toBeNull();
    expect(hexToRgb(null)).toBeNull();
    expect(hexToRgb(undefined)).toBeNull();
  });

  it("est insensible à la casse", () => {
    expect(hexToRgb("#FFAA00")).toEqual([255, 170, 0]);
    expect(hexToRgb("#ffaa00")).toEqual([255, 170, 0]);
  });
});

describe("mixRgb", () => {
  it("renvoie a si weight=1", () => {
    expect(mixRgb([100, 200, 50], [0, 0, 0], 1)).toEqual([100, 200, 50]);
  });

  it("renvoie b si weight=0", () => {
    expect(mixRgb([100, 200, 50], [10, 20, 30], 0)).toEqual([10, 20, 30]);
  });

  it("calcule la moyenne à weight=0.5", () => {
    expect(mixRgb([100, 100, 100], [200, 200, 200], 0.5)).toEqual([150, 150, 150]);
  });

  it("produit un fond léger à weight=0.15 (15% accent + 85% blanc)", () => {
    // accent vert sur blanc → fond très pâle vers le vert
    const out = mixRgb([34, 197, 94], WHITE, 0.15);
    expect(out[0]).toBeGreaterThan(220); // proche du blanc
    expect(out[1]).toBeGreaterThan(240);
    expect(out[2]).toBeGreaterThan(220);
    // mais avec une teinte verte (g > r et g > b)
    expect(out[1]).toBeGreaterThan(out[0]);
    expect(out[1]).toBeGreaterThan(out[2]);
  });
});

describe("pickTextColor", () => {
  it("renvoie texte sombre sur fond clair", () => {
    expect(pickTextColor([240, 235, 227])).toEqual(DARK); // beige clair
    expect(pickTextColor([255, 255, 200])).toEqual(DARK); // jaune clair
  });

  it("renvoie texte blanc sur fond foncé", () => {
    expect(pickTextColor([26, 22, 18])).toEqual(WHITE);   // noir chaud
    expect(pickTextColor([34, 50, 80])).toEqual(WHITE);   // bleu marine
    expect(pickTextColor([100, 30, 30])).toEqual(WHITE);  // rouge sombre
  });

  it("renvoie texte blanc sur la couleur Zenbat par défaut (terracotta)", () => {
    expect(pickTextColor([201, 123, 92])).toEqual(WHITE);
  });

  it("renvoie texte blanc sur les verts saturés moyens", () => {
    expect(pickTextColor([34, 197, 94])).toEqual(WHITE); // #22c55e (couleur par défaut)
  });
});
