// Navigation principale mobile (bottom nav). Masquée en desktop via .app-bottom-nav.
export default function BottomNav({ items, activeNav, onSelect, plan, daysLeft }) {
  return (
    <nav className="app-bottom-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0f172a", borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", zIndex: 50 }}>
      {items.map(({ id, label, icon }) => {
        const active = activeNav === id;
        return (
          <button key={id} onClick={() => onSelect(id)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "10px 0", background: "none", border: "none", color: active ? "#22c55e" : "#64748b", position: "relative", cursor: "pointer" }}>
            {active && <span style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 2.5, background: "#22c55e", borderRadius: 2 }}/>}
            <div style={{ position: "relative" }}>
              {icon}
              {id === "agent" && plan === "free" && daysLeft <= 7 && (
                <span style={{ position: "absolute", top: -4, right: -10, background: daysLeft === 0 ? "#ef4444" : "#f97316", color: "white", fontSize: 8, fontWeight: 700, padding: "0 4px", height: 14, minWidth: 14, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {daysLeft === 0 ? "!" : `${daysLeft}j`}
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
