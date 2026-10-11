import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Bordereau from "./Bordereau.jsx";

const base = {
  brand: { companyName: "Martin Rénovation", vatRegime: "normal" },
  objet: "", onObjetChange: () => {}, lignes: [], visibleCount: 0,
  editingId: null, setEditingId: () => {}, onLineChange: () => {}, onLineDelete: () => {},
  onAddLine: () => {}, ht: 0, tvaRows: [], ttc: 0, loading: false,
  quickStarts: ["Rénovation salle de bain 6 m²", "Pose carrelage 40 m²", "Peinture 3 pièces", "Isolation combles"],
  onExample: () => {}, onSave: () => {}, onClear: () => {}, onOpenCoherence: () => {}, historySummary: null,
};
const lignes = [
  { id: "lot1", type_ligne: "lot", designation: "Plomberie" },
  { id: "l1", type_ligne: "ouvrage", designation: "WC suspendu", unite: "u", quantite: 1, prix_unitaire: 690, tva_rate: 10 },
  { id: "l2", type_ligne: "ouvrage", designation: "Lavabo", unite: "u", quantite: 2, prix_unitaire: 100, tva_rate: 10 },
];

describe("Bordereau (écran Agent IA)", () => {
  it("vierge : en-tête de l'entreprise et 3 exemples qui lancent la rédaction", () => {
    const onExample = vi.fn();
    render(<Bordereau {...base} onExample={onExample}/>);
    expect(screen.getByText("Martin Rénovation")).toBeInTheDocument();
    const examples = screen.getAllByRole("listitem");
    expect(examples).toHaveLength(3);
    fireEvent.click(examples[0]);
    expect(onExample).toHaveBeenCalledWith("Rénovation salle de bain 6 m²");
  });

  it("sans lignes de lot : regroupe d'après le champ lot des ouvrages", () => {
    const parLot = [
      { id: "a", type_ligne: "ouvrage", lot: "Démolition", designation: "Dépose faïence", unite: "m²", quantite: 10, prix_unitaire: 20, tva_rate: 10 },
      { id: "b", type_ligne: "ouvrage", lot: "Démolition", designation: "Évacuation gravats", unite: "forfait", quantite: 1, prix_unitaire: 150, tva_rate: 10 },
      { id: "c", type_ligne: "ouvrage", lot: "Plomberie", designation: "Douche", unite: "u", quantite: 1, prix_unitaire: 900, tva_rate: 10 },
    ];
    render(<Bordereau {...base} lignes={parLot} visibleCount={3} ht={1250} ttc={1375}
      tvaRows={[{ rate: 10, base: 1250, montant: 125 }]}/>);
    expect(screen.getByRole("heading", { name: "Démolition" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Plomberie" })).toBeInTheDocument();
  });

  it("rempli : lot avec sous-total, total TTC et action principale", () => {
    const onSave = vi.fn();
    render(<Bordereau {...base} lignes={lignes} visibleCount={3} ht={890} ttc={979}
      tvaRows={[{ rate: 10, base: 890, montant: 89 }]} onSave={onSave}/>);
    expect(screen.getByRole("heading", { name: "Plomberie" })).toBeInTheDocument();
    expect(screen.getAllByText(/890,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/979,00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le devis" }));
    expect(onSave).toHaveBeenCalled();
  });

  it("un appui sur une ligne l'ouvre en modification", () => {
    const setEditingId = vi.fn();
    render(<Bordereau {...base} lignes={lignes} visibleCount={3} ht={890} ttc={979} setEditingId={setEditingId}/>);
    fireEvent.click(screen.getByRole("button", { name: "Modifier : WC suspendu" }));
    expect(setEditingId).toHaveBeenCalledWith("l1");
  });

  it("ligne en modification : quantité enregistrée en nombre, TVA au choix", () => {
    const onLineChange = vi.fn();
    render(<Bordereau {...base} lignes={lignes} visibleCount={3} ht={890} ttc={979} editingId="l1" onLineChange={onLineChange}/>);
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "2,5" } });
    fireEvent.click(screen.getByRole("radio", { name: /5,5/ }));
    expect(onLineChange).toHaveBeenCalledWith("l1", { tva_rate: 5.5 });
    fireEvent.click(screen.getByRole("button", { name: "Terminé" }));
    expect(onLineChange).toHaveBeenLastCalledWith("l1", expect.objectContaining({ quantite: 2.5, prix_unitaire: 690 }));
  });

  it("« Tout effacer » demande un second appui", () => {
    const onClear = vi.fn();
    render(<Bordereau {...base} lignes={lignes} visibleCount={3} ht={890} ttc={979} onClear={onClear}/>);
    fireEvent.click(screen.getByRole("button", { name: "Tout effacer" }));
    expect(onClear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Appuie encore/ }));
    expect(onClear).toHaveBeenCalled();
  });
});
