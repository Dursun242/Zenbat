// Navigation principale mobile sous forme de FAB (Floating Action Button)
// + bottom sheet. Remplace l'ancienne BottomNav fixée en bas, qui souffrait
// d'un bug iOS PWA standalone où position:fixed bottom:0 ne s'ancrait pas
// correctement au visual viewport (grosse bande noire sous la nav). Le FAB
// est positionné en absolute dans le shell (dont la hauteur est pilotée
// par JS sur window.innerHeight), donc ancrage fiable.
//
// `firstDevisNudge` : quand true, affiche un pulse vert autour du FAB pour
// inviter les nouveaux inscrits (0 devis) à essayer l'agent IA.
import { useState, useEffect } from "react";

export default function NavFAB({ items, activeNav, onSelect, plan, quotaReached, firstDevisNudge = false }) {
  const [open, setOpen] = useState(false);

  // Ferme le drawer à l'échap (clavier physique iPad, accessibilité)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const activeItem = items.find(i => i.id === activeNav) || items[0];
  const showBadge  = plan === "free" && quotaReached;

  return (
    <>
      <style>{`
        @keyframes nf-pulse  { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55), 0 4px 14px rgba(0,0,0,.25); } 100% { box-shadow: 0 0 0 18px rgba(34,197,94,0), 0 4px 14px rgba(0,0,0,.25); } }
        @keyframes nf-fade   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nf-slide  { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .nf-fab { -webkit-tap-highlight-color: transparent; transition: transform .12s ease, opacity .12s ease; }
        .nf-fab:active { transform: scale(.92); }
        .nf-item { -webkit-tap-highlight-color: transparent; transition: background .12s ease; }
        .nf-item:active { background: rgba(34,197,94,.15) !important; }
      `}</style>

      {/* FAB */}
      <button
        className="nf-fab app-bottom-nav"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu de navigation"
        style={{
          position: "absolute",
          bottom: 18, right: 18,
          width: 60, height: 60, borderRadius: "50%",
          background: "#22c55e",
          border: "none",
          color: "white",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: firstDevisNudge
            ? "0 0 0 0 rgba(34,197,94,.55), 0 4px 14px rgba(0,0,0,.25)"
            : "0 4px 14px rgba(0,0,0,.25)",
          animation: firstDevisNudge ? "nf-pulse 1.6s ease-out infinite" : "none",
          zIndex: 49,
        }}>
        {/* Icône de l'onglet actif au centre pour repère visuel */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", transform: "scale(1.25)" }}>
          {activeItem.icon}
          {showBadge && (
            <span style={{ position: "absolute", top: -6, right: -8, background: "#ef4444", color: "white", fontSize: 9, fontWeight: 800, padding: "0 4px", height: 14, minWidth: 14, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #22c55e" }}>!</span>
          )}
        </div>
      </button>

      {/* Drawer / bottom sheet */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
            animation: "nf-fade .18s ease both",
          }}>
          <div
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Navigation"
            style={{
              width: "100%",
              background: "white",
              borderRadius: "20px 20px 0 0",
              padding: "10px 12px 14px",
              boxShadow: "0 -8px 30px rgba(0,0,0,.18)",
              animation: "nf-slide .22s cubic-bezier(.34,1.3,.64,1) both",
            }}>
            {/* Grip handle visuel */}
            <div style={{ width: 40, height: 4, background: "#E8E2D8", borderRadius: 2, margin: "4px auto 12px" }}/>
            {items.map(({ id, label, icon }) => {
              const active = activeNav === id;
              const isAgent = id === "agent";
              const itemBadge = isAgent && plan === "free" && quotaReached;
              return (
                <button
                  key={id}
                  className="nf-item"
                  onClick={() => { onSelect(id); setOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    width: "100%",
                    padding: "13px 14px",
                    border: "none",
                    background: active ? "rgba(34,197,94,.10)" : "transparent",
                    color: active ? "#22c55e" : "#3D3028",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: active ? 700 : 500,
                    textAlign: "left",
                    marginBottom: 2,
                  }}>
                  <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: active ? "#22c55e" : "#6B6358" }}>
                    {icon}
                  </div>
                  <span style={{ flex: 1 }}>{label}</span>
                  {itemBadge && (
                    <span style={{ background: "#ef4444", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>Quota</span>
                  )}
                  {active && (
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
