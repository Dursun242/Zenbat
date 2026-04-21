import { useState, useEffect } from "react";

const STORAGE_KEY = "zenbat_pwa_banner_dismissed_at";
const SNOOZE_DAYS = 3;

const isIOS     = /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
const isAndroid = /android/i.test(navigator.userAgent);
const isMobile  = isIOS || isAndroid;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  !!window.navigator.standalone;

export default function PWAInstallBanner({ onOpenInstall }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobile) return;
    if (isStandalone()) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const dismissedAt = parseInt(raw, 10);
        const elapsed = Date.now() - dismissedAt;
        if (elapsed < SNOOZE_DAYS * 86400000) return;
      }
    } catch {}
    setVisible(true);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg,#0f172a,#1e293b)",
      borderRadius: 14, padding: 14, marginBottom: 14,
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 4px 14px rgba(15,23,42,.15)",
      position: "relative", overflow: "hidden"
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 11,
        background: "linear-gradient(135deg,#22c55e,#16a34a)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
        boxShadow: "0 4px 12px rgba(34,197,94,.35)"
      }}>
        {isIOS ? "🍎" : "📲"}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "white", fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
          Installez Zenbat sur votre {isIOS ? "iPhone" : "téléphone"}
        </div>
        <div style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.4 }}>
          Accès hors-ligne, lancement en un tap
        </div>
      </div>

      <button onClick={onOpenInstall}
        style={{
          background: "#22c55e", color: "white", border: "none",
          borderRadius: 10, padding: "8px 12px",
          fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0
        }}>
        Installer
      </button>

      <button onClick={dismiss} aria-label="Fermer"
        style={{
          position: "absolute", top: 6, right: 8,
          background: "none", border: "none",
          color: "#64748b", fontSize: 16, cursor: "pointer",
          padding: "2px 6px", lineHeight: 1
        }}>
        ×
      </button>
    </div>
  );
}
