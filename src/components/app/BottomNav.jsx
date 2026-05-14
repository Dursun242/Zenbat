// Barre de navigation du bas (mobile).
//
// 5 onglets pleine largeur sur fond sombre, l'onglet central "Agent IA" est
// un CTA cercle vert surélevé (effet floating action button).
//
// Indicateur actif : barre brand 2px UNIQUE en haut, qui slide d'un onglet
// à l'autre via transition CSS (left + width). Plus de Framer Motion ici
// → moins de surface à bugs, pas de race condition sur layoutId.
//
// Badges : chaque onglet peut afficher une pastille rouge avec un compteur
// (ex. "3" devis en attente de signature). Passé via prop `badges`.
//
// Long-press CTA : appui long ≥ 450ms sur le bouton Agent IA déclenche
// `onAgentLongPress()` (au lieu de la navigation normale) + vibration
// haptique courte si supportée. Permet à l'app de montrer un menu
// d'actions rapides (ex. nouveau devis vocal, etc.).
//
// Masquage auto à l'ouverture du clavier soft (translateY).
//
// Hauteur exacte exposée via `NAV_RESERVED_CSS`.
//
// Props :
//   items            — [{ id, label, icon }]
//   activeNav        — id de l'onglet actif
//   onSelect         — (id) => void
//   plan             — "free" | "pro" | "trial" ... (affichage pastille quota)
//   quotaReached     — bool, affiche pastille rouge sur le CTA si plan=free
//   firstDevisNudge  — bool, affiche bulle "Essaye ton premier devis"
//   badges           — { devis?: number, factures?: number, clients?: number, ... }
//   onAgentLongPress — () => void, callback appui long sur le CTA central
import { useEffect, useRef, useState } from "react";
import { useKeyboardOpen } from "../../hooks/useKeyboardOpen.js";

const NAV_CORE_HEIGHT = 64;

// Pas de cap sur env(safe-area-inset-bottom) : la nav doit couvrir TOUTE
// la zone home indicator iOS.
export const NAV_RESERVED_CSS =
  `calc(${NAV_CORE_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;

const BRAND     = "#22c55e";
const BG        = "#1A1612";
const ACTIVE    = "#FFFFFF";
const INACTIVE  = "#8A8278";

// Délai à partir duquel un touch sur le CTA est considéré comme long-press.
// 450ms = standard iOS / Material.
const LONG_PRESS_MS = 450;

// Hook : nav visible seulement quand le clavier est fermé ET que le
// visualViewport est revenu à sa hauteur max connue.
function useNavVisible() {
  const keyboardOpen = useKeyboardOpen();
  const [visible, setVisible] = useState(!keyboardOpen);
  const maxVvhRef = useRef(0);

  useEffect(() => {
    const getH = () => window.visualViewport?.height || window.innerHeight || 0;
    if (getH() > maxVvhRef.current) maxVvhRef.current = getH();

    if (keyboardOpen) { setVisible(false); return; }

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
    const failsafe = setTimeout(() => setVisible(true), 600);

    return () => {
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("resize", onResize);
      clearTimeout(failsafe);
    };
  }, [keyboardOpen]);

  return visible;
}

// Pastille rouge avec compteur. count > 9 → "9+". count ≤ 0 / falsy → rien.
function Badge({ count }) {
  if (!count || count <= 0) return null;
  const display = count > 9 ? "9+" : String(count);
  const wide = count > 9;
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: -3,
        right: wide ? -10 : -6,
        minWidth: 16,
        height: 16,
        padding: wide ? "0 4px" : 0,
        borderRadius: 8,
        background: "#ef4444",
        color: "white",
        fontSize: 9,
        fontWeight: 700,
        lineHeight: "16px",
        textAlign: "center",
        border: `2px solid ${BG}`,
        boxSizing: "content-box",
        pointerEvents: "none",
      }}>
      {display}
    </span>
  );
}

function StandardTab({ label, icon, active, onClick, badge }) {
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
        transition: "color .15s ease",
      }}>
      <span style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transform: "scale(1.15)",
      }}>
        {icon}
        <Badge count={badge}/>
      </span>
      <span style={{
        fontSize: 10.5,
        fontWeight: active ? 600 : 500,
        letterSpacing: 0.1,
        lineHeight: 1.2,
      }}>{label}</span>
    </button>
  );
}

function AgentCtaTab({ label, icon, active, onClick, plan, quotaReached, showNudge, onLongPress }) {
  const timerRef = useRef(null);
  const longPressedRef = useRef(false);

  const cancelTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onPointerDown = () => {
    longPressedRef.current = false;
    cancelTimer();
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      if (typeof navigator.vibrate === "function") {
        try { navigator.vibrate(20); } catch { /* ignore */ }
      }
      onLongPress?.();
    }, LONG_PRESS_MS);
  };

  const onPointerCancel = () => {
    cancelTimer();
    longPressedRef.current = false;
  };

  const handleClick = (e) => {
    if (longPressedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressedRef.current = false;
      return;
    }
    onClick();
  };

  useEffect(() => () => cancelTimer(), []);

  return (
    <button
      onClick={handleClick}
      onPointerDown={onPointerDown}
      onPointerUp={cancelTimer}
      onPointerLeave={onPointerCancel}
      onPointerCancel={onPointerCancel}
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
        WebkitTouchCallout: "none",
        userSelect: "none",
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
          transition: "box-shadow .18s ease, transform .15s ease",
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
  badges = {},
  onAgentLongPress,
}) {
  const visible = useNavVisible();
  const activeIndex = Math.max(0, items.findIndex(it => it.id === activeNav));
  // Indicateur centré dans l'onglet actif, 60 % de sa largeur.
  const tabPct = 100 / items.length;
  const indicatorWidthPct = tabPct * 0.6;
  const indicatorLeftPct  = activeIndex * tabPct + (tabPct - indicatorWidthPct) / 2;

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

      {/* Indicateur actif unique — slide entre les onglets via transition CSS */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          height: 2,
          background: BRAND,
          borderRadius: 2,
          width: `${indicatorWidthPct}%`,
          left: `${indicatorLeftPct}%`,
          transition: "left .28s cubic-bezier(.34, 1.56, .64, 1), width .28s ease",
          // Onglet central (Agent IA) : on cache l'indicateur, le CTA cercle
          // est déjà très visible et a son propre highlight.
          opacity: items[activeIndex]?.id === "agent" ? 0 : 1,
        }}
      />

      {items.map(({ id, label, icon }) => {
        const active = activeNav === id;
        if (id === "agent") {
          return (
            <AgentCtaTab
              key={id}
              label={label} icon={icon}
              active={active}
              onClick={() => onSelect(id)}
              plan={plan}
              quotaReached={quotaReached}
              showNudge={firstDevisNudge}
              onLongPress={onAgentLongPress}
            />
          );
        }
        return (
          <StandardTab
            key={id}
            label={label} icon={icon}
            active={active}
            onClick={() => onSelect(id)}
            badge={badges[id]}
          />
        );
      })}
    </nav>
  );
}
