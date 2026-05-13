// Side dock vertical, flottant, frosted glass, déplaçable aux 4 coins.
//
// Format : pilule verticale ancrée à un coin de l'écran (haut/bas × droite/gauche).
// 5 onglets empilés, indicateur actif animé via Framer Motion layoutId.
//
// Gestes :
// - Tap sur le chevron du header  → replie le dock (ne reste qu'un mince
//   handle au bord, du même côté que le coin courant).
// - Drag sur le chevron du header → déplace le dock ; au relâchement, snap
//   au coin le plus proche (parmi top-left, top-right, bottom-left, bottom-right).
//
// État (collapsed + corner) persisté en localStorage.
//
// Visuel : verre dépoli sombre — `rgba(20,16,12,.55)` + `backdrop-filter: blur(28px) saturate(180%)`.
// Le fond cream de l'app reste légèrement perceptible derrière, donnant
// la sensation de profondeur sans le rendu boueux du frosted clair sur cream.
//
// Le composant garde son nom historique (BottomNav.jsx) pour ne pas
// casser les imports.
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";

const BRAND = "#22c55e";
const STORAGE_COLLAPSED = "zenbat:sideDock:collapsed";
const STORAGE_CORNER    = "zenbat:sideDock:corner";
const VALID_CORNERS     = ["tl", "tr", "bl", "br"];

const FROST_BG     = "rgba(20, 16, 12, 0.55)";
const FROST_FILTER = "blur(28px) saturate(180%)";

export default function BottomNav({ items, activeNav, onSelect, plan, quotaReached, firstDevisNudge = false }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_COLLAPSED) === "1"; } catch { return false; }
  });
  const [corner, setCorner] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_CORNER);
      return VALID_CORNERS.includes(v) ? v : "br";
    } catch { return "br"; }
  });
  const dragControls = useDragControls();

  useEffect(() => { try { localStorage.setItem(STORAGE_COLLAPSED, collapsed ? "1" : "0"); } catch {} }, [collapsed]);
  useEffect(() => { try { localStorage.setItem(STORAGE_CORNER, corner); } catch {} }, [corner]);

  const isRight = corner.endsWith("r");
  const isTop   = corner.startsWith("t");

  const dockAnchor = {
    ...(isTop   ? { top: 16 }    : { bottom: 16 }),
    ...(isRight ? { right: 10 }  : { left: 10 }),
  };
  const handleAnchor = {
    ...(isTop   ? { top: "calc(50% - 32px)" } : { bottom: "calc(50% - 32px)" }),
    // Pour le handle replié, on préfère rester centré verticalement
    // peu importe le coin choisi → handle facile à attraper.
    ...(isRight ? { right: 0 } : { left: 0 }),
  };

  function snapToNearestCorner(_, info) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { x, y } = info.point;
    const side = x < w / 2 ? "l" : "r";
    const vert = y < h / 2 ? "t" : "b";
    setCorner(`${vert}${side}`);
  }

  // Chevron : ‹ ou › selon qu'on replie vers la droite ou vers la gauche.
  const collapseChevron = isRight
    ? <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    : <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>;
  const expandChevron = isRight
    ? <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    : <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>;

  return (
    <>
      <style>{`
        @keyframes sd-nudge-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 100% { box-shadow: 0 0 0 12px rgba(34,197,94,0); } }
        .app-bottom-nav button { -webkit-tap-highlight-color: transparent; }
        .app-bottom-nav button:active { opacity: .65; }
      `}</style>

      <AnimatePresence initial={false} mode="wait">
        {collapsed ? (
          // -- Handle replié : fine pastille frosted collée au bord, du même côté que le coin courant.
          <motion.button
            key={`handle-${isRight ? "r" : "l"}`}
            initial={{ opacity: 0, x: isRight ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit   ={{ opacity: 0, x: isRight ? 30 : -30 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={() => setCollapsed(false)}
            aria-label="Déployer le menu"
            className="app-bottom-nav"
            style={{
              position: "fixed",
              ...handleAnchor,
              width: 18,
              height: 64,
              borderRadius: isRight ? "12px 0 0 12px" : "0 12px 12px 0",
              background: FROST_BG,
              backdropFilter: FROST_FILTER,
              WebkitBackdropFilter: FROST_FILTER,
              border: "1px solid rgba(255,255,255,.10)",
              ...(isRight ? { borderRight: "none" } : { borderLeft: "none" }),
              boxShadow: isRight ? "-4px 6px 18px rgba(0,0,0,.18)" : "4px 6px 18px rgba(0,0,0,.18)",
              color: "#E8E2D8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 50,
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">{expandChevron}</svg>
          </motion.button>
        ) : (
          <motion.nav
            // key sur corner → re-mount à la nouvelle position après dragEnd ;
            // évite que le transform de drag persiste au-dessus du nouveau top/right.
            key={`dock-${corner}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit   ={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            drag
            dragMomentum={false}
            dragElastic={0.18}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={snapToNearestCorner}
            whileDrag={{ scale: 1.05, boxShadow: "0 22px 60px rgba(0,0,0,.32)" }}
            className="app-bottom-nav"
            style={{
              position: "fixed",
              ...dockAnchor,
              width: 60,
              borderRadius: 22,
              background: FROST_BG,
              backdropFilter: FROST_FILTER,
              WebkitBackdropFilter: FROST_FILTER,
              border: "1px solid rgba(255,255,255,.10)",
              boxShadow: "0 14px 36px rgba(0,0,0,.24), 0 2px 6px rgba(0,0,0,.12)",
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              zIndex: 50,
              touchAction: "none", // évite le scroll de la page pendant un drag
            }}>
            {/* Header = handle de drag + bouton repli (même cible). */}
            <button
              onPointerDown={(e) => dragControls.start(e)}
              onClick={() => setCollapsed(true)}
              aria-label="Replier le menu (glisser pour déplacer)"
              title="Glisser pour déplacer"
              style={{
                background: "transparent",
                border: "none",
                color: "#A89F94",
                padding: "4px 0 2px",
                marginBottom: 2,
                cursor: "grab",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                touchAction: "none",
              }}>
              {/* Petit grip pour signifier la zone de drag */}
              <span style={{ display: "flex", gap: 2, opacity: 0.5 }}>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor" }}/>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor" }}/>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor" }}/>
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">{collapseChevron}</svg>
            </button>

            {items.map(({ id, label, icon }) => {
              const active    = activeNav === id;
              const isAgent   = id === "agent";
              const showNudge = isAgent && firstDevisNudge;

              return (
                <button
                  key={id}
                  onClick={() => onSelect(id)}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  style={{
                    position: "relative",
                    width: "100%",
                    minHeight: 48,
                    background: "transparent",
                    border: "none",
                    color: active ? BRAND : "#C9C0B5",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    padding: "6px 2px",
                    cursor: "pointer",
                  }}>
                  {active && (
                    <motion.span
                      layoutId="side-dock-active"
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(34, 197, 94, 0.18)",
                        borderRadius: 14,
                        zIndex: 0,
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}

                  <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", transform: "scale(1.15)" }}>
                    {showNudge && (
                      <span style={{
                        position: "absolute", inset: -6, borderRadius: "50%",
                        pointerEvents: "none",
                        animation: "sd-nudge-pulse 1.6s ease-out infinite",
                      }}/>
                    )}
                    {icon}
                    {isAgent && plan === "free" && quotaReached && (
                      <span style={{
                        position: "absolute", top: -4, right: -10,
                        background: "#ef4444", color: "white",
                        fontSize: 8, fontWeight: 700,
                        padding: "0 4px", height: 14, minWidth: 14, borderRadius: 7,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transform: "scale(0.74)", transformOrigin: "center",
                      }}>!</span>
                    )}
                  </span>

                  {active && (
                    <motion.span
                      initial={{ opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        position: "relative",
                        zIndex: 1,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 0.2,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}>
                      {label}
                    </motion.span>
                  )}

                  {showNudge && (
                    <span style={{
                      position: "absolute",
                      // tooltip du côté opposé au bord d'ancrage du dock
                      ...(isRight ? { right: "calc(100% + 10px)" } : { left: "calc(100% + 10px)" }),
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: BRAND, color: "white",
                      fontSize: 12, fontWeight: 700,
                      padding: "8px 12px",
                      borderRadius: 10,
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      boxShadow: "0 6px 20px rgba(34,197,94,.45)",
                      zIndex: 2,
                    }}>
                      ✨ Essaye ton premier devis
                      <span style={{
                        position: "absolute",
                        ...(isRight
                          ? { left: "100%", borderLeft: `6px solid ${BRAND}` }
                          : { right: "100%", borderRight: `6px solid ${BRAND}` }),
                        top: "50%",
                        marginTop: -6,
                        width: 0, height: 0,
                        borderTop: "6px solid transparent",
                        borderBottom: "6px solid transparent",
                      }}/>
                    </span>
                  )}
                </button>
              );
            })}
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
