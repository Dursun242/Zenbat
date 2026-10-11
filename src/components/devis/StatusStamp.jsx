// Statut d'un devis (ou d'une facture) affiché comme un tampon sur le document : capitales,
// double filet, légèrement penché. Encre pour ce qui attend, vert tampon
// pour ce qui est acquis, rouge pour un refus.
import { STATUT, STATUT_FACTURE } from "../../lib/constants.js";
import { ZB } from "../../lib/theme.js";


export default function StatusStamp({ statut, kind = "devis", label }) {
  const st = (kind === "facture" ? STATUT_FACTURE : STATUT)[statut];
  const s = { color: ZB[st?.tone] || ZB.ink3, label: label || st?.label || statut };
  return (
    <span className="zb-stamp" style={{
      display: "inline-block", padding: "5px 10px", border: `4px double ${s.color}`, borderRadius: 4,
      color: s.color, fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
      lineHeight: 1.1, whiteSpace: "nowrap", transform: "rotate(-3deg)", transformOrigin: "center",
    }}>
      {s.label}
    </span>
  );
}
