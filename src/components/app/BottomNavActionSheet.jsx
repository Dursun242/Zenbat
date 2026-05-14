// Sheet d'actions rapides déclenchée par un appui long sur le CTA central
// (Agent IA) de la BottomNav. Apparaît au-dessus de la nav, slide-up animé,
// fond cliquable pour fermer.
//
// Props :
//   open    — bool, contrôle l'affichage
//   onClose — () => void, fermeture (tap overlay ou bouton)
//   actions — [{ id, label, hint?, icon?, onClick }]
import { useEffect } from "react";

const BRAND = "#22c55e";

export default function BottomNavActionSheet({ open, onClose, actions = [] }) {
  // Esc ferme le sheet (desktop).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <style>{`
        @keyframes bn-sheet-in   { from { opacity: 0; transform: translateY(20px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes bn-overlay-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {open && (
        <>
          {/* Overlay sombre — ferme au tap */}
          <div
            onClick={onClose}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.4)",
              zIndex: 60,
              animation: "bn-overlay-in .18s ease both",
            }}
          />

          {/* Sheet — positionné au-dessus de la nav (safe-area inclus) */}
          <div
            role="menu"
            aria-label="Actions rapides Agent IA"
            style={{
              position: "fixed",
              left: 16, right: 16,
              bottom: `calc(80px + env(safe-area-inset-bottom, 0px))`,
              background: "white",
              borderRadius: 18,
              boxShadow: "0 20px 60px rgba(0,0,0,.35)",
              padding: 6,
              zIndex: 61,
              animation: "bn-sheet-in .22s cubic-bezier(.34, 1.56, .64, 1) both",
              maxWidth: 420,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {actions.map((a, i) => (
              <button
                key={a.id}
                role="menuitem"
                onClick={() => { onClose?.(); a.onClick?.(); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "12px 14px",
                  background: "transparent",
                  border: "none",
                  borderRadius: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  WebkitTapHighlightColor: "transparent",
                  borderTop: i === 0 ? "none" : "1px solid #F0EBE3",
                }}
              >
                {a.icon && (
                  <span style={{
                    width: 36, height: 36,
                    borderRadius: 10,
                    background: `${BRAND}18`,
                    color: BRAND,
                    display: "inline-flex",
                    alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>{a.icon}</span>
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#1A1612" }}>
                    {a.label}
                  </span>
                  {a.hint && (
                    <span style={{ display: "block", fontSize: 12, color: "#6B6358", marginTop: 2 }}>
                      {a.hint}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
