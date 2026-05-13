// Bottom tab bar style YouTube mobile.
//
// Barre ancrée pleine largeur en bas de l'écran (pas flottante).
// Fond sombre solide, fine bordure haute, padding-bottom safe-area iOS.
// 5 onglets, labels toujours visibles sous l'icône.
//
// État actif : icône + label en blanc (avec léger gras).
// État inactif : gris atténué (#8A8278).
//
// Indicateur actif : fine barre brand en haut de l'onglet sélectionné
// (2px, animée en spring via Framer Motion layoutId).
//
// `firstDevisNudge` : tooltip "Essaye ton premier devis" au-dessus de
// l'onglet "agent" pour les nouveaux inscrits (0 devis). Auto-masqué
// dès qu'on est sur l'onglet agent ou qu'un devis existe.
//
// `quotaReached` + plan free : pastille rouge en haut à droite de l'icône agent.
import { motion } from "framer-motion";

const BRAND     = "#22c55e";
const BG        = "#1A1612";
const ACTIVE    = "#FFFFFF";
const INACTIVE  = "#8A8278";

export default function BottomNav({ items, activeNav, onSelect, plan, quotaReached, firstDevisNudge = false }) {
  return (
    <nav
      className="app-bottom-nav"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        background: BG,
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        paddingTop: 6,
        // Safe-area iOS cappée à 20px pour éviter les valeurs gonflées en PWA.
        paddingBottom: "calc(4px + min(env(safe-area-inset-bottom, 0px), 20px))",
        zIndex: 50,
      }}>
      <style>{`
        @keyframes bn-nudge-bob   { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-5px); } }
        @keyframes bn-nudge-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 100% { box-shadow: 0 0 0 14px rgba(34,197,94,0); } }
        .app-bottom-nav button { -webkit-tap-highlight-color: transparent; transition: color .18s ease; }
        .app-bottom-nav button:active { opacity: .65; }
      `}</style>

      {items.map(({ id, label, icon }) => {
        const active    = activeNav === id;
        const isAgent   = id === "agent";
        const showNudge = isAgent && firstDevisNudge;
        const color     = active ? ACTIVE : INACTIVE;

        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 4,
              padding: "8px 4px 4px",
              minHeight: 56,
              background: "transparent",
              border: "none",
              color,
              cursor: "pointer",
            }}>
            {/* Indicateur actif : fine barre brand en haut de l'onglet, glisse en spring */}
            {active && (
              <motion.span
                layoutId="bottom-nav-active"
                style={{
                  position: "absolute",
                  top: 0,
                  left: "20%",
                  right: "20%",
                  height: 2,
                  background: BRAND,
                  borderRadius: 2,
                  zIndex: 1,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}

            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", transform: "scale(1.15)" }}>
              {showNudge && (
                <span style={{
                  position: "absolute", inset: -6, borderRadius: "50%",
                  pointerEvents: "none",
                  animation: "bn-nudge-pulse 1.6s ease-out infinite",
                }}/>
              )}
              {icon}
              {/* Pastille quota (agent) */}
              {isAgent && plan === "free" && quotaReached && (
                <span style={{
                  position: "absolute", top: -3, right: -8,
                  background: "#ef4444",
                  width: 9, height: 9, borderRadius: "50%",
                  border: `1.5px solid ${BG}`,
                }}/>
              )}
            </span>

            <span style={{
              fontSize: 10.5,
              fontWeight: active ? 600 : 500,
              letterSpacing: 0.1,
              lineHeight: 1.2,
            }}>
              {label}
            </span>

            {showNudge && (
              <span style={{
                position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
                transform: "translateX(-50%)",
                background: BRAND, color: "white",
                fontSize: 12, fontWeight: 700,
                padding: "8px 12px",
                borderRadius: 10,
                whiteSpace: "nowrap",
                pointerEvents: "none",
                boxShadow: "0 6px 20px rgba(34,197,94,.45)",
                animation: "bn-nudge-bob 1.8s ease-in-out infinite",
                zIndex: 2,
              }}>
                ✨ Essaye ton premier devis
                <span style={{
                  position: "absolute", top: "100%", left: "50%",
                  marginLeft: -6, width: 0, height: 0,
                  borderTop: `6px solid ${BRAND}`,
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
