import { describe, it, expect } from "vitest";
import { iosViewportGap } from "./iosViewportGap.js";

describe("iosViewportGap", () => {
  it("état bogué mesuré sur iPhone (iOS 18.7) : 59 px à compenser", () => {
    expect(iosViewportGap({ outerHeight: 852, innerHeight: 793, visualHeight: 793, standalone: true })).toBe(59);
  });
  it("état normal : rien à compenser", () => {
    expect(iosViewportGap({ outerHeight: 852, innerHeight: 852, visualHeight: 852, standalone: true })).toBe(0);
  });
  it("clavier ouvert (grand écart) : pas de compensation", () => {
    expect(iosViewportGap({ outerHeight: 852, innerHeight: 500, visualHeight: 500, standalone: true })).toBe(0);
    expect(iosViewportGap({ outerHeight: 852, innerHeight: 852, visualHeight: 480, standalone: true })).toBe(0);
  });
  it("navigateur (pas installé) : jamais de compensation", () => {
    expect(iosViewportGap({ outerHeight: 852, innerHeight: 793, visualHeight: 793, standalone: false })).toBe(0);
  });
});
