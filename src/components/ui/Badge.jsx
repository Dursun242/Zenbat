import { STATUT } from "../../lib/constants.js";

export default function Badge({ s }) {
  const c = STATUT[s] || STATUT.brouillon;
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
