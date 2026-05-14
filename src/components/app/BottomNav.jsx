// Bottom tab bar style YouTube mobile, avec onglet central CTA.
//
// Barre ancrée pleine largeur en bas de l'écran (pas flottante).
// Fond sombre solide, fine bordure haute, padding-bottom safe-area iOS.
// 5 onglets, labels toujours visibles sous l'icône.
//
// Onglet central "Agent IA" : traitement distinct CTA.
//   - Cercle brand 46px surélevé (translateY -8px), icône blanche.
//   - Drop shadow brand pour effet "floating action button".
//   - Ring brand léger quand actif.
//   - Le 2px top-bar d'indicateur actif standard est masqué sur ce tab.
//
// Autres onglets :
//   - État actif : icône + label en blanc + fine barre brand 2px en haut
//     (animée en spring via Framer Motion layoutId).
//   - État inactif : gris atténué (#8A8278).
//
// `firstDevisNudge` : tooltip "Essaye ton premier devis" au-dessus de
// l'onglet "agent" pour les nouveaux inscrits (0 devis). Auto-masqué
// dès qu'on est sur l'onglet agent ou qu'un devis existe.
//
// `quotaReached` + plan free : pastille rouge en haut à droite du cercle agent.
import { motion } from "framer-motion";
import { useKeyboardOpen } from "../../hooks/useKeyboardOpen.js";

const BRAND     = "#22c55e";
const BG        = "#1A1612";
const ACTIVE    = "#FFFFFF";
const INACTIVE  = "#8A8278";

export default function BottomNav({ items, activeNav, onSelect, plan, quotaReached, firstDevisNudge = false }) {
  // Masque la nav quand un input texte / textarea est focus (= clavier
  // soft ouvert sur mobile). Cf. src/hooks/useKeyboardOpen.js.
  const keyboardOpen = useKeyboardOpen();

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
        transform: keyboardOpen ? "translateY(110%)" : "translateY(0)",
        transition: "transform .22s ease",
        pointerEvents: keyboardOpen ? "none" : "auto",
      }}>
      <style>{`
        @keyframes bn-nudge-bob   { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-5px); } }
        @keyframes bn-nudge-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 100% { box-shadow: 0 0 0 14px rgba(34,197,94,0); } }
        .app-bottom-nav button { -webkit-tap-highlight-color: transparent; transition: color .18s ease; }
        .app-bottom-nav button:active { opacity: .65; }
        .app-bottom-nav .cta-circle { transition: transform .18s ease, box-shadow .18s ease; }
        .app-bottom-nav button:active .cta-circle { transform: translateY(-6px) scale(1.05); }
      `}</style>

      {items.map(({ id, label, icon }) => {
        const active    = activeNav === id;
        const isAgent   = id === "agent";
        const showNudge = isAgent && firstDevisNudge;

        // ─── Onglet CTA central (Agent IA) ─────────────────────────────────
        if (isAgent) {
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
                gap: 2,
                padding: "0 4px 4px",
                minHeight: 56,
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}>
              {/* Cercle CTA brand surélevé */}
              <span
                className="cta-circle"
                style={{
                  position: "relative",
                  width: 46, height: 46,
                  borderRadius: "50%",
                  background: BRAND,
                  color: "#FFFFFF",
                  display: "inline-flex",
                  alignItems: "center", justifyContent: "center",
                  transform: "translateY(-8px) scale(1.1)",
                  boxShadow: active
                    ? "0 8px 22px rgba(34,197,94,.55), 0 0 0 3px rgba(34,197,94,.28)"
                    : "0 4px 14px rgba(34,197,94,.4)",
                }}>
                {showNudge && (
                  <span style={{
                    position: "absolute", inset: -6, borderRadius: "50%",
                    pointerEvents: "none",
                    animation: "bn-nudge-pulse 1.6s ease-out infinite",
                  }}/>
                )}
                {icon}
                {/* Pastille quota agent */}
                {plan === "free" && quotaReached && (
                  <span style={{
                    position: "absolute", top: -2, right: -2,
                    background: "#ef4444",
                    width: 11, height: 11, borderRadius: "50%",
                    border: `2px solid ${BG}`,
                  }}/>
                )}
              </span>

              <span style={{
                fontSize: 10.5,
                fontWeight: active ? 700 : 600,
                letterSpacing: 0.1,
                lineHeight: 1.2,
                marginTop: -6,  // compense le translateY du cercle
                color: active ? ACTIVE : INACTIVE,
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
        }

        // ─── Onglets standards ─────────────────────────────────────────────
        const color = active ? ACTIVE : INACTIVE;
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
            {/* Indicateur actif : fine barre brand en haut, glisse en spring */}
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
              {icon}
            </span>

            <span style={{
              fontSize: 10.5,
              fontWeight: active ? 600 : 500,
              letterSpacing: 0.1,
              lineHeight: 1.2,
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
