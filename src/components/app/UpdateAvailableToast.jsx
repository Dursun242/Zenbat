import { useEffect, useState } from "react";

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
      style={{
        position: "fixed",
        // Au-dessus du BottomNav full-width style YouTube (~64px de bar
        // + safe-area capped 20px). Marge supplémentaire pour le confort tactile.
        bottom: "calc(76px + min(env(safe-area-inset-bottom, 0px), 20px))",
        left: 12, right: 12,
        zIndex: 200,
        background: "#1A1612",
        color: "white",
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,.25)",
        maxWidth: 480,
        margin: "0 auto",
        animation: "fadeUp .2s ease both",
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>✨</span>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
        Nouvelle version disponible
      </div>
      <button
        onClick={applyUpdate}
        disabled={refreshing}
        style={{
          background: "#22c55e",
          color: "white",
          border: "none",
          borderRadius: 8,
          padding: "7px 12px",
          fontSize: 12,
          fontWeight: 700,
          cursor: refreshing ? "default" : "pointer",
          opacity: refreshing ? 0.6 : 1,
          fontFamily: "inherit",
          flexShrink: 0,
        }}>
        {refreshing ? "…" : "Actualiser"}
      </button>
      <button
        onClick={() => setShow(false)}
        aria-label="Plus tard"
        style={{
          background: "none",
          border: "none",
          color: "#9A8E82",
          cursor: "pointer",
          padding: 4,
          fontSize: 18,
          lineHeight: 1,
          flexShrink: 0,
        }}>
        ×
      </button>
    </div>
  );
}
