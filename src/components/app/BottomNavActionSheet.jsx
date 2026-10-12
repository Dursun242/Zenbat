// Sheet d'actions rapides déclenchée par un appui long sur le CTA central
// (Agent IA) de la BottomNav. Apparaît au-dessus de la nav, slide-up animé,
// fond cliquable pour fermer.
//
// Props :
//   open    — bool, contrôle l'affichage
//   onClose — () => void, fermeture (tap overlay ou bouton)
//   actions — [{ id, label, hint?, icon?, onClick }]
import { useEffect } from "react";
import { SAFE_BOTTOM_CSS, IOS_GAP_CSS } from "./BottomNav.jsx";
import { ZB } from "../../lib/theme.js";

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
        @keyframes bn-sheet-in   { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bn-overlay-in { from { opacity: 0; } to { opacity: 1; } }
        .zb-bn-item:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: -2px; }
        @media (hover: hover) { .zb-bn-item:hover { background: ${ZB.paper2} !important; } }
        @media (prefers-reduced-motion: reduce) { .zb-bn-sheet, .zb-bn-overlay { animation: none !important; } }
      `}</style>

      {open && (
        <>
          {/* Overlay sombre — ferme au tap */}
          <div
            onClick={onClose}
            aria-hidden="true"
            className="zb-bn-overlay"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(26,22,18,.55)",
              zIndex: 60,
              animation: "bn-overlay-in .18s ease both",
            }}
          />

          {/* Sheet — positionné au-dessus de la nav (safe-area inclus) */}
          <div
            role="menu"
            aria-label="Actions rapides Agent IA"
            className="zb-bn-sheet"
            style={{
              position: "fixed",
              left: 16, right: 16,
              bottom: `calc(80px + ${SAFE_BOTTOM_CSS} - ${IOS_GAP_CSS})`,
              background: ZB.sheet,
              border: `1px solid ${ZB.rule}`,
              borderRadius: 10,
              boxShadow: "0 10px 30px rgba(26,22,18,.16)",
              padding: 4,
              zIndex: 61,
              fontFamily: ZB.font,
              animation: "bn-sheet-in .2s ease-out both",
              maxWidth: 420,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {actions.map((a, i) => (
              <button
                key={a.id}
                type="button"
                role="menuitem"
                className="zb-bn-item"
                onClick={() => { onClose?.(); a.onClick?.(); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  minHeight: 56,
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  WebkitTapHighlightColor: "transparent",
                  borderTop: i === 0 ? "none" : `1px solid ${ZB.ruleSoft}`,
                }}
              >
                {a.icon && (
                  <span style={{
                    width: 22,
                    color: ZB.ink2,
                    display: "inline-flex",
                    alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>{a.icon}</span>
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: ZB.ink }}>
                    {a.label}
                  </span>
                  {a.hint && (
                    <span style={{ display: "block", fontSize: 13, color: ZB.ink2, marginTop: 2 }}>
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
