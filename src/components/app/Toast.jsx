// Toast applicatif (Undo pour les suppressions, erreurs réseau).
export default function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className="app-toast" style={{ position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom))", left: 12, right: 12, background: toast.isError ? "#7f1d1d" : "#1A1612", color: "white", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, boxShadow: "0 10px 30px rgba(0,0,0,.25)", zIndex: 100, animation: "fadeUp .18s ease both" }}>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{toast.label}</span>
      <div style={{ display: "flex", gap: 6 }}>
        {!toast.isError && (
          <button onClick={() => { toast.onUndo?.(); onDismiss(); }}
            style={{ background: "#22c55e", color: "white", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            Annuler
          </button>
        )}
        <button onClick={onDismiss} style={{ background: "transparent", color: "#9A8E82", border: "none", fontSize: 14, cursor: "pointer", padding: "2px 6px" }}>×</button>
      </div>
    </div>
  );
}
