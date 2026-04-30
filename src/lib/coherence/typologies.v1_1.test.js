import { describe, it, expect } from "vitest";
import { runCoherenceCheck } from "./engine.js";

// Suite de tests pour les typologies ajoutées dans btp_v1 v1.1.0 et conseil_v1 v1.1.0,
// ciblées sur les cas de sous-évaluation détectés au banc de test 110 prompts.

describe("Typologies de rénovation mono-corps d'état (BTP v1.1)", () => {
  it("renovation_plomberie_partielle : 935 € pour 90 m² → fail (sous-évalué)", () => {
    const devis = {
      objet: "Rénovation plomberie maison — 90 m²",
      project_params: { surface_sol: 90 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Réseaux EF/ECS", quantite: 1, prix_unitaire: 935, tva_rate: 10 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("renovation_plomberie_partielle");
    expect(result.overall_status).toBe("fail");
    const envelope = result.checks.find(c => c.checker === "GlobalEnvelopeChecker");
    expect(envelope.status).toBe("fail");
    expect(envelope.issues[0].code).toBe("ENVELOPE_OUT_OF_RANGE");
  });

  it("renovation_plomberie_partielle : 9 000 € pour 90 m² → pass", () => {
    const devis = {
      objet: "Rénovation plomberie maison 90 m²",
      project_params: { surface_sol: 90 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Réseaux complets", quantite: 1, prix_unitaire: 9000, tva_rate: 10 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("renovation_plomberie_partielle");
    expect(result.overall_status).toBe("pass");
  });

  it("renovation_electrique_partielle : 3 511 € pour 40 m² → fail (sous-évalué)", () => {
    const devis = {
      objet: "Rénovation électrique appartement T2 40 m²",
      project_params: { surface_sol: 40 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Mise aux normes", quantite: 1, prix_unitaire: 3511, tva_rate: 10 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("renovation_electrique_partielle");
    expect(result.overall_status).toBe("fail");
  });

  it("renovation_peinture_interieure : 405 € pour 65 m² → fail (sous-évalué)", () => {
    const devis = {
      objet: "Rénovation peinture appartement 3 pièces 65 m²",
      project_params: { surface_sol: 65 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Peinture murs et plafonds", quantite: 65, prix_unitaire: 6.23, tva_rate: 10 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("renovation_peinture_interieure");
    expect(result.overall_status).toBe("fail");
  });

  it("renovation_peinture_interieure : 2 400 € pour 65 m² (37 €/m²) → pass", () => {
    const devis = {
      objet: "Peinture intérieure appartement 3 pièces 65 m²",
      project_params: { surface_sol: 65 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Murs et plafonds", quantite: 65, prix_unitaire: 37, tva_rate: 10 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("renovation_peinture_interieure");
    expect(result.overall_status).toBe("pass");
  });

  it("ite_facade : 9 840 € pour 120 m² (82 €/m²) → fail (sous-évalué)", () => {
    const devis = {
      objet: "ITE polystyrène 16 cm + enduit 120 m²",
      project_params: { surface_facade: 120 },
      lignes: [
        { type_ligne: "ouvrage", designation: "ITE complète", quantite: 120, prix_unitaire: 82, tva_rate: 5.5 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("ite_facade");
    expect(result.overall_status).toBe("fail");
  });

  it("cuisine_cle_en_main : 6 882 € pour 14 m² (491 €/m²) → fail (sous-évalué)", () => {
    const devis = {
      objet: "Rénovation cuisine clé en main 14 m²",
      project_params: { surface_sol: 14 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Rénovation complète", quantite: 1, prix_unitaire: 6882, tva_rate: 10 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("cuisine_cle_en_main");
    expect(result.overall_status).toBe("fail");
  });

  it("moe_immeuble : 18 000 € pour 6 appts (3 000 €/appt) → fail (sous-évalué)", () => {
    const devis = {
      objet: "MOE rénovation immeuble 6 appartements",
      project_params: { nb_appartements: 6 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Mission MOE", quantite: 1, prix_unitaire: 18000, tva_rate: 20 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("moe_immeuble");
    expect(result.overall_status).toBe("fail");
  });

  it("moe_immeuble : 99 200 € pour 6 appts (16 533 €/appt) → fail (sur-évalué)", () => {
    const devis = {
      objet: "MOE rénovation immeuble 6 appartements",
      project_params: { nb_appartements: 6 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Mission MOE", quantite: 1, prix_unitaire: 99200, tva_rate: 20 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("moe_immeuble");
    expect(result.overall_status).toBe("fail");
  });

  it("moe_immeuble : 25 800 € pour 6 appts (4 300 €/appt) → pass (médian de 20-35 k)", () => {
    const devis = {
      objet: "MOE rénovation immeuble 6 appartements",
      project_params: { nb_appartements: 6 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Mission MOE", quantite: 1, prix_unitaire: 25800, tva_rate: 20 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("moe_immeuble");
    expect(result.overall_status).toBe("pass");
  });

  it("demolition_cloisons : 880 € pour 40 m² (22 €/m²) → fail (sous-évalué)", () => {
    const devis = {
      objet: "Démolition cloisons intérieures 40 m²",
      project_params: { surface_sol: 40 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Démolition + évacuation", quantite: 40, prix_unitaire: 22, tva_rate: 10 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("demolition_cloisons");
    expect(result.overall_status).toBe("fail");
  });
});

describe("Mandat vente immobilier (conseil v1.1)", () => {
  it("mandat_vente_immo : 8 400 € sur 280 000 € (3 %) → fail (sous le minimum 4 %)", () => {
    const devis = {
      objet: "Mandat exclusif de vente — Appartement 280 000 €",
      project_params: { prix_vente: 280000 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Honoraires agence", quantite: 1, prix_unitaire: 8400, tva_rate: 20 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("mandat_vente_immo");
    expect(result.overall_status).toBe("fail");
  });

  it("mandat_vente_immo : 14 000 € sur 280 000 € (5 %) → pass", () => {
    const devis = {
      objet: "Mandat exclusif vente appartement 280 000 €",
      project_params: { prix_vente: 280000 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Honoraires agence", quantite: 1, prix_unitaire: 14000, tva_rate: 20 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("mandat_vente_immo");
    expect(result.overall_status).toBe("pass");
  });
});

describe("Rétrocompatibilité — pas de project_params → pass silencieux", () => {
  it("L'envelope check ne fail pas quand la dimension principale n'est pas fournie", () => {
    // Si l'IA n'extrait pas project_params, on ne casse pas — on passe l'envelope check.
    // C'est le comportement attendu de envelope.js (mainValue = 0 → pass).
    const devis = {
      objet: "Rénovation plomberie maison",
      lignes: [
        { type_ligne: "ouvrage", designation: "Réseaux", quantite: 1, prix_unitaire: 100, tva_rate: 10 },
      ],
    };
    const result = runCoherenceCheck(devis);
    const envelope = result.checks.find(c => c.checker === "GlobalEnvelopeChecker");
    expect(envelope.status).toBe("pass");
  });

  it("Priorité de matching : 'rénovation peinture appartement' touche peinture, pas renovation_interieure", () => {
    const devis = {
      objet: "Rénovation peinture appartement 3 pièces",
      project_params: { surface_sol: 65 },
      lignes: [
        { type_ligne: "ouvrage", designation: "Peinture", quantite: 65, prix_unitaire: 35, tva_rate: 10 },
      ],
    };
    const result = runCoherenceCheck(devis);
    expect(result.typology_id).toBe("renovation_peinture_interieure");
  });
});
