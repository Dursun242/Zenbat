import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClientPickerModal from "./ClientPickerModal.jsx";

const clients = [{ id: "c1", prenom: "Claire", nom: "Durand", email: "c.durand@exemple.fr" }];

describe("Sélecteur de client", () => {
  it("création rapide (Agent IA) : enregistre le client puis le choisit", async () => {
    const onCreate = vi.fn(async () => {});
    const onSelect = vi.fn();
    const onClose  = vi.fn();
    render(<ClientPickerModal clients={clients} showCurrent={false} onCreate={onCreate} onSelect={onSelect} onClose={onClose}
      title="À quel client associer ce devis ?" noClientLabel="Enregistrer sans client" createLabel="Créer et enregistrer le devis"/>);
    expect(screen.getByRole("dialog", { name: "À quel client associer ce devis ?" })).toBeInTheDocument();
    // Rien n'est marqué « actuel » pour un devis pas encore enregistré.
    expect(screen.queryByText("actuel")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Nouveau client" }));
    fireEvent.change(screen.getByLabelText("Nom du client"), { target: { value: "Marc Petit" } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "marc@exemple.fr" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer et enregistrer le devis" }));

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    const created = onCreate.mock.calls[0][0];
    expect(created).toMatchObject({ nom: "Marc Petit", email: "marc@exemple.fr", type: "particulier" });
    expect(onSelect).toHaveBeenCalledWith(created);
    expect(onClose).toHaveBeenCalled();
  });

  it("option « sans client »", () => {
    const onSelect = vi.fn();
    render(<ClientPickerModal clients={clients} showCurrent={false} onSelect={onSelect} onClose={() => {}} noClientLabel="Enregistrer sans client"/>);
    expect(screen.queryByRole("button", { name: "Nouveau client" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer sans client" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
