// Statut d'un devis affiché comme un tampon sur le document : capitales,
// double filet, légèrement penché. Encre pour ce qui attend, vert tampon
// pour ce qui est acquis, rouge pour un refus.
import { STATUT } from "../../lib/constants.js";
import { ZB } from "../../lib/theme.js";

const STAMP = {
  brouillon:      { color: ZB.ink3,   label: "Brouillon" },
  envoye:         { color: ZB.ink2,   label: "Envoyé" },
  en_signature:   { color: ZB.ink,    label: "À signer" },
  en_negociation: { color: ZB.ink,    label: "Modifications demandées" },
  accepte:        { color: ZB.stamp,  label: "Signé" },
  refuse:         { color: ZB.danger, label: "Refusé" },
  remplace:       { color: ZB.ink3,   label: "Remplacé" },
};

export default function StatusStamp({ statut }) {
  const s = STAMP[statut] || { color: ZB.ink3, label: STATUT[statut]?.label || statut };
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
