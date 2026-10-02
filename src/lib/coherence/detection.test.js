import { describe, it, expect } from "vitest";
import { runCoherenceCheck, findTypologyForText } from "./engine.js";

// Cas réels du banc de test Mistral (110 prompts, 2026-10-02) : typologies
// reconnues à tort, qui déclenchaient la boucle de correction sur des devis
// pourtant corrects.
const typo = (objet, lots = []) => runCoherenceCheck({
  objet,
  lignes: lots.map(l => ({ type_ligne: "lot", designation: l })),
}).typology_id;

describe("Détection de la typologie", () => {
  it("« ite » n'est reconnu que comme mot entier (pas site / conduite / stéatite)", () => {
    expect(typo("Remplacement chauffe-eau électrique 200L stéatite — forfait")).toBeNull();
    expect(typo("Création site vitrine WordPress — 6 pages")).toBeNull();
    expect(typo("Audit SEO complet site e-commerce — 200 pages")).toBeNull();
    expect(typo("Forfait permis B — 20h de conduite + code")).toBeNull();
    expect(typo("Traduction site web FR→EN — 8 000 mots")).toBeNull();
    expect(typo("Rédaction CGV et CGU pour site e-commerce — forfait")).toBeNull();
    expect(typo("ITE polystyrène 16 cm + enduit minéral — 120 m²")).toBe("ite_facade");
  });

  it("extension : pas pour un mur de soutènement, un permis de construire ou une maison neuve", () => {
    expect(typo("Mur de soutènement BA H=2m — 12 ml", ["GROS ŒUVRE"])).toBeNull();
    expect(typo("Permis de construire pour extension neuve 30 m² — Dossier complet")).toBeNull();
    expect(typo("Construction maison neuve 120 m² clé en main — hors fondations", ["Gros œuvre", "Charpente"])).toBeNull();
    expect(typo("Extension neuve ossature bois 25 m² — de A à Z")).toBe("extension_neuve_go");
  });

  it("le mot-clé le plus précis l'emporte", () => {
    expect(typo("Rénovation totale appartement 65 m² — tous corps d'état", ["Gros œuvre"])).toBe("renovation_interieure");
    expect(typo("Rénovation complète plomberie salle de bain — clé en main")).toBe("renovation_sdb");
    expect(typo("Rénovation complète salle de bain — 6 m² — clé en main")).toBe("renovation_sdb");
    expect(typo("Pose sanitaires — WC suspendu + meuble vasque + douche italienne")).toBeNull();
  });

  it("accents et casse ignorés", () => {
    expect(typo("RENOVATION PEINTURE appartement T3")).toBe("renovation_peinture_interieure");
    expect(findTypologyForText("isolation par l’extérieur de la maison")?.typology_id).toBe("ite_facade"); // apostrophe typographique
    expect(findTypologyForText("devis ITE 120 m2")?.typology_id).toBe("ite_facade");
  });
});

describe("Contrôles moins stricts pour une demande partielle", () => {
  it("lots manquants d'une salle de bain partielle : avertissement, pas d'échec", () => {
    const r = runCoherenceCheck({
      objet: "Salle de bain : remplacement baignoire par douche",
      lignes: [{ type_ligne: "ouvrage", lot: "Plomberie", designation: "Remplacement WC", unite: "u", quantite: 1, prix_unitaire: 400 }],
    });
    expect(r.typology_id).toBe("renovation_sdb");
    expect(r.checks.find(c => c.checker === "CompletenessChecker").status).toBe("warn");
  });

  it("prix unitaire : un mur de soutènement au ml n'est pas comparé à une dalle au m²", () => {
    const r = runCoherenceCheck({
      objet: "Extension maison gros œuvre 30 m²",
      lignes: [{ type_ligne: "ouvrage", lot: "Gros œuvre", designation: "Mur de soutènement béton armé H=2m", unite: "ml", quantite: 12, prix_unitaire: 450 }],
    });
    expect(r.checks.find(c => c.checker === "UnitPriceChecker").issues).toEqual([]);
  });
});
