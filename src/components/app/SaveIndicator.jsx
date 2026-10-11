// Indicateur de sauvegarde affiché dans l'en-tête. Rassure l'utilisateur non-tech
// sur le fait que son travail est bien enregistré — quand on tape dans un devis,
// le save est débouncé, l'utilisateur ne voit rien sinon.
//
// États : "idle" (vide), "saving" (Enregistrement…), "saved" (Enregistré).
// La région live reste montée pour que les lecteurs d'écran annoncent le changement.
import { ZB } from "../../lib/theme.js";

export default function SaveIndicator({ state }) {
  const visible = state === "saving" || state === "saved";
  const saving = state === "saving";
  return (
    <span role="status" style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      color: saving ? ZB.ink3 : ZB.stamp, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {visible && (
        <>
          {saving
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{ animation: "spin .9s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><polyline points="20,6 9,17 4,12"/></svg>}
          {saving ? "Enregistrement…" : "Enregistré"}
        </>
      )}
    </span>
  );
}
