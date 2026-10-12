import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DevisPublicPage from "./DevisPublicPage.jsx";

const data = {
  numero: "DEV-2026-014", objet: "Salle de bain", statut: "envoye", verified: false, tva_rate: 10,
  date_emission: "2026-10-11", emailHint: "c.d***@exemple.fr",
  artisan: { company: "Martin Rénovation", color: "#22c55e", brand: { vatRegime: "normal" } },
  client: { name: "Claire Durand" },
  lignes: [
    { id: "a", type_ligne: "ouvrage", designation: "WC suspendu", unite: "u", quantite: 1, prix_unitaire: 690, tva_rate: 10 },
    { id: "b", type_ligne: "ouvrage", designation: "Faïence", unite: "m²", quantite: 10, prix_unitaire: 50.5, tva_rate: 20 },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe("Page de signature client", () => {
  it("affiche les lignes et le total TTC du calcul unique, puis demande le code avant de signer", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
      String(url).startsWith("/api/devis-public?")
        ? new Response(JSON.stringify(data), { status: 200 })
        : new Response(JSON.stringify({ session_id: "s1" }), { status: 200 }));
    render(<DevisPublicPage token="tok"/>);
    expect(await screen.findByText("WC suspendu")).toBeInTheDocument();
    // 690 × 1,10 + 505 × 1,20 = 759 + 606 = 1 365,00 € TTC
    expect(screen.getAllByText(/1\s365,00/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Signer le devis" }));
    expect(await screen.findByText("Confirmez qu'il s'agit bien de vous")).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([, init]) => init && JSON.parse(init.body).action === "accept")).toBe(false);
  });
});
