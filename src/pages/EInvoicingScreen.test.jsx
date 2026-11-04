import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const api = vi.hoisted(() => ({
  status: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), inbox: vi.fn(), setStatus: vi.fn(), download: vi.fn(),
}));
vi.mock("../lib/getToken.js", () => ({ getToken: async () => "t" }));
vi.mock("../lib/pdp.js", async (importOriginal) => ({ ...(await importOriginal()), pdp: api }));

import EInvoicingScreen from "./EInvoicingScreen.jsx";

const invoice = { id: 11, seller_name: "Négoce Matériaux", number: "F-12", issue_date: "2026-10-30", total_ttc: 120, currency: "EUR", status: "fr:203", status_label: "Mise à disposition" };

beforeEach(() => Object.values(api).forEach(f => f.mockReset()));

describe("Factures reçues (Super PDP)", () => {
  it("non connecté : bouton de connexion, pas de liste", async () => {
    api.status.mockResolvedValue({ configured: true, connected: false });
    render(<EInvoicingScreen onBack={() => {}}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Connecter mon compte Super PDP" }));
    expect(api.connect).toHaveBeenCalled();
    expect(api.inbox).not.toHaveBeenCalled();
  });

  it("pas encore configuré sur Zenbat : message, pas de bouton", async () => {
    api.status.mockResolvedValue({ configured: false, connected: false });
    render(<EInvoicingScreen onBack={() => {}}/>);
    expect(await screen.findByText(/pas encore ouverte/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Connecter/ })).toBeNull();
  });

  it("retour de Super PDP : message de succès", async () => {
    api.status.mockResolvedValue({ configured: true, connected: false });
    render(<EInvoicingScreen onBack={() => {}} returnStatus="connected"/>);
    expect(screen.getByRole("status")).toHaveTextContent("Ton compte Super PDP est connecté.");
  });

  it("connecté : liste les factures ; refuser passe par une confirmation", async () => {
    api.status.mockResolvedValue({ configured: true, connected: true, account: { company_name: "Plomberie Dupont", siren: "123456789", env: "sandbox" } });
    api.inbox.mockResolvedValue({ invoices: [invoice], has_after: false });
    api.setStatus.mockResolvedValue({ status: "fr:210", status_label: "Refusée", status_at: "2026-11-04T10:00:00Z" });
    render(<EInvoicingScreen onBack={() => {}}/>);

    expect(await screen.findByText("Plomberie Dupont")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /Négoce Matériaux/ }));
    fireEvent.click(screen.getByRole("button", { name: "Refuser" }));
    const bar = screen.getByRole("group", { name: "Confirmation" });
    expect(bar).toHaveTextContent(/transmis au fournisseur/);
    expect(api.setStatus).not.toHaveBeenCalled();

    fireEvent.click(within(bar).getByRole("button", { name: "Refuser" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith(11, "fr:210"));
    expect(await screen.findByText("Refusée")).toBeInTheDocument();
  });

  it("connexion expirée côté Super PDP : repasse en « non connecté »", async () => {
    api.status.mockResolvedValue({ configured: true, connected: true, account: { company_name: "X" } });
    api.inbox.mockRejectedValue(Object.assign(new Error("Connexion Super PDP expirée : reconnecte ton compte"), { code: "reconnect" }));
    render(<EInvoicingScreen onBack={() => {}}/>);
    expect(await screen.findByRole("alert")).toHaveTextContent(/reconnecte/);
    expect(await screen.findByRole("button", { name: "Connecter mon compte Super PDP" })).toBeInTheDocument();
  });
});
