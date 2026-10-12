// Toast applicatif (Undo pour les suppressions, erreurs réseau).
import { ZB } from "../../lib/theme.js";
import { ABOVE_NAV_CSS } from "./BottomNav.jsx";

// Mobile : 12 px au-dessus de la barre du bas (64 px + zone du home
// indicator). Ordinateur : la barre du bas est masquée, `.app-toast` est
// replacé en bas à droite par la feuille de style d'App.jsx (≥ 1024 px).
const TOAST_BOTTOM = `calc(${ABOVE_NAV_CSS} + 12px)`;

export default function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className="app-toast" role={toast.isError ? "alert" : "status"}
      style={{ position: "fixed", bottom: TOAST_BOTTOM, left: 12, right: 12, background: toast.isError ? ZB.danger : ZB.ink, color: "white", borderRadius: 10, padding: "6px 6px 6px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, boxShadow: "0 10px 30px rgba(26,22,18,.25)", zIndex: 100, animation: "fadeUp .18s ease both", fontFamily: ZB.font }}>
      <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35 }}>{toast.label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {!toast.isError && (
          <button onClick={() => { toast.onUndo?.(); onDismiss(); }}
            style={{ minHeight: 44, background: ZB.accent, color: "white", border: "none", borderRadius: 8, padding: "0 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Annuler
          </button>
        )}
        <button onClick={onDismiss} aria-label="Fermer"
          style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "transparent", color: ZB.onInk, border: "none", cursor: "pointer" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
    </div>
  );
}
