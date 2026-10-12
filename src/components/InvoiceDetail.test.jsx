import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("./PDFViewer.jsx", () => ({ default: () => null }));
vi.mock("../lib/getToken.js", () => ({ getToken: async () => "t" }));
const renderDataToPdf = vi.fn(async () => ({ base64: "JVBERi0=" }));
vi.mock("../lib/pdf.js", () => ({ renderDataToPdf: (...a) => renderDataToPdf(...a) }));
vi.mock("../lib/facturx.js", () => ({ downloadBlob: vi.fn() }));

import InvoiceDetail from "./InvoiceDetail.jsx";

const client = { id: "c1", prenom: "Claire", nom: "Durand", email: "c.durand@exemple.fr" };
const lignes = [{ id: "l1", type_ligne: "ouvrage", designation: "Acompte", unite: "forfait", quantite: 1, prix_unitaire: 1000, tva_rate: 10 }];
const renderInvoice = (inv, props = {}) => render(
  <InvoiceDetail invoice={{ id: "f1", numero: "FAC-2026-009", lignes, ...inv }} client={client} brand={{ vatRegime: "normal" }}
    invoices={[]} onBack={() => {}} onChange={vi.fn()} onCreateAvoir={vi.fn()} onDelete={vi.fn()} {...props}/>
);

describe("Fiche facture", () => {
  it("brouillon : l'émission demande une confirmation qui annonce le verrouillage", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    renderInvoice({ statut: "brouillon", numero: null });
    expect(screen.queryByText(/FAC-/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Émettre la facture" }));
    const group = screen.getByRole("group", { name: "Confirmer l'émission" });
    expect(group).toHaveTextContent(/numéro suivant et la date d'aujourd'hui/);
    expect(group).toHaveTextContent(/verrouillée/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("brouillon confirmé : enregistrement attendu, numéro pris au serveur, puis PDF au bon numéro", async () => {
    const order = [];
    const flushSave = vi.fn(async () => { order.push("flush"); });
    const onChange = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts) => {
      if (String(url).startsWith("data:")) return { blob: async () => new Blob([new Uint8Array(2048)]) };
      const body = JSON.parse(opts.body);
      order.push(body.action || "generate");
      if (body.action === "emit") {
        return { ok: true, status: 200, json: async () => ({ numero: "FAC-2026-0010", date_emission: "2026-10-12", date_echeance: "2026-11-11", statut: "envoyee", locked: true, montant_ht: 1000, montant_tva: 100, montant_ttc: 1100 }) };
      }
      return { ok: true, status: 200, json: async () => ({ pdf_base64: "JVBERi0=", icc_applied: true, locked: true, numero: "FAC-2026-0010" }) };
    });
    renderInvoice({ statut: "brouillon", numero: null }, { flushSave, onChange });
    fireEvent.click(screen.getByRole("button", { name: "Émettre la facture" }));
    fireEvent.click(screen.getByRole("button", { name: "Oui, émettre" }));
    await waitFor(() => expect(order).toEqual(["flush", "emit", "generate"]));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ numero: "FAC-2026-0010", locked: true, date_emission: "2026-10-12" }), false, true);
    expect(renderDataToPdf.mock.calls[0][0]).toMatchObject({ numero: "FAC-2026-0010", date_emission: "2026-10-12" });
    expect(await screen.findByText(/Facture émise sous le n° FAC-2026-0010/)).toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it("émission refusée par le serveur : rien n'est verrouillé à l'écran", async () => {
    const onChange = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      { ok: false, status: 400, json: async () => ({ error: "Ajoute au moins une ligne avant d'émettre." }) }));
    renderInvoice({ statut: "brouillon", numero: null }, { onChange });
    fireEvent.click(screen.getByRole("button", { name: "Émettre la facture" }));
    fireEvent.click(screen.getByRole("button", { name: "Oui, émettre" }));
    expect(await screen.findByText(/L'émission a échoué : Ajoute au moins une ligne/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("émise et envoyée : action principale « Marquer comme payée », lignes non modifiables", () => {
    renderInvoice({ statut: "envoyee", locked: true, sent_to_client_at: "2026-10-11T10:00:00Z" });
    expect(screen.getByRole("button", { name: "Marquer comme payée" })).toBeInTheDocument();
    expect(screen.getByText("Envoyée")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Modifier :/ })).toBeNull();
  });
});
