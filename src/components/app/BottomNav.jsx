// Navigation principale mobile (bottom nav). Masquée en desktop via .app-bottom-nav.
//
// `firstDevisNudge` : quand true, affiche un tooltip animé "Essaye ton premier
// devis" au-dessus de l'onglet "agent" avec un pulse lumineux autour de l'icône.
// Pensé pour orienter les nouveaux inscrits (0 devis) vers l'agent IA sans
// devoir lire la doc. Auto-masqué dès que devis.length > 0 ou que l'utilisateur
// est déjà sur l'onglet agent.
export default function BottomNav({ items, activeNav, onSelect, plan, quotaReached, firstDevisNudge = false }) {
  return (
    <nav
      className="app-bottom-nav"
      style={{
        flexShrink: 0,
        background: "#1A1612", borderTop: "1px solid rgba(255,255,255,.06)",
        display: "flex",
      }}>
      <style>{`
        @keyframes bn-nudge-bob   { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-5px); } }
        @keyframes bn-nudge-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 100% { box-shadow: 0 0 0 14px rgba(34,197,94,0); } }
        /* Feedback tactile immédiat au tap : l'utilisateur sait que son
           appui a été pris en compte même si le setState async n'a pas
           encore mis à jour l'écran. */
        .app-bottom-nav button { -webkit-tap-highlight-color: transparent; transition: opacity .12s ease; }
        .app-bottom-nav button:active { opacity: .55; }
      `}</style>
      {items.map(({ id, label, icon }) => {
        const active     = activeNav === id;
        const isAgent    = id === "agent";
        const showNudge  = isAgent && firstDevisNudge;
        return (
          <button key={id} onClick={() => onSelect(id)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "14px 0", background: "none", border: "none", color: active ? "#22c55e" : "#6B6358", position: "relative", cursor: "pointer" }}>
            {active && <span style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 32, height: 3, background: "#22c55e", borderRadius: 2 }}/>}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", transform: "scale(1.35)", transformOrigin: "center" }}>
              {showNudge && (
                <span style={{
                  position: "absolute", inset: -6, borderRadius: "50%",
                  pointerEvents: "none",
                  animation: "bn-nudge-pulse 1.6s ease-out infinite",
                }}/>
              )}
              {icon}
              {id === "agent" && plan === "free" && quotaReached && (
                <span style={{ position: "absolute", top: -4, right: -10, background: "#ef4444", color: "white", fontSize: 8, fontWeight: 700, padding: "0 4px", height: 14, minWidth: 14, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", transform: "scale(0.74)", transformOrigin: "center" }}>
                  !
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>{label}</span>
            {showNudge && (
              <span style={{
                position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
                transform: "translateX(-50%)",
                background: "#22c55e",
                color: "white",
                fontSize: 12, fontWeight: 700,
                padding: "8px 12px",
                borderRadius: 10,
                whiteSpace: "nowrap",
                pointerEvents: "none",
                boxShadow: "0 6px 20px rgba(34,197,94,.45)",
                animation: "bn-nudge-bob 1.8s ease-in-out infinite",
              }}>
                ✨ Essaye ton premier devis
                <span style={{
                  position: "absolute", top: "100%", left: "50%",
                  marginLeft: -6,
                  width: 0, height: 0,
                  borderTop: "6px solid #22c55e",
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                }}/>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
