// Dock vertical flottant à droite, repliable.
//
// Format : pilule verticale ancrée à droite, centrée verticalement.
// 5 onglets empilés. Bouton chevron en haut pour replier le dock
// (slide à droite, seul un handle reste visible). Tap sur le handle
// pour redéployer. État persisté en localStorage.
//
// L'indicateur actif glisse en spring via Framer Motion layoutId.
//
// Le composant garde son nom historique (BottomNav.jsx) pour ne pas
// casser les imports, mais il s'agit maintenant d'un side dock.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BRAND = "#22c55e"; // DEFAULT_BRAND.color
const STORAGE_KEY = "zenbat:sideDock:collapsed";

export default function BottomNav({ items, activeNav, onSelect, plan, quotaReached, firstDevisNudge = false }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  return (
    <>
      <style>{`
        @keyframes sd-nudge-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 100% { box-shadow: 0 0 0 12px rgba(34,197,94,0); } }
        .app-bottom-nav button { -webkit-tap-highlight-color: transparent; }
        .app-bottom-nav button:active { opacity: .65; }
      `}</style>

      <AnimatePresence initial={false} mode="wait">
        {collapsed ? (
          // Handle replié — fine pastille verticale collée à droite
          <motion.button
            key="handle"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={() => setCollapsed(false)}
            aria-label="Déployer le menu"
            className="app-bottom-nav"
            style={{
              position: "fixed",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              width: 18,
              height: 64,
              borderRadius: "12px 0 0 12px",
              background: "#1A1612",
              border: "1px solid rgba(255,255,255,.08)",
              borderRight: "none",
              boxShadow: "-4px 6px 18px rgba(0,0,0,.18)",
              color: "#E8E2D8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 50,
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        ) : (
          <motion.nav
            key="dock"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="app-bottom-nav"
            style={{
              position: "fixed",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              width: 60,
              borderRadius: 22,
              background: "#1A1612",
              border: "1px solid rgba(255,255,255,.08)",
              boxShadow: "0 12px 32px rgba(0,0,0,.22), 0 2px 6px rgba(0,0,0,.12)",
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              zIndex: 50,
            }}>
            {/* Bouton repli en haut du dock */}
            <button
              onClick={() => setCollapsed(true)}
              aria-label="Replier le menu"
              style={{
                background: "transparent",
                border: "none",
                color: "#6B6358",
                padding: "4px 0",
                marginBottom: 2,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
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
                    color: active ? BRAND : "#9A8E82",
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
                        background: "rgba(34, 197, 94, 0.14)",
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
                      right: "calc(100% + 10px)",
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
                        left: "100%",
                        top: "50%",
                        marginTop: -6,
                        width: 0, height: 0,
                        borderLeft: `6px solid ${BRAND}`,
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
