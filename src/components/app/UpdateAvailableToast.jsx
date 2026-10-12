import { useEffect, useState } from "react";
import { ZB } from "../../lib/theme.js";

// Toast non bloquant affiché quand une nouvelle version du Service Worker
// est prête à être activée (event 'zenbat:sw-needs-refresh' émis par
// main.jsx).
//
// L'utilisateur clique "Actualiser" → on appelle updateSW(true) qui
// déclenche skipWaiting côté SW puis un reload propre via vite-plugin-pwa.
// Il peut aussi dismiss et continuer à utiliser l'app — la MAJ sera
// appliquée au prochain démarrage naturel.
//
// On reflète aussi l'état si le toast est monté APRÈS l'event (race entre
// le timing du SW et le mount du composant) via window.__zenbatSWUpdateReady__.
export default function UpdateAvailableToast() {
  const [show, setShow] = useState(() => !!window.__zenbatSWUpdateReady__);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const onNeedRefresh = () => setShow(true);
    window.addEventListener("zenbat:sw-needs-refresh", onNeedRefresh);
    return () => window.removeEventListener("zenbat:sw-needs-refresh", onNeedRefresh);
  }, []);

  if (!show) return null;

  const applyUpdate = () => {
    setRefreshing(true);
    const fn = window.__zenbatSWUpdate__;
    if (typeof fn === "function") {
      fn(true); // skipWaiting + reload géré par vite-plugin-pwa
    } else {
      // Fallback dur si la référence est perdue (HMR dev, etc.).
      window.location.reload();
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="zb-update"
      style={{
        position: "fixed",
        // Au-dessus du BottomNav full-width style YouTube (~64px de bar
        // + safe-area capped 20px). Marge supplémentaire pour le confort tactile.
        bottom: "calc(76px + min(env(safe-area-inset-bottom, 0px), 20px) - var(--ios-viewport-gap, 0px))",
        left: 12, right: 12,
        zIndex: 200,
        background: ZB.ink,
        color: ZB.onInk,
        fontFamily: ZB.font,
        borderRadius: 10,
        padding: "6px 4px 6px 16px",
        display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 10px 30px rgba(26,22,18,.16)",
        maxWidth: 480,
        margin: "0 auto",
        animation: "fadeUp .2s ease both",
      }}
    >
      <style>{`.zb-update button:focus-visible { outline: 2px solid ${ZB.onInk}; outline-offset: 2px; }`}</style>
      <div style={{ flex: 1, fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>
        Nouvelle version disponible
      </div>
      <button
        type="button"
        onClick={applyUpdate}
        disabled={refreshing}
        style={{
          background: ZB.accent,
          color: ZB.sheet,
          border: "none",
          borderRadius: 10,
          minHeight: 44,
          padding: "0 14px",
          fontSize: 15,
          fontWeight: 700,
          cursor: refreshing ? "default" : "pointer",
          opacity: refreshing ? 0.6 : 1,
          fontFamily: "inherit",
          flexShrink: 0,
        }}>
        {refreshing ? "…" : "Actualiser"}
      </button>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="Plus tard"
        style={{
          width: 44, height: 44,
          display: "grid", placeItems: "center",
          background: "none",
          border: "none",
          color: ZB.onInk2,
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
  </div>
);
}
