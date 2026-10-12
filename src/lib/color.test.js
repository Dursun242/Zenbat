import { describe, it, expect } from "vitest";
import { readableAccent, contrastWithWhite } from "./color.js";

describe("readableAccent", () => {
  it("garde une couleur déjà lisible", () => {
    expect(readableAccent("#A4461F")).toBe("#A4461F");
  });
  it("assombrit une couleur trop claire jusqu'au contraste AA", () => {
    const c = readableAccent("#22c55e");
    expect(contrastWithWhite("#22c55e")).toBeLessThan(4.5);
    expect(contrastWithWhite(c)).toBeGreaterThanOrEqual(4.5);
  });
  it("retombe sur l'encre si la couleur est invalide", () => {
    expect(readableAccent("")).toBe("#1A1612");
    expect(readableAccent("rouge")).toBe("#1A1612");
  });
});
