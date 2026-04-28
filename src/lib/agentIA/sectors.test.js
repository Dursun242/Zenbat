import { describe, it, expect } from "vitest";
import {
  detectSectors,
  buildSectorContext,
  getBTPSubtradeContext,
  quickStartsFor,
  buildAgentGreeting,
  SECTOR_KEYWORDS,
  SECTOR_LABELS,
  SECTOR_QUICKSTARTS,
} from "./sectors.js";

describe("detectSectors", () => {
  it("retourne ['general'] quand aucun keyword ne matche", () => {
    expect(detectSectors([], "")).toEqual(["general"]);
    expect(detectSectors(["mot inconnu"], "")).toEqual(["general"]);
  });

  it("détecte le secteur BTP via les noms de métiers", () => {
    expect(detectSectors(["maçonnerie"], "")).toContain("btp");
    expect(detectSectors(["plomberie"], "")).toContain("btp");
    expect(detectSectors(["électricité", "chauffage"], "")).toContain("btp");
  });

  it("détecte un secteur via le fallback (nom d'entreprise)", () => {
    expect(detectSectors([], "Salon coiffure Léa")).toContain("beaute");
    expect(detectSectors([], "Boulangerie Dupont")).toContain("alimentaire");
  });

  it("peut retourner plusieurs secteurs simultanés", () => {
    const result = detectSectors(["plomberie", "coiffure"], "");
    expect(result).toContain("btp");
    expect(result).toContain("beaute");
  });

  it("est insensible à la casse", () => {
    expect(detectSectors(["MAÇONNERIE"], "")).toContain("btp");
    expect(detectSectors([], "BOULANGERIE")).toContain("alimentaire");
  });

  it("détecte le secteur tech", () => {
    expect(detectSectors(["développement web"], "")).toContain("tech");
    expect(detectSectors(["seo"], "")).toContain("tech");
  });
});

describe("buildSectorContext", () => {
  it("construit le contexte pour un seul secteur BTP", () => {
    const ctx = buildSectorContext(["btp"], "reel");
    expect(ctx.expertDomain).toContain("BTP");
    expect(ctx.units).toContain("m²");
    expect(ctx.pricing).toContain("BTP");
    expect(ctx.vocab).toBe("travaux / ouvrages");
    expect(ctx.tvaContext).toContain("TVA BTP");
  });

  it("utilise 'prestations / services' pour les non-BTP", () => {
    const ctx = buildSectorContext(["beaute"], "reel");
    expect(ctx.vocab).toBe("prestations / services");
  });

  it("applique la franchise TVA si vatRegime='franchise'", () => {
    const ctx = buildSectorContext(["btp"], "franchise");
    expect(ctx.tvaContext).toContain("franchise");
    expect(ctx.tvaContext).toContain("293 B");
    expect(ctx.tvaContext).toContain("tva_rate");
  });

  it("retourne le contexte par défaut quand aucun secteur n'a de TVA spécifique", () => {
    const ctx = buildSectorContext(["communication"], "reel");
    expect(ctx.tvaContext).toContain("20%");
  });

  it("agrège les unités sans doublons sur plusieurs secteurs", () => {
    const ctx = buildSectorContext(["btp", "beaute"], "reel");
    // h apparaît dans les deux : ne doit figurer qu'une fois
    const occurrences = (ctx.units.match(/\bh\b/g) || []).length;
    expect(occurrences).toBeLessThanOrEqual(1);
  });

  it("expose le label du secteur dans expertDomain", () => {
    const ctx = buildSectorContext(["sante"], "reel");
    expect(ctx.expertDomain).toBe(SECTOR_LABELS.sante);
  });
});

describe("getBTPSubtradeContext", () => {
  it("retourne null si aucun trade ne matche", () => {
    expect(getBTPSubtradeContext([])).toBeNull();
    expect(getBTPSubtradeContext(["foobar"])).toBeNull();
    expect(getBTPSubtradeContext(null)).toBeNull();
  });

  it("retourne le bloc de connaissance pour électricité", () => {
    const ctx = getBTPSubtradeContext(["Électricité"]);
    expect(ctx).toContain("NF C 15-100");
    expect(ctx).toContain("CONSUEL");
  });

  it("agrège plusieurs sous-métiers", () => {
    const ctx = getBTPSubtradeContext(["Plomberie", "Couverture / Zinguerie"]);
    expect(ctx).toContain("DTU 60.1");
    expect(ctx).toContain("DTU 40");
  });

  it("est insensible à la casse", () => {
    const ctx = getBTPSubtradeContext(["PLOMBERIE"]);
    expect(ctx).toContain("DTU 60.1");
  });
});

describe("quickStartsFor", () => {
  it("retourne les quickstarts généraux pour un brand vide", () => {
    expect(quickStartsFor({})).toEqual(SECTOR_QUICKSTARTS.general);
    expect(quickStartsFor(null)).toEqual(SECTOR_QUICKSTARTS.general);
  });

  it("retourne les quickstarts BTP pour un artisan plombier", () => {
    const result = quickStartsFor({ trades: ["plomberie"] });
    expect(result).toEqual(SECTOR_QUICKSTARTS.btp);
  });

  it("retourne 4 suggestions pour chaque secteur", () => {
    Object.values(SECTOR_QUICKSTARTS).forEach(arr => {
      expect(arr).toHaveLength(4);
      expect(arr.every(s => typeof s === "string" && s.length > 0)).toBe(true);
    });
  });
});

describe("buildAgentGreeting", () => {
  it("inclut une salutation et un exemple", () => {
    const result = buildAgentGreeting({});
    expect(result).toMatch(/Bonjour/);
    expect(result).toContain("**");
    expect(result).toMatch(/Ex *: */);
  });

  it("adapte le domaine d'expertise au métier", () => {
    const result = buildAgentGreeting({ trades: ["coiffure"] });
    expect(result.toLowerCase()).toContain("beauté");
  });

  it("tolère un brand null/undefined", () => {
    expect(() => buildAgentGreeting(null)).not.toThrow();
    expect(() => buildAgentGreeting(undefined)).not.toThrow();
  });
});

describe("SECTOR_KEYWORDS / SECTOR_LABELS cohérence", () => {
  it("chaque clé de SECTOR_KEYWORDS a un label correspondant", () => {
    for (const sector of Object.keys(SECTOR_KEYWORDS)) {
      expect(SECTOR_LABELS[sector]).toBeDefined();
    }
  });

  it("chaque clé de SECTOR_KEYWORDS a un quickstart", () => {
    for (const sector of Object.keys(SECTOR_KEYWORDS)) {
      expect(SECTOR_QUICKSTARTS[sector]).toBeDefined();
    }
  });
});
