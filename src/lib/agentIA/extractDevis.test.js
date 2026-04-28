import { describe, it, expect } from "vitest";
import {
  extractDevisJson,
  applyVatRegime,
  rescaleToTarget,
  processDevisFromRaw,
} from "./extractDevis.js";

describe("extractDevisJson", () => {
  it("extrait le JSON quand la balise fermante est présente", () => {
    const raw = 'Voilà votre devis :\n<DEVIS>{"objet":"Test","lignes":[]}</DEVIS>\nMerci !';
    expect(extractDevisJson(raw)).toBe('{"objet":"Test","lignes":[]}');
  });

  it("extrait le JSON sans balise fermante en équilibrant les accolades", () => {
    const raw = '<DEVIS>{"objet":"Test","lignes":[{"q":1}]}\n\nAstuce : pensez à...';
    expect(extractDevisJson(raw)).toBe('{"objet":"Test","lignes":[{"q":1}]}');
  });

  it("retourne null si aucune balise <DEVIS>", () => {
    expect(extractDevisJson("Pas de devis ici")).toBeNull();
  });

  it("retourne null si <DEVIS> n'est pas suivi d'un objet JSON", () => {
    expect(extractDevisJson("<DEVIS>texte libre")).toBeNull();
  });

  it("ignore les accolades qui sont à l'intérieur de strings", () => {
    const raw = '<DEVIS>{"designation":"texte avec } accolade"}';
    expect(extractDevisJson(raw)).toBe('{"designation":"texte avec } accolade"}');
  });

  it("respecte les guillemets échappés dans les strings", () => {
    const raw = '<DEVIS>{"designation":"il a dit \\"oui\\"","prix":100}';
    expect(extractDevisJson(raw)).toBe('{"designation":"il a dit \\"oui\\"","prix":100}');
  });

  it("gère un nesting d'objets profond", () => {
    const raw = '<DEVIS>{"a":{"b":{"c":[1,2,{"d":3}]}}}';
    expect(extractDevisJson(raw)).toBe('{"a":{"b":{"c":[1,2,{"d":3}]}}}');
  });
});

describe("applyVatRegime", () => {
  const lignes = [
    { id: "1", type_ligne: "ouvrage", tva_rate: 20, prix_unitaire: 100 },
    { id: "2", type_ligne: "lot",     tva_rate: 20, designation: "Lot A" },
    { id: "3", type_ligne: "ouvrage", tva_rate: 5.5, prix_unitaire: 50 },
  ];

  it("retourne les lignes telles quelles si vatRegime n'est pas 'franchise'", () => {
    expect(applyVatRegime(lignes, "normal")).toBe(lignes);
    expect(applyVatRegime(lignes, undefined)).toBe(lignes);
  });

  it("force tva_rate=0 sur les ouvrages en franchise", () => {
    const out = applyVatRegime(lignes, "franchise");
    expect(out[0].tva_rate).toBe(0);
    expect(out[2].tva_rate).toBe(0);
  });

  it("ne modifie pas les lignes de type 'lot'", () => {
    const out = applyVatRegime(lignes, "franchise");
    expect(out[1].tva_rate).toBe(20);
  });

  it("est immuable : ne mute pas l'array d'origine", () => {
    const copy = JSON.parse(JSON.stringify(lignes));
    applyVatRegime(lignes, "franchise");
    expect(lignes).toEqual(copy);
  });
});

describe("rescaleToTarget", () => {
  const baseLignes = [
    { type_ligne: "ouvrage", quantite: 10, prix_unitaire: 100 }, // 1000
    { type_ligne: "ouvrage", quantite: 5,  prix_unitaire: 50 },  // 250
    { type_ligne: "lot",     designation: "Section" },
  ];

  it("ne fait rien si target n'est pas un nombre positif", () => {
    expect(rescaleToTarget(baseLignes, null)).toBe(baseLignes);
    expect(rescaleToTarget(baseLignes, 0)).toBe(baseLignes);
    expect(rescaleToTarget(baseLignes, "abc")).toBe(baseLignes);
  });

  it("ne fait rien si l'écart est inférieur à 0,5%", () => {
    // somme = 1250, target 1253 → écart 0,24%
    expect(rescaleToTarget(baseLignes, 1253)).toBe(baseLignes);
  });

  it("rescale proportionnellement vers la cible", () => {
    // somme = 1250, target 2500 → ratio 2
    const out = rescaleToTarget(baseLignes, 2500);
    const sum = out
      .filter(l => l.type_ligne === "ouvrage")
      .reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
    expect(sum).toBeCloseTo(2500, 2);
  });

  it("absorbe la dérive d'arrondi sur la dernière ligne ouvrage", () => {
    // target qui force une dérive sur 2 décimales
    const out = rescaleToTarget(baseLignes, 1333);
    const sum = out
      .filter(l => l.type_ligne === "ouvrage")
      .reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
    expect(sum).toBeCloseTo(1333, 2);
  });

  it("ne modifie pas les lignes de type 'lot'", () => {
    const out = rescaleToTarget(baseLignes, 2500);
    const lot = out.find(l => l.type_ligne === "lot");
    expect(lot).toEqual(baseLignes[2]);
  });
});

describe("processDevisFromRaw", () => {
  it("retourne null s'il n'y a pas de bloc <DEVIS>", () => {
    expect(processDevisFromRaw("Bonjour", { vatRegime: "normal" })).toBeNull();
  });

  it("retourne null si le JSON est mal formé", () => {
    const raw = '<DEVIS>{"objet":"test","lignes":[</DEVIS>';
    expect(processDevisFromRaw(raw, { vatRegime: "normal" })).toBeNull();
  });

  it("renvoie parsed + lignes avec id généré", () => {
    const raw = '<DEVIS>{"objet":"Travaux","lignes":[{"type_ligne":"ouvrage","quantite":1,"prix_unitaire":100,"tva_rate":20}]}</DEVIS>';
    const out = processDevisFromRaw(raw, { vatRegime: "normal" });
    expect(out.objet).toBe("Travaux");
    expect(out.lignes).toHaveLength(1);
    expect(out.lignes[0].id).toBeDefined();
    expect(out.lignes[0].tva_rate).toBe(20);
  });

  it("applique la franchise TVA via le pipeline", () => {
    const raw = '<DEVIS>{"lignes":[{"type_ligne":"ouvrage","quantite":1,"prix_unitaire":100,"tva_rate":20}]}</DEVIS>';
    const out = processDevisFromRaw(raw, { vatRegime: "franchise" });
    expect(out.lignes[0].tva_rate).toBe(0);
  });

  it("rescale les prix vers target_total_ht via le pipeline", () => {
    const raw = '<DEVIS>{"target_total_ht":2000,"lignes":[{"type_ligne":"ouvrage","quantite":10,"prix_unitaire":100,"tva_rate":20}]}</DEVIS>';
    const out = processDevisFromRaw(raw, { vatRegime: "normal" });
    const sum = out.lignes
      .filter(l => l.type_ligne === "ouvrage")
      .reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
    expect(sum).toBeCloseTo(2000, 2);
  });

  it("renvoie objet vide si parsed.objet est absent", () => {
    const raw = '<DEVIS>{"lignes":[]}</DEVIS>';
    const out = processDevisFromRaw(raw, { vatRegime: "normal" });
    expect(out.objet).toBe("");
  });
});
