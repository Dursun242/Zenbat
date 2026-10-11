import { useState, useEffect } from "react";
import { ZB } from "../lib/theme.js";

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
      display: "flex", alignItems: "center", gap: 12, padding: "10px 6px 10px 14px",
      background: ZB.paper2, borderRadius: 8, fontFamily: ZB.font,
    }}>
      <span aria-hidden="true" style={{ color: ZB.ink2, display: "inline-flex", flexShrink: 0 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3"/></svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: ZB.ink, fontSize: 15, fontWeight: 600 }}>
          Installe Zenbat sur ton {isIOS ? "iPhone" : "téléphone"}
        </div>
        <div style={{ color: ZB.ink2, fontSize: 13, lineHeight: 1.4 }}>
          Ouverture en un appui, même sans réseau sur le chantier.
        </div>
      </div>
      <button type="button" onClick={onOpenInstall}
        style={{ minHeight: 44, padding: "0 12px", background: "none", border: "none", color: ZB.accent, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
        Installer
      </button>
      <button type="button" onClick={dismiss} aria-label="Masquer pour l'instant"
        style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: "none", color: ZB.ink2, cursor: "pointer", flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
  );
}
