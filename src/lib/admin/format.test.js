import { describe, it, expect } from "vitest";
import { fmtEur, fmtD, fmtDT, pct, relTime, SC, SL, SORT_OPTS } from "./format.js";

describe("fmtEur", () => {
  it("formate un nombre en euros FR", () => {
    expect(fmtEur(1000)).toBe("1 000 €");
  });
  it("accepte 0", () => {
    expect(fmtEur(0)).toBe("0 €");
  });
  it("accepte undefined/null → 0 €", () => {
    expect(fmtEur(undefined)).toBe("0 €");
    expect(fmtEur(null)).toBe("0 €");
  });
  it("arrondit à l'entier", () => {
    expect(fmtEur(1234.567)).toBe("1 235 €");
  });
});

describe("pct", () => {
  it("calcule le pourcentage", () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(3, 3)).toBe(100);
    expect(pct(0, 10)).toBe(0);
  });
  it("renvoie 0 si dénominateur est 0", () => {
    expect(pct(5, 0)).toBe(0);
  });
  it("arrondit à l'entier", () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
  });
});

describe("fmtD", () => {
  it("formate une date ISO en date FR", () => {
    const result = fmtD("2026-04-26");
    expect(result).toMatch(/26\/04\/2026|26\/4\/26/); // robuste selon locale système
  });
  it("renvoie — pour une valeur falsy", () => {
    expect(fmtD(null)).toBe("—");
    expect(fmtD("")).toBe("—");
    expect(fmtD(undefined)).toBe("—");
  });
});

describe("relTime", () => {
  it("renvoie Auj. pour aujourd'hui", () => {
    expect(relTime(new Date().toISOString())).toBe("Auj.");
  });
  it("renvoie — pour une valeur falsy", () => {
    expect(relTime(null)).toBe("—");
    expect(relTime(undefined)).toBe("—");
  });
  it("renvoie Hier pour hier", () => {
    const hier = new Date(Date.now() - 86400000).toISOString();
    expect(relTime(hier)).toBe("Hier");
  });
  it("renvoie Xj pour moins de 30 jours", () => {
    const il_y_a_5j = new Date(Date.now() - 5 * 86400000).toISOString();
    expect(relTime(il_y_a_5j)).toBe("5j");
  });
  it("renvoie Xm pour moins d'un an", () => {
    const il_y_a_2m = new Date(Date.now() - 65 * 86400000).toISOString();
    expect(relTime(il_y_a_2m)).toBe("2m");
  });
});

describe("SC / SL", () => {
  it("contient tous les statuts devis", () => {
    const statuts = ["brouillon", "envoye", "en_signature", "accepte", "refuse"];
    for (const s of statuts) {
      expect(SC).toHaveProperty(s);
      expect(SL).toHaveProperty(s);
    }
  });
  it("les couleurs SC sont des valeurs hex valides", () => {
    for (const color of Object.values(SC)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("SORT_OPTS", () => {
  it("contient au moins 3 options", () => {
    expect(SORT_OPTS.length).toBeGreaterThanOrEqual(3);
  });
  it("chaque option a une valeur et un libellé", () => {
    for (const opt of SORT_OPTS) {
      expect(opt).toHaveProperty("v");
      expect(opt).toHaveProperty("l");
    }
  });
});
