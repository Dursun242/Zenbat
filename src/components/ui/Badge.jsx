// Statut d'un devis ou d'une facture dans une liste : petit tampon droit
// (capitales, filet de la couleur du statut). Même code couleur que le
// tampon de la fiche (devis/StatusStamp.jsx).
import { STATUT, STATUT_FACTURE } from "../../lib/constants.js";
import { ZB } from "../../lib/theme.js";

export default function Badge({ s, kind = "devis", short = false }) {
  const src = kind === "facture" ? STATUT_FACTURE : STATUT;
  const c = src[s] || src.brouillon;
  const color = ZB[c.tone] || ZB.ink2;
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", border: `1px solid ${color}`, borderRadius: 3,
      color, fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase",
      lineHeight: 1.4, whiteSpace: "nowrap", fontFamily: ZB.font,
    }}>
      {short && c.short ? c.short : c.label}
    </span>
  );
}
