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
import { ZB } from "../../lib/theme.js";

const NAV_CORE_HEIGHT = 64;

// Zone home indicator iOS plafonnée à 34px (sa hauteur réelle sur tous les
// iPhone Face ID, 20px sur iPad). En PWA standalone, iOS renvoie parfois un
// env(safe-area-inset-bottom) gonflé (~93px, comme si la barre d'outils de
// Safari était encore là) : sans plafond, la nav faisait ~157px avec un grand
// vide sous les onglets. Historique : plafond posé (9532ccb) puis retiré
// (92a1ec4) parce qu'une bande claire apparaissait SOUS la nav dans l'autre
// état bogué d'iOS (viewport plus court que l'écran). Ce cas-là est couvert
// par le prolongement sombre sous la nav (cf. <span> « bn-underlay »).
export const SAFE_BOTTOM_CSS = "min(env(safe-area-inset-bottom, 0px), 34px)";
export const NAV_RESERVED_CSS =
  `calc(${NAV_CORE_HEIGHT}px + ${SAFE_BOTTOM_CSS})`;
// Écart à compenser quand iOS raccourcit la zone d'affichage (cf.
// lib/iosViewportGap.js, variable posée par App.jsx) : les éléments ancrés
// en bas redescendent d'autant pour toucher le vrai bas de l'écran.
export const IOS_GAP_CSS = "var(--ios-viewport-gap, 0px)";
// `bottom` d'un élément fixe posé juste au-dessus de la barre du bas.
export const ABOVE_NAV_CSS = `calc(${NAV_RESERVED_CSS} - ${IOS_GAP_CSS})`;

const BRAND     = ZB.accent;
const BG        = ZB.ink;
const ACTIVE    = "#FFFFFF";
const INACTIVE  = ZB.onInk2;

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
        top: -7,
        right: wide ? -16 : -12,
        minWidth: 18,
        height: 18,
        padding: wide ? "0 4px" : 0,
        borderRadius: 9,
        background: BRAND,
        color: "white",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: "18px",
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
      aria-label={badge > 0 ? `${label}, ${badge} en attente` : label}
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
        fontSize: 12,
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
          // Pas de halo : un anneau de la couleur de la barre détache le bouton.
          boxShadow: `0 0 0 3px ${BG}`,
          transition: "box-shadow .18s ease, transform .15s ease",
        }}>
        {icon}
        {plan === "free" && quotaReached && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            background: ZB.danger,
            width: 12, height: 12, borderRadius: "50%",
            border: `2px solid ${BG}`,
          }}/>
        )}
      </span>

      <span style={{
        fontSize: 12,
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
          fontSize: 13, fontWeight: 700,
          padding: "8px 12px",
          borderRadius: 10,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          animation: "bn-nudge-bob 1.8s ease-in-out infinite",
          zIndex: 2,
        }}>
          Essaie ton premier devis
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
        left: 0, right: 0, bottom: `calc(-1 * ${IOS_GAP_CSS})`,
        boxSizing: "border-box",
        height: NAV_RESERVED_CSS,
        paddingBottom: SAFE_BOTTOM_CSS,
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
        .app-bottom-nav button:active { opacity: .65; }
        .app-bottom-nav button:focus-visible { outline: 2px solid ${ZB.onInk}; outline-offset: -2px; }
        @media (prefers-reduced-motion: reduce) { .app-bottom-nav * { animation: none !important; } }
        .app-bottom-nav button:active .bn-cta-circle { transform: translateY(-12px) scale(1.16) !important; }
      `}</style>

      {/* Prolongement sombre sous la nav : invisible normalement (hors écran),
          il couvre la bande qu'iOS standalone laisse parfois sous une nav
          fixed bottom:0 quand le viewport est plus court que l'écran. */}
      <span
        aria-hidden="true"
        className="bn-underlay"
        style={{ position: "absolute", top: "100%", left: 0, right: 0, height: 160, background: BG, pointerEvents: "none" }}
      />

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
          transition: "left .28s cubic-bezier(.16, 1, .3, 1), width .28s ease",
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
