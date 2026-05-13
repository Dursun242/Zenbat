// Floating bottom tab bar style iOS frosted glass.
//
// Position fixed, marges latérales + bas pour effet flottant.
// Backdrop-filter blur 20px + saturate pour le rendu "vibrant glass".
// Indicateur actif animé via Framer Motion layoutId — la pastille de
// fond se déplace en spring entre les onglets.
//
// `firstDevisNudge` : tooltip "Essaye ton premier devis" au-dessus de
// l'onglet "agent" pour les nouveaux inscrits (0 devis). Auto-masqué
// dès qu'on est sur l'onglet agent ou qu'un devis existe.
import { motion } from "framer-motion";

const BRAND = "#22c55e"; // DEFAULT_BRAND.color

export default function BottomNav({ items, activeNav, onSelect, plan, quotaReached, firstDevisNudge = false }) {
  return (
    <nav
      className="app-bottom-nav"
      style={{
        position: "fixed",
        // mx-4 → 16px gauche/droite, mb-6 → 24px du bas + safe-area iOS
        // Cap à 34px pour ne pas exploser le layout si iOS renvoie une
        // valeur safe-area gonflée (cas observé sur certains états PWA).
        left: 16,
        right: 16,
        bottom: "calc(24px + min(env(safe-area-inset-bottom, 0px), 34px))",
        borderRadius: 20, // rounded-2xl ≈ 16, on monte à 20 pour un rendu plus iOS
        // Frosted glass : fond clair semi-transparent + blur saturé
        background: "rgba(255, 255, 255, 0.55)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.6)",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.06)",
        display: "flex",
        padding: 6,
        zIndex: 50,
      }}>
      <style>{`
        @keyframes bn-nudge-bob   { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-5px); } }
        @keyframes bn-nudge-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 100% { box-shadow: 0 0 0 14px rgba(34,197,94,0); } }
        .app-bottom-nav button { -webkit-tap-highlight-color: transparent; transition: color .18s ease; }
        .app-bottom-nav button:active { opacity: .65; }
        /* Mode sombre système : noir 20% + bord blanc atténué */
        @media (prefers-color-scheme: dark) {
          .app-bottom-nav {
            background: rgba(20, 16, 12, 0.55) !important;
            border-color: rgba(255, 255, 255, 0.12) !important;
          }
        }
      `}</style>

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
              flex: 1,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              padding: "8px 4px",
              minHeight: 52,
              background: "transparent",
              border: "none",
              color: active ? BRAND : "#6B6358",
              cursor: "pointer",
            }}>
            {/* Indicateur actif animé — pastille de fond qui glisse entre onglets */}
            {active && (
              <motion.span
                layoutId="bottom-nav-active"
                style={{
                  position: "absolute",
                  inset: 4,
                  background: "rgba(34, 197, 94, 0.14)",
                  borderRadius: 14,
                  zIndex: 0,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}

            <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", transform: "scale(1.2)" }}>
              {showNudge && (
                <span style={{
                  position: "absolute", inset: -6, borderRadius: "50%",
                  pointerEvents: "none",
                  animation: "bn-nudge-pulse 1.6s ease-out infinite",
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

            {/* Label visible uniquement quand actif */}
            {active && (
              <motion.span
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                style={{ position: "relative", zIndex: 1, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.1 }}>
                {label}
              </motion.span>
            )}

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
