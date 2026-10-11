import { describe, it, expect } from "vitest";
import { todoItems, ledger } from "./todo.js";

const now = new Date("2026-10-20T10:00:00Z").getTime();
const fullBrand = { companyName: "X", siret: "1", address: "a", city: "b", postalCode: "c", email: "e", phone: "p", firstName: "f", lastName: "l" };
const clients = [{ id: "c1", prenom: "Claire", nom: "Durand" }];

describe("todoItems", () => {
  it("classe les urgences : modification demandée, relance, facturer, paiement, brouillon", () => {
    const devis = [
      { id: "b", statut: "brouillon", objet: "Chauffe-eau", montant_ht: 1240, client_id: "c1" },
      { id: "s", statut: "accepte", objet: "Peinture", montant_ht: 2890, client_id: "c1" },
      { id: "r", statut: "envoye", objet: "SDB", montant_ht: 4356, client_id: "c1", sent_to_client_at: "2026-10-05T10:00:00Z" },
      { id: "n", statut: "en_negociation", objet: "Cuisine", montant_ht: 900, client_id: "c1" },
      { id: "x", statut: "envoye", objet: "Récent", montant_ht: 100, client_id: "c1", sent_to_client_at: "2026-10-18T10:00:00Z" },
    ];
    const invoices = [{ id: "f", statut: "envoyee", numero: "FAC-1", montant_ttc: 500, client_id: "c1" }];
    const items = todoItems({ devis, invoices, clients, brand: fullBrand, now });
    expect(items.map(i => i.key).filter(k => k !== "profil")).toEqual(["neg-n", "rel-r", "fac-s", "pay-f", "brl-b"]);
    expect(items[1].title).toBe("Relancer Claire Durand");
    expect(items[1].sub).toContain("15 jours");
  });

  it("un devis signé déjà facturé ne demande plus rien ; une facture en retard passe devant", () => {
    const devis = [{ id: "s", statut: "accepte", montant_ht: 10, client_id: "c1" }];
    const invoices = [{ id: "f", devis_id: "s", statut: "envoyee", numero: "FAC-2", montant_ttc: 12, client_id: "c1", date_echeance: "2026-10-10" }];
    const items = todoItems({ devis, invoices, clients, brand: fullBrand, now }).filter(i => i.key !== "profil");
    expect(items.map(i => i.key)).toEqual(["ret-f"]);
    expect(items[0].sub).toContain("dépassée de 10 jours");
  });

  it("ledger : un devis signé déjà facturé ne compte plus dans « signé »", () => {
    const l = ledger({
      devis: [{ id: "a", statut: "accepte", montant_ht: 100 }, { id: "b", statut: "accepte", montant_ht: 40 }],
      invoices: [{ devis_id: "a", statut: "envoyee", montant_ttc: 110 }],
    });
    expect(l.signe).toBe(40);
    expect(l.aEncaisser).toBe(110);
  });

  it("ledger : en attente, signé, à encaisser", () => {
    const l = ledger({
      devis: [{ statut: "envoye", montant_ht: 100 }, { statut: "accepte", montant_ht: 50.5 }, { statut: "remplace", montant_ht: 999 }],
      invoices: [{ statut: "envoyee", montant_ttc: 60 }, { statut: "payee", montant_ttc: 70 }],
    });
    expect(l).toEqual({ enAttente: 100, signe: 50.5, aEncaisser: 60 });
  });
});
