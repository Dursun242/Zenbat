import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("./PDFViewer.jsx", () => ({ default: () => null }));
vi.mock("../lib/getToken.js", () => ({ getToken: async () => "t" }));

import InvoiceDetail from "./InvoiceDetail.jsx";

const client = { id: "c1", prenom: "Claire", nom: "Durand", email: "c.durand@exemple.fr" };
const lignes = [{ id: "l1", type_ligne: "ouvrage", designation: "Acompte", unite: "forfait", quantite: 1, prix_unitaire: 1000, tva_rate: 10 }];
const renderInvoice = (inv) => render(
  <InvoiceDetail invoice={{ id: "f1", numero: "FAC-2026-009", lignes, ...inv }} client={client} brand={{ vatRegime: "normal" }}
    invoices={[]} onBack={() => {}} onChange={vi.fn()} onCreateAvoir={vi.fn()} onDelete={vi.fn()}/>
);

describe("Fiche facture", () => {
  it("brouillon : l'émission demande une confirmation qui annonce le verrouillage", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    renderInvoice({ statut: "brouillon" });
    fireEvent.click(screen.getByRole("button", { name: "Émettre la facture" }));
    const group = screen.getByRole("group", { name: "Confirmer l'émission" });
    expect(group).toHaveTextContent(/FAC-2026-009/);
    expect(group).toHaveTextContent(/verrouillée/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("émise et envoyée : action principale « Marquer comme payée », lignes non modifiables", () => {
    renderInvoice({ statut: "envoyee", locked: true, sent_to_client_at: "2026-10-11T10:00:00Z" });
    expect(screen.getByRole("button", { name: "Marquer comme payée" })).toBeInTheDocument();
    expect(screen.getByText("Envoyée")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Modifier :/ })).toBeNull();
  });
});
