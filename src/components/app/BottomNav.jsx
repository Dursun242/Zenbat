// Barre de navigation du bas (mobile).
//
// 5 onglets pleine largeur sur fond sombre, l'onglet central "Agent IA" est
// un CTA cercle vert surélevé (effet floating action button).
// Indicateur actif : fine barre brand 2px en haut, glissée en spring via
// Framer Motion (layoutId partagé).
// Masquage auto à l'ouverture du clavier soft (translateY).
//
// — Hauteur exacte exposée via `NAV_RESERVED_CSS`, à utiliser dans le
//   `paddingBottom` du conteneur de contenu (App.jsx) pour qu'il n'y ait
//   AUCUN gap résiduel entre le contenu et la nav.
// — Réapparition après clavier gated sur le retour effectif du
//   visualViewport à sa hauteur max (sinon la nav flotterait en plein
//   milieu pendant l'animation de fermeture du clavier, car
//   `position:fixed; bottom:0` ancre au bas du viewport rétréci).
//
// Props :
//   items            — [{ id, label, icon }]
//   activeNav        — id de l'onglet actif
//   onSelect         — (id) => void
//   plan             — "free" | "pro" | "trial" ... (affichage pastille quota)
//   quotaReached     — bool, affiche pastille rouge sur le CTA si plan=free
//   firstDevisNudge  — bool, affiche bulle "Essaye ton premier devis"
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useKeyboardOpen } from "../../hooks/useKeyboardOpen.js";

// Hauteur de la nav HORS safe-area iOS (icône + label + paddings internes).
const NAV_CORE_HEIGHT = 64;

// Expression CSS à utiliser dans le `paddingBottom` du conteneur de contenu
// pour réserver EXACTEMENT la hauteur visible de la nav (= zéro gap).
// Pas de cap sur env(safe-area-inset-bottom) : la nav doit couvrir TOUTE
// la zone home indicator iOS, sinon un bandeau de fond html (#1A1612)
// reste visible entre la nav et le bord de l'écran.
export const NAV_RESERVED_CSS =
  `calc(${NAV_CORE_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;

const BRAND     = "#22c55e";
const BG        = "#1A1612";
const ACTIVE    = "#FFFFFF";
const INACTIVE  = "#8A8278";

// Détermine si la nav doit être visible : clavier fermé ET visualViewport
// revenu à sa hauteur max connue.
function useNavVisible() {
  const keyboardOpen = useKeyboardOpen();
  const [visible, setVisible] = useState(!keyboardOpen);
  const maxVvhRef = useRef(0);

  useEffect(() => {
    const getH = () => window.visualViewport?.height || window.innerHeight || 0;
    if (getH() > maxVvhRef.current) maxVvhRef.current = getH();

    if (keyboardOpen) {
      setVisible(false);
      return;
    }

    // Clavier fermé : on attend que le viewport soit revenu à sa hauteur max
    // avant de réafficher la nav, sinon `position:fixed; bottom:0` la ferait
    // apparaître au bas du viewport encore rétréci (= en plein milieu).
    const evaluate = () => {
      const vvh = getH();
      if (vvh > maxVvhRef.current) maxVvhRef.current = vvh;
      if (vvh >= maxVvhRef.current - 8) {
        setVisible(true);
        return true;
      }
      return false;
    };

    if (evaluate()) return;

    const onResize = () => evaluate();
    window.visualViewport?.addEventListener("resize", onResize);
    window.addEventListener("resize", onResize);
    // Failsafe : si aucun resize n'arrive dans les 600ms (clavier resté
    // ouvert puis fermé sans event), on affiche quand même.
    const failsafe = setTimeout(() => setVisible(true), 600);

    return () => {
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("resize", onResize);
      clearTimeout(failsafe);
    };
  }, [keyboardOpen]);

  return visible;
}

function StandardTab({ id, label, icon, active, onClick }) {
  const color = active ? ACTIVE : INACTIVE;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      style={{
        flex: 1,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "6px 4px",
        background: "transparent",
        border: "none",
        color,
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}>
      {active && (
        <motion.span
          layoutId="bottom-nav-active"
          style={{
            position: "absolute",
            top: 0,
            left: "20%", right: "20%",
            height: 2,
            background: BRAND,
            borderRadius: 2,
          }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transform: "scale(1.15)",
      }}>{icon}</span>
      <span style={{
        fontSize: 10.5,
        fontWeight: active ? 600 : 500,
        letterSpacing: 0.1,
        lineHeight: 1.2,
      }}>{label}</span>
    </button>
  );
}

function AgentCtaTab({ id, label, icon, active, onClick, plan, quotaReached, showNudge }) {
  return (
    <button
      onClick={onClick}
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
        padding: "0 4px 4px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}>
      <span
        className="bn-cta-circle"
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
          transition: "box-shadow .18s ease",
        }}>
        {showNudge && (
          <span style={{
            position: "absolute", inset: -6, borderRadius: "50%",
            pointerEvents: "none",
            animation: "bn-nudge-pulse 1.6s ease-out infinite",
          }}/>
        )}
        {icon}
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
        marginTop: -6,
        color: active ? ACTIVE : INACTIVE,
      }}>{label}</span>

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

export default function BottomNav({
  items,
  activeNav,
  onSelect,
  plan,
  quotaReached,
  firstDevisNudge = false,
}) {
  const visible = useNavVisible();

  return (
    <nav
      className="app-bottom-nav"
      aria-hidden={!visible}
      style={{
        position: "fixed",
        left: 0, right: 0, bottom: 0,
        boxSizing: "border-box",
        height: NAV_RESERVED_CSS,
        paddingBottom: `env(safe-area-inset-bottom, 0px)`,
        background: BG,
        borderTop: "1px solid rgba(255,255,255,.06)",
        display: "flex",
        zIndex: 50,
        transform: visible ? "translateY(0)" : "translateY(120%)",
        transition: "transform .22s ease",
        pointerEvents: visible ? "auto" : "none",
        willChange: "transform",
      }}>
      <style>{`
        @keyframes bn-nudge-bob   { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-5px); } }
        @keyframes bn-nudge-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 100% { box-shadow: 0 0 0 14px rgba(34,197,94,0); } }
        .app-bottom-nav button:active { opacity: .65; }
        .app-bottom-nav button:active .bn-cta-circle { transform: translateY(-12px) scale(1.16) !important; }
      `}</style>

      {items.map(({ id, label, icon }) => {
        const active = activeNav === id;
        const isAgent = id === "agent";
        if (isAgent) {
          return (
            <AgentCtaTab
              key={id}
              id={id} label={label} icon={icon}
              active={active}
              onClick={() => onSelect(id)}
              plan={plan}
              quotaReached={quotaReached}
              showNudge={firstDevisNudge}
            />
          );
        }
        return (
          <StandardTab
            key={id}
            id={id} label={label} icon={icon}
            active={active}
            onClick={() => onSelect(id)}
          />
        );
      })}
    </nav>
  );
}
