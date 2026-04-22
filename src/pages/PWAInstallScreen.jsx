import { useState } from "react";

const isIOS        = /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || !!window.navigator.standalone;
const isDesktop    = !isIOS && !(/android/i.test(navigator.userAgent)) && window.innerWidth >= 1024;

const ShareIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);

const PlusSquareIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="12" y1="8" x2="12" y2="16"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// Icône barre d'adresse / install
const InstallIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
    <polyline points="8 10 12 14 16 10"/>
  </svg>
);

const IOS_STEPS = [
  { icon: <ShareIcon />,      label: "Appuyez sur le bouton Partager",        sub: "en bas de Safari" },
  { icon: <PlusSquareIcon />, label: "Choisissez « Sur l'écran d'accueil »",  sub: "dans la liste qui s'ouvre" },
  { icon: <CheckIcon />,      label: "Appuyez sur « Ajouter »",               sub: "en haut à droite" },
];

const DESKTOP_STEPS = [
  { icon: <InstallIcon />,    label: "Cliquez sur l'icône d'installation",    sub: "dans la barre d'adresse (à droite)" },
  { icon: <PlusSquareIcon />, label: "Cliquez sur « Installer »",              sub: "dans la fenêtre qui s'ouvre" },
  { icon: <CheckIcon />,      label: "Zenbat s'ouvre comme une vraie appli",  sub: "dans sa propre fenêtre" },
];

export default function PWAInstallScreen({ deferredPrompt, onDone }) {
  const [installing, setInstalling] = useState(false);
  const [installed,  setInstalled]  = useState(false);

  if (isStandalone) { onDone(); return null; }

  const handleInstall = async () => {
    if (!deferredPrompt) { onDone(); return; }
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") { setInstalled(true); setTimeout(onDone, 1400); }
      else setInstalling(false);
    } catch { setInstalling(false); }
  };

  const title    = isDesktop ? "Installez Zenbat sur votre PC" : "Installez Zenbat sur votre téléphone";
  const subtitle = isDesktop
    ? "Accédez à vos devis depuis le bureau, sans passer par le navigateur."
    : "Accédez à vos devis en un tap, même sans connexion internet.";

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes popIn{0%{opacity:0;transform:scale(.92) translateY(8px)}100%{opacity:1;transform:scale(1) translateY(0)}}@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>

      <div style={{ width: "100%", maxWidth: 380, textAlign: "center", animation: "popIn .3s ease both" }}>

        <div style={{ marginBottom: 6, fontSize: 34, fontWeight: 800, letterSpacing: "-1px" }}>
          <span style={{ color: "#22c55e" }}>Zen</span><span style={{ color: "white" }}>bat</span>
        </div>

        <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg,#22c55e,#16a34a)", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 32px rgba(34,197,94,.35)", animation: "bounce 2.4s ease-in-out infinite" }}>
          <span style={{ fontSize: 36 }}>🏗️</span>
        </div>

        <h2 style={{ color: "white", fontSize: 22, fontWeight: 800, marginBottom: 10, lineHeight: 1.25 }}>
          {title}
        </h2>
        <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
          {subtitle}
        </p>

        <div style={{ background: "white", borderRadius: 24, padding: 22, textAlign: "left", boxShadow: "0 24px 48px rgba(0,0,0,.35)", marginBottom: 18 }}>

          {isIOS ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 16, textAlign: "center" }}>3 étapes dans Safari</div>
              {IOS_STEPS.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: i < 2 ? 16 : 0 }}>
                  <div style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 12, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e", position: "relative" }}>
                    {step.icon}
                    <span style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#22c55e", color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{step.label}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{step.sub}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 18, background: "#f8fafc", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>Fonctionne uniquement depuis <strong style={{ color: "#0f172a" }}>Safari</strong> sur iPhone</span>
              </div>
              <button onClick={onDone} style={{ width: "100%", marginTop: 16, background: "#0f172a", color: "white", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                C'est fait — Continuer →
              </button>
            </>
          ) : isDesktop && !deferredPrompt ? (
            // Desktop sans prompt automatique → guide manuel
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 16, textAlign: "center" }}>3 clics dans Chrome ou Edge</div>
              {DESKTOP_STEPS.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: i < 2 ? 16 : 0 }}>
                  <div style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 12, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e", position: "relative" }}>
                    {step.icon}
                    <span style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#22c55e", color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{step.label}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{step.sub}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 18, background: "#f8fafc", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>💡</span>
                <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>Fonctionne avec <strong style={{ color: "#0f172a" }}>Chrome</strong> et <strong style={{ color: "#0f172a" }}>Edge</strong></span>
              </div>
              <button onClick={onDone} style={{ width: "100%", marginTop: 16, background: "#0f172a", color: "white", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                C'est fait — Continuer →
              </button>
            </>
          ) : (
            // Android ou Desktop avec prompt automatique
            <>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, textAlign: "center", lineHeight: 1.6 }}>
                {isDesktop
                  ? "Installez Zenbat en un clic pour l'utiliser comme une vraie application."
                  : "Ajoutez Zenbat à votre écran d'accueil pour y accéder instantanément."}
              </div>

              {installed ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 0" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e" }}>
                    <CheckIcon />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#15803d" }}>Installée avec succès !</span>
                </div>
              ) : (
                <button onClick={handleInstall} disabled={installing}
                  style={{ width: "100%", background: installing ? "#d1fae5" : "#22c55e", color: "white", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: installing ? "wait" : "pointer", transition: "background .2s" }}>
                  {installing ? "Installation…" : isDesktop ? "🖥️ Installer sur le bureau" : "📲 Installer l'application"}
                </button>
              )}

              {!deferredPrompt && !installed && (
                <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
                  Votre navigateur ne supporte pas l'installation automatique.<br/>
                  Utilisez Chrome ou Edge pour installer.
                </p>
              )}
            </>
          )}
        </div>

        <button onClick={onDone} style={{ background: "none", border: "none", color: "#475569", fontSize: 12, cursor: "pointer", padding: 8 }}>
          Pas maintenant
        </button>
      </div>
    </div>
  );
}
