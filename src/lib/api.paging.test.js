import { describe, it, expect, vi } from "vitest";

// Supabase simulé : 2 350 lignes de devis, réponses coupées à 1000 par page.
const lignes = Array.from({ length: 2350 }, (_, i) => ({ id: `l${i}`, devis_id: i < 2300 ? "d1" : "d2", position: i }));
const devis = [{ id: "d1" }, { id: "d2" }];
const rangeCalls = [];
function query(rows) {
  const q = {
    select: () => q, is: () => q, order: () => q,
    range: (from, to) => { rangeCalls.push([from, to]); return Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null }); },
  };
  return q;
}
vi.mock("./supabase.js", () => ({
  supabase: { from: (t) => query(t === "devis" ? devis : lignes) },
}));

import { listDevisWithLignes } from "./api.js";

describe("listDevisWithLignes — au-delà de 1000 lignes", () => {
  it("lit toutes les pages : aucune ligne perdue", async () => {
    const out = await listDevisWithLignes();
    expect(out.find(d => d.id === "d1").lignes).toHaveLength(2300);
    expect(out.find(d => d.id === "d2").lignes).toHaveLength(50);
    expect(rangeCalls).toContainEqual([2000, 2999]);
  });
});
