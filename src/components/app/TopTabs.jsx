// Navigation principale mobile — onglets en haut, sticky sous le header.
// Remplace l'ancienne BottomNav fixée en bas qui buggait sur iOS PWA standalone
// (grosse bande noire persistante sous la nav). En haut, plus de problème de
// safe-area-inset-bottom ni de position:fixed bottom : la nav est un flex
// child du shell, placée naturellement entre le header et le contenu scrollable.
//
// UX :
// - 1 tap pour changer de section (pas de drawer intermédiaire)
// - Strip scrollable horizontalement si l'écran est trop étroit (rare en
//   pratique : 5 tabs × ~70px = 350px, ça passe sur iPhone SE 375px)
// - Active : soulignage vert + texte vert bold
// - Badge rouge sur "Agent IA" quand le quota freemium est atteint
// - Pulse vert (firstDevisNudge) autour de "Agent IA" pour les nouveaux 0-devis
//
// Masqué sur desktop (>=1024px) via la classe .app-top-tabs — la sidebar
// gauche prend le relais comme avant.
export default function TopTabs({ items, activeNav, onSelect, plan, quotaReached, firstDevisNudge = false }) {
  return (
    <div
      className="app-top-tabs"
      style={{
        flexShrink: 0,
        display: "flex",
        background: "white",
        borderBottom: "1px solid #E8E2D8",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}>
      <style>{`
        @keyframes tt-pulse { 0% { box-shadow: inset 0 0 0 0 rgba(34,197,94,.45); } 100% { box-shadow: inset 0 0 0 10px rgba(34,197,94,0); } }
        .app-top-tabs::-webkit-scrollbar { display: none; }
        .app-top-tabs button { -webkit-tap-highlight-color: transparent; transition: color .12s ease, background .12s ease; }
        .app-top-tabs button:active { background: rgba(34,197,94,.08); }
      `}</style>
      {items.map(({ id, label, icon }) => {
        const active     = activeNav === id;
        const isAgent    = id === "agent";
        const showNudge  = isAgent && firstDevisNudge;
        const showBadge  = isAgent && plan === "free" && quotaReached;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            aria-current={active ? "page" : undefined}
            style={{
              flex: "1 0 auto",
              minWidth: 70,
              padding: "10px 6px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              border: "none",
              background: "transparent",
              borderBottom: `3px solid ${active ? "#22c55e" : "transparent"}`,
              color: active ? "#22c55e" : "#6B6358",
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              cursor: "pointer",
              position: "relative",
              animation: showNudge ? "tt-pulse 1.6s ease-out infinite" : "none",
            }}>
            <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              {icon}
              {showBadge && (
                <span style={{ position: "absolute", top: -4, right: -6, background: "#ef4444", color: "white", fontSize: 9, fontWeight: 800, padding: "0 4px", height: 13, minWidth: 13, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>!</span>
              )}
            </div>
            <span style={{ whiteSpace: "nowrap" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
