import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const renderDataToPdf = vi.fn();
vi.mock("../lib/pdf.js", () => ({ renderDataToPdf: (...a) => renderDataToPdf(...a) }));

import PDFViewer from "./PDFViewer.jsx";

// jsdom n'a pas ResizeObserver (la fenêtre s'en sert pour ajuster le zoom).
globalThis.ResizeObserver ??= class { observe() {} disconnect() {} };

const d = {
  id: "d1", numero: "DEV-2026-014", objet: "Salle de bain", statut: "brouillon", tva_rate: 10,
  lignes: [{ id: "l1", type_ligne: "ouvrage", designation: "WC suspendu", unite: "u", quantite: 1, prix_unitaire: 690, tva_rate: 10 }],
};
const cl = { id: "c1", prenom: "Claire", nom: "Durand", email: "c.durand@exemple.fr" };

describe("Fenêtre PDF", () => {
  it("« Marquer comme envoyé » demande une confirmation dans la barre", () => {
    const onMarkSent = vi.fn();
    const onClose = vi.fn();
    render(<PDFViewer d={d} cl={cl} brand={{}} onClose={onClose} onMarkSent={onMarkSent} onMarkSignature={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button", { name: "Marquer comme envoyé" }));
    expect(onMarkSent).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Confirmer le statut" })).toHaveTextContent(/DEV-2026-014 comme envoyé/);

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("group", { name: "Confirmer le statut" })).toBeNull();
    expect(onMarkSent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Marquer comme envoyé" }));
    fireEvent.click(screen.getByRole("button", { name: "Oui, marquer envoyé" }));
    expect(onMarkSent).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("échec de génération : message dans l'écran, pas d'alert()", async () => {
    renderDataToPdf.mockRejectedValueOnce(new Error("police introuvable"));
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PDFViewer d={{ ...d, statut: "envoye" }} cl={cl} brand={{}} onClose={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le PDF" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Impossible de générer le PDF : police introuvable/));
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
