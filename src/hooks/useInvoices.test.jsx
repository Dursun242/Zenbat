import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("../lib/api", () => ({
  listInvoices:            vi.fn(),
  createInvoice:           vi.fn(),
  updateInvoice:           vi.fn(),
  replaceInvoiceLignes:    vi.fn(),
  deleteInvoice:           vi.fn(),
  createAvoirFromInvoice:  vi.fn(),
  createAcompteFromDevis:  vi.fn(),
  createSoldeFromDevis:    vi.fn(),
}));
vi.mock("../lib/logger.js", () => ({ logError: vi.fn() }));
vi.mock("../lib/pdf.js", () => ({ renderDataToPdf: vi.fn(async () => {}) }));

import * as api from "../lib/api";
import { logError } from "../lib/logger.js";
import { renderDataToPdf } from "../lib/pdf.js";
import { useInvoices } from "./useInvoices.js";

const USER = { id: "user-1" };
const BRAND = { vatRegime: "normal" };

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

let cb;
beforeEach(() => {
  vi.clearAllMocks();
  cb = {
    markSaving:   vi.fn(),
    markSaved:    vi.fn(),
    setSaveState: vi.fn(),
    showErr:      vi.fn(),
    setTab:       vi.fn(),
  };
  api.listInvoices.mockResolvedValue([]);
  api.updateInvoice.mockResolvedValue({});
  api.replaceInvoiceLignes.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

async function setup(initial = [], { devis = [], user = USER } = {}) {
  api.listInvoices.mockResolvedValue(initial);
  const hook = renderHook(() => useInvoices(user, devis, BRAND, { ...cb, clients: [] }));
  if (user && initial.length) await waitFor(() => expect(hook.result.current.invoices).toHaveLength(initial.length));
  return hook;
}

describe("chargement", () => {
  it("charge les factures de l'utilisateur", async () => {
    const { result } = await setup([{ id: "i1" }]);
    expect(result.current.invoices).toEqual([{ id: "i1" }]);
  });

  it("échec de chargement → message d'erreur (pas de liste vide silencieuse)", async () => {
    api.listInvoices.mockRejectedValue(new Error("down"));
    renderHook(() => useInvoices(USER, [], BRAND, cb));
    await waitFor(() => expect(cb.showErr).toHaveBeenCalledWith(expect.stringMatching(/indisponibles/)));
  });

  it("sans utilisateur → aucun appel", () => {
    renderHook(() => useInvoices(null, [], BRAND, cb));
    expect(api.listInvoices).not.toHaveBeenCalled();
  });
});

describe("onSaveInvoice", () => {
  it("facture verrouillée → aucune écriture, verrou et statut conservés en local", async () => {
    const { result } = await setup([{ id: "i1", locked: true, statut: "envoyee", objet: "A" }]);
    act(() => result.current.onSaveInvoice({ id: "i1", locked: false, statut: "brouillon", objet: "B" }, true));
    expect(api.updateInvoice).not.toHaveBeenCalled();
    expect(api.replaceInvoiceLignes).not.toHaveBeenCalled();
    expect(cb.markSaving).not.toHaveBeenCalled();
    expect(result.current.invoices[0]).toEqual({ id: "i1", locked: true, statut: "envoyee", objet: "B" });
  });

  it("verrou posé entre deux appels (double clic) → le 2ᵉ appel lit l'état courant, pas la closure", async () => {
    const { result } = await setup([{ id: "i1", locked: false, statut: "brouillon" }]);
    const save = result.current.onSaveInvoice; // closure capturée avant le verrou
    act(() => result.current.onSaveInvoice({ id: "i1", locked: true, statut: "envoyee" }, false, true));
    act(() => save({ id: "i1", locked: false, statut: "brouillon", objet: "tardif" }));
    expect(api.updateInvoice).not.toHaveBeenCalled();
    expect(result.current.invoices[0]).toMatchObject({ locked: true, statut: "envoyee" });
  });

  it("skipPersist → état local synchronisé, aucun appel API", async () => {
    const { result } = await setup([{ id: "i1", statut: "brouillon" }, { id: "i2" }]);
    const emitted = { id: "i1", statut: "envoyee", locked: true, numero: "FAC-2026-001" };
    act(() => result.current.onSaveInvoice(emitted, true, true));
    expect(api.updateInvoice).not.toHaveBeenCalled();
    expect(api.replaceInvoiceLignes).not.toHaveBeenCalled();
    expect(cb.markSaving).not.toHaveBeenCalled();
    expect(result.current.invoices).toEqual([emitted, { id: "i2" }]);
  });

  it("brouillon → UPDATE sans les champs hors base, lignes remplacées sans id", async () => {
    const { result } = await setup([{ id: "i1", statut: "brouillon" }]);
    const inv = {
      id: "i1", statut: "brouillon", objet: "Cuisine", created_at: "x", updated_at: "y", devis_numero: "DEV-1",
      lignes: [{ id: "l1", created_at: "z", designation: "Pose", quantite: 1 }],
    };
    act(() => result.current.onSaveInvoice(inv, true));
    expect(cb.markSaving).toHaveBeenCalled();
    expect(api.updateInvoice).toHaveBeenCalledWith("i1", { id: "i1", statut: "brouillon", objet: "Cuisine" });
    expect(api.replaceInvoiceLignes).toHaveBeenCalledWith("i1", [{ designation: "Pose", quantite: 1 }]);
    await waitFor(() => expect(cb.markSaved).toHaveBeenCalled());
  });

  it("saveLignes=false → lignes non réécrites", async () => {
    const { result } = await setup([{ id: "i1" }]);
    act(() => result.current.onSaveInvoice({ id: "i1", objet: "x", lignes: [] }));
    expect(api.updateInvoice).toHaveBeenCalledTimes(1);
    expect(api.replaceInvoiceLignes).not.toHaveBeenCalled();
  });

  it("verrou Supabase volé → un seul nouvel essai, sans message d'erreur", async () => {
    const { result } = await setup([{ id: "i1" }]);
    api.updateInvoice
      .mockRejectedValueOnce(Object.assign(new Error("Lock was stolen by another request"), { name: "AbortError" }))
      .mockResolvedValueOnce({});
    act(() => result.current.onSaveInvoice({ id: "i1", objet: "x" }));
    await waitFor(() => expect(cb.markSaved).toHaveBeenCalled(), { timeout: 2000 });
    expect(api.updateInvoice).toHaveBeenCalledTimes(2);
    expect(cb.showErr).not.toHaveBeenCalled();
  });

  it("échec d'enregistrement → toast, état idle, erreur journalisée", async () => {
    const { result } = await setup([{ id: "i1" }]);
    api.updateInvoice.mockRejectedValueOnce(Object.assign(new Error("RLS"), { code: "42501" }));
    act(() => result.current.onSaveInvoice({ id: "i1", objet: "x" }));
    await waitFor(() => expect(cb.showErr).toHaveBeenCalledWith("Impossible de sauvegarder la facture"));
    expect(cb.setSaveState).toHaveBeenCalledWith("idle");
    expect(cb.markSaved).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith("save invoice failed", expect.anything(), expect.objectContaining({ invoice_id: "i1", code: "42501" }));
  });
});

describe("flushInvoiceSave", () => {
  it("rien en cours → résout immédiatement", async () => {
    const { result } = await setup([{ id: "i1" }]);
    await expect(result.current.flushInvoiceSave("i1")).resolves.toBeUndefined();
  });

  it("attend l'enregistrement en cours avant de résoudre", async () => {
    const { result } = await setup([{ id: "i1" }]);
    const d = deferred();
    api.updateInvoice.mockReturnValueOnce(d.promise);
    act(() => result.current.onSaveInvoice({ id: "i1", objet: "x" }, true));

    let done = false;
    const flushed = result.current.flushInvoiceSave("i1").then(() => { done = true; });
    await Promise.resolve(); await Promise.resolve();
    expect(done).toBe(false);

    d.resolve({});
    await flushed;
    expect(done).toBe(true);
    // Une fois terminé, plus rien en attente
    await waitFor(() => expect(cb.markSaved).toHaveBeenCalled());
    expect(result.current.flushInvoiceSave("i1")).toBeInstanceOf(Promise);
    await expect(result.current.flushInvoiceSave("i1")).resolves.toBeUndefined();
  });

  it("rejette si l'enregistrement en cours a échoué (pas d'émission sur un écran divergent)", async () => {
    const { result } = await setup([{ id: "i1" }]);
    const d = deferred();
    api.updateInvoice.mockReturnValueOnce(d.promise);
    act(() => result.current.onSaveInvoice({ id: "i1", objet: "x" }));
    const flushed = result.current.flushInvoiceSave("i1");
    d.reject(new Error("réseau coupé"));
    await expect(flushed).rejects.toThrow("réseau coupé");
  });

  it("enregistrement d'une autre facture → n'est pas attendu", async () => {
    const { result } = await setup([{ id: "i1" }, { id: "i2" }]);
    api.updateInvoice.mockReturnValueOnce(new Promise(() => {}));
    act(() => result.current.onSaveInvoice({ id: "i1", objet: "x" }));
    await expect(result.current.flushInvoiceSave("i2")).resolves.toBeUndefined();
  });
});

describe("création de brouillons", () => {
  it("facture vide : brouillon sans numéro, ouverte aussitôt", async () => {
    const { result } = await setup();
    api.createInvoice.mockResolvedValueOnce({ id: "new-1", statut: "brouillon", numero: null });
    await act(() => result.current.onCreateEmptyInvoice());
    const [payload, lignes] = api.createInvoice.mock.calls[0];
    expect(payload).not.toHaveProperty("numero");
    expect(payload).toMatchObject({ statut: "brouillon", montant_ht: 0, montant_ttc: 0 });
    expect(lignes).toEqual([]);
    expect(result.current.invoices[0]).toEqual({ id: "new-1", statut: "brouillon", numero: null, lignes: [] });
    expect(result.current.selI).toBe("new-1");
    expect(cb.setTab).toHaveBeenCalledWith("factures_detail");
  });

  it("depuis un devis : brouillon sans numéro, montants recalculés, lignes copiées sans id", async () => {
    const devis = [{
      id: "d1", client_id: "c1", objet: "Salle de bain", ville_chantier: "Rouen", tva_rate: 10,
      lignes: [{ id: "l1", created_at: "x", type_ligne: "ouvrage", designation: "Carrelage", quantite: 2, prix_unitaire: 100, tva_rate: 10 }],
    }];
    const { result } = await setup([], { devis });
    api.createInvoice.mockResolvedValueOnce({ id: "new-2", statut: "brouillon" });
    await act(() => result.current.onCreateInvoiceFromDevis("d1"));
    const [payload, lignes] = api.createInvoice.mock.calls[0];
    expect(payload).not.toHaveProperty("numero");
    expect(payload).toMatchObject({
      devis_id: "d1", client_id: "c1", statut: "brouillon",
      montant_ht: 200, montant_tva: 20, montant_ttc: 220, ville_chantier: "Rouen",
    });
    expect(payload).not.toHaveProperty("auto_liquidation_btp");
    expect(lignes).toEqual([{ type_ligne: "ouvrage", designation: "Carrelage", quantite: 2, prix_unitaire: 100, tva_rate: 10 }]);
    expect(result.current.selI).toBe("new-2");
    await waitFor(() => expect(renderDataToPdf).toHaveBeenCalled());
  });

  it("depuis un devis en autoliquidation : TVA à 0 et indicateur repris", async () => {
    const devis = [{ id: "d1", auto_liquidation_btp: true, lignes: [{ type_ligne: "ouvrage", quantite: 1, prix_unitaire: 500, tva_rate: 20 }] }];
    const { result } = await setup([], { devis });
    api.createInvoice.mockResolvedValueOnce({ id: "n" });
    await act(() => result.current.onCreateInvoiceFromDevis("d1"));
    expect(api.createInvoice.mock.calls[0][0]).toMatchObject({ auto_liquidation_btp: true, montant_ht: 500, montant_tva: 0, montant_ttc: 500 });
  });

  it("devis introuvable → message, aucune création", async () => {
    const { result } = await setup();
    await act(() => result.current.onCreateInvoiceFromDevis("absent"));
    expect(cb.showErr).toHaveBeenCalledWith("Devis introuvable");
    expect(api.createInvoice).not.toHaveBeenCalled();
  });

  it("création en échec → message, liste inchangée", async () => {
    const { result } = await setup();
    api.createInvoice.mockRejectedValueOnce(new Error("insert refusé"));
    await act(() => result.current.onCreateEmptyInvoice());
    expect(cb.showErr).toHaveBeenCalledWith(expect.stringMatching(/Impossible de créer la facture/));
    expect(result.current.invoices).toEqual([]);
  });
});

describe("avoir et suppression", () => {
  it("avoir : créé côté serveur, liste rechargée, avoir ouvert", async () => {
    const { result } = await setup([{ id: "i1", locked: true }]);
    api.createAvoirFromInvoice.mockResolvedValueOnce("av-1");
    api.listInvoices.mockResolvedValueOnce([{ id: "av-1", lignes: [] }, { id: "i1", locked: true }]);
    await act(() => result.current.onCreateAvoir("i1"));
    expect(api.createAvoirFromInvoice).toHaveBeenCalledWith("i1");
    expect(result.current.invoices.map(x => x.id)).toEqual(["av-1", "i1"]);
    expect(result.current.selI).toBe("av-1");
  });

  it("suppression refusée par la base → facture gardée, message du serveur", async () => {
    const { result } = await setup([{ id: "i1", locked: true }]);
    api.deleteInvoice.mockRejectedValueOnce(new Error("Une facture émise ne peut pas être supprimée"));
    await act(() => result.current.onDeleteInvoice("i1"));
    expect(result.current.invoices).toHaveLength(1);
    expect(cb.showErr).toHaveBeenCalledWith("Une facture émise ne peut pas être supprimée");
    expect(cb.setTab).not.toHaveBeenCalledWith("factures");
  });

  it("suppression réussie → retirée de la liste, retour à la liste", async () => {
    const { result } = await setup([{ id: "i1" }, { id: "i2" }]);
    api.deleteInvoice.mockResolvedValueOnce();
    await act(() => result.current.onDeleteInvoice("i1"));
    expect(result.current.invoices).toEqual([{ id: "i2" }]);
    expect(cb.setTab).toHaveBeenCalledWith("factures");
  });
});
