import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ClientsList importe getToken (client Supabase) : pas de clés en test.
vi.mock("../lib/getToken.js", () => ({ getToken: vi.fn(async () => null) }));
import DevisList from "./DevisList.jsx";
import InvoicesList from "./InvoicesList.jsx";
import ClientsList from "./ClientsList.jsx";
import Dashboard from "./Dashboard.jsx";

const noop = () => {};

describe("Listes : chargement, échec, liste vide", () => {
  it("devis en chargement : pas d'état vide, indicateur discret", () => {
    render(<DevisList devis={[]} clients={[]} goDevis={noop} setTab={noop} loaded={false}/>);
    expect(screen.getByRole("status")).toHaveTextContent("Chargement de tes devis…");
    expect(screen.queryByText(/Aucun devis/)).toBeNull();
    expect(screen.queryByText("0 devis")).toBeNull();
  });

  it("devis en échec : message clair et « Réessayer » qui relance le chargement", () => {
    const onRetry = vi.fn();
    render(<DevisList devis={[]} clients={[]} goDevis={noop} setTab={noop} loaded={false} loadError={new Error("réseau")} onRetry={onRetry}/>);
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger tes devis.");
    expect(screen.queryByText(/Aucun devis/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("devis chargés sans aucun devis : état vide", () => {
    render(<DevisList devis={[]} clients={[]} goDevis={noop} setTab={noop} loaded/>);
    expect(screen.getByText(/Aucun devis pour l'instant/)).toBeInTheDocument();
    expect(screen.getByText("0 devis")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("factures : chargement, échec avec « Réessayer », puis vide", () => {
    const onRetry = vi.fn();
    const props = { invoices: [], clients: [], goInvoice: noop, onCreateEmpty: noop, onDelete: noop };
    const { rerender } = render(<InvoicesList {...props} loaded={false}/>);
    expect(screen.getByRole("status")).toHaveTextContent("Chargement de tes factures…");
    expect(screen.queryByText(/Aucune facture/)).toBeNull();

    rerender(<InvoicesList {...props} loaded={false} loadError={new Error("x")} onRetry={onRetry}/>);
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger tes factures.");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<InvoicesList {...props} loaded/>);
    expect(screen.getByText(/Aucune facture pour l'instant/)).toBeInTheDocument();
  });

  it("clients : chargement, échec avec « Réessayer », puis vide", () => {
    const onRetry = vi.fn();
    const props = { clients: [], onSave: noop, onDelete: noop, onRestore: noop, goClient: noop };
    const { rerender } = render(<ClientsList {...props} loaded={false}/>);
    expect(screen.getByRole("status")).toHaveTextContent("Chargement de tes clients…");
    expect(screen.queryByText(/Aucun client/)).toBeNull();

    rerender(<ClientsList {...props} loaded={false} loadError={new Error("x")} onRetry={onRetry}/>);
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger tes clients.");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<ClientsList {...props} loaded/>);
    expect(screen.getByText(/Aucun client pour l'instant/)).toBeInTheDocument();
  });

  it("accueil : ni « Rien en attente » ni montants pendant le chargement ou après un échec", () => {
    const onRetry = vi.fn();
    const props = { devis: [], invoices: [], clients: [], goDevis: noop, goInvoice: noop, setTab: noop };
    const { rerender } = render(<Dashboard {...props} loaded={false}/>);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText(/Rien en attente/)).toBeNull();
    expect(screen.queryByText("En cours")).toBeNull();

    rerender(<Dashboard {...props} loaded={false} loadError={new Error("x")} onRetry={onRetry}/>);
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger tes devis et tes factures.");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<Dashboard {...props} loaded/>);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("En cours")).toBeInTheDocument();
  });
});
