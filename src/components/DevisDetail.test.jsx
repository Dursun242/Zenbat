import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../lib/supabase.js", () => {
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, then: (ok) => Promise.resolve({ data: [], error: null }).then(ok) };
  return { supabase: { from: () => q, auth: { getSession: async () => ({ data: { session: null } }) } } };
});
vi.mock("../lib/auth.jsx", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("./PDFViewer.jsx", () => ({ default: () => null }));

import DevisDetail from "./DevisDetail.jsx";

const cl = { id: "c1", prenom: "Claire", nom: "Durand", email: "c.durand@exemple.fr" };
const lignes = [
  { id: "l0", type_ligne: "lot", designation: "PLOMBERIE" },
  { id: "l1", type_ligne: "ouvrage", designation: "WC suspendu", unite: "u", quantite: 1, prix_unitaire: 690, tva_rate: 10 },
];
const base = { id: "d1", numero: "DEV-2026-014", objet: "Salle de bain", lignes, tva_rate: 10 };
const renderDevis = (statut, props = {}) => {
  const onChange = vi.fn();
  render(<DevisDetail d={{ ...base, statut }} cl={cl} brand={{ vatRegime: "normal" }} onChange={onChange} onBack={() => {}} {...props}/>);
  return onChange;
};

describe("Fiche devis", () => {
  it("brouillon : une seule action principale, et l'envoi demande confirmation", () => {
    renderDevis("brouillon");
    expect(screen.getByText("Brouillon")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Envoyer au client" }));
    expect(screen.getByRole("group", { name: "Confirmer l'envoi" })).toHaveTextContent(/à c\.durand@exemple\.fr \?/);
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeInTheDocument();
  });

  it("brouillon : appui sur une ligne pour la modifier", () => {
    const onChange = renderDevis("brouillon");
    fireEvent.click(screen.getByRole("button", { name: "Modifier : WC suspendu" }));
    fireEvent.change(screen.getByLabelText("Prix unitaire HT"), { target: { value: "700" } });
    fireEvent.click(screen.getByRole("button", { name: "Terminé" }));
    const saved = onChange.mock.calls.at(-1)[0];
    expect(saved.lignes.find(l => l.id === "l1").prix_unitaire).toBe(700);
    expect(saved.montant_ht).toBe(700);
  });

  it("signé : le devis ne se modifie plus et l'action principale est Facturer", () => {
    renderDevis("accepte", { onConvertToInvoice: () => {} });
    expect(screen.getByText("Signé")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Modifier :/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Ajouter une ligne/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Facturer" })).toBeInTheDocument();
  });

  it("à signer : « Marquer comme refusé » demande confirmation", () => {
    const onChange = renderDevis("en_signature");
    fireEvent.click(screen.getByRole("button", { name: "Plus d'actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Marquer comme refusé" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Oui, il est refusé" }));
    expect(onChange.mock.calls.at(-1)[0].statut).toBe("refuse");
  });

  it("brouillon : « Marquer comme envoyé » et « à signer » demandent confirmation", () => {
    const onChange = renderDevis("brouillon");
    fireEvent.click(screen.getByRole("button", { name: "Plus d'actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Marquer comme envoyé/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Confirmer le statut" })).toHaveTextContent(/DEV-2026-014.*Claire Durand.*Aucun email/);
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Plus d'actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Marquer comme à signer" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Oui, à signer" }));
    expect(onChange.mock.calls.at(-1)[0].statut).toBe("en_signature");
  });
  it("envoyé : « Créer la facture finale » dans le menu facture le devis entier", () => {
    const onConvertToInvoice = vi.fn();
    renderDevis("envoye", { onConvertToInvoice, onCreateSolde: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: "Plus d'actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Créer la facture finale" }));
    expect(onConvertToInvoice).toHaveBeenCalledTimes(1);
  });

  it("avec acomptes : la facture finale est le solde, et disparaît une fois créée", () => {
    const onConvertToInvoice = vi.fn();
    const onCreateSolde = vi.fn(async () => {});
    const acompte = { id: "a1", devis_id: "d1", invoice_type: "acompte", statut: "envoyee", montant_ht: 207 };
    renderDevis("accepte", { onConvertToInvoice, onCreateSolde, invoices: [acompte] });
    fireEvent.click(screen.getByRole("button", { name: "Plus d'actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Créer la facture finale" }));
    expect(onCreateSolde).toHaveBeenCalledWith("d1", [acompte]);
    expect(onConvertToInvoice).not.toHaveBeenCalled();
  });

  it("facture finale déjà créée : plus proposée dans le menu", () => {
    const solde = { id: "s1", devis_id: "d1", invoice_type: "solde", statut: "brouillon", montant_ht: 690 };
    renderDevis("envoye", { onConvertToInvoice: vi.fn(), onCreateSolde: vi.fn(), invoices: [solde] });
    fireEvent.click(screen.getByRole("button", { name: "Plus d'actions" }));
    expect(screen.queryByRole("menuitem", { name: "Créer la facture finale" })).toBeNull();
  });
});
