// Indicateur de sauvegarde affiché dans l'en-tête. Rassure l'utilisateur non-tech
// sur le fait que son travail est bien enregistré — quand on tape dans un devis,
// le save est débouncé, l'utilisateur ne voit rien sinon.
//
// États : "idle" (masqué), "saving" (⟳ Enregistrement…), "saved" (✓ Enregistré)

export default function SaveIndicator({ state }) {
  if (state === "idle" || !state) return null;
  const saving = state === "saving";
  const label  = saving ? "Enregistrement…" : "Enregistré";
  const color  = saving ? "#9A8E82" : "#4ade80";
  const bg     = saving ? "rgba(148,163,184,.14)" : "rgba(34,197,94,.14)";
  const border = saving ? "rgba(148,163,184,.25)" : "rgba(34,197,94,.25)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: bg, border: `1px solid ${border}`,
      color, fontSize: 11, fontWeight: 600,
      padding: "3px 9px", borderRadius: 20,
      animation: "fadeUp .2s ease both",
    }}>
      {saving
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin .9s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20,6 9,17 4,12"/></svg>
      }
      {label}
    </span>
  );
}
