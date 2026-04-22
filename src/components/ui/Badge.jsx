import { STATUT, STATUT_FACTURE } from "../../lib/constants.js";

export default function Badge({ s, kind = "devis" }) {
  const src = kind === "facture" ? STATUT_FACTURE : STATUT;
  const c = src[s] || src.brouillon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20,
      background: c.bg, color: c.color, fontSize: 10, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }}/>
      {c.label}
    </span>
  );
}
