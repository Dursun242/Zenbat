import { useState } from "react";
import { ZB, NUM } from "../lib/theme.js";
import { btnPrimary } from "../components/ui/Register.jsx";

const isIOS        = /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || !!window.navigator.standalone;
const isDesktop    = !isIOS && !(/android/i.test(navigator.userAgent)) && window.innerWidth >= 1024;

const ShareIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);

const PlusSquareIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="12" y1="8" x2="12" y2="16"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// Icône barre d'adresse / install
const InstallIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
    <polyline points="8 10 12 14 16 10"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <line x1="12" y1="11" x2="12" y2="16"/>
    <line x1="12" y1="8" x2="12" y2="8"/>
  </svg>
);

const IOS_STEPS = [
  { icon: <ShareIcon />,      label: "Appuie sur le bouton Partager",        sub: "en bas de Safari" },
  { icon: <PlusSquareIcon />, label: "Choisis « Sur l'écran d'accueil »",  sub: "dans la liste qui s'ouvre" },
  { icon: <CheckIcon />,      label: "Appuie sur « Ajouter »",               sub: "en haut à droite" },
];

const DESKTOP_STEPS = [
  { icon: <InstallIcon />,    label: "Clique sur l'icône d'installation",    sub: "dans la barre d'adresse (à droite)" },
  { icon: <PlusSquareIcon />, label: "Clique sur « Installer »",              sub: "dans la fenêtre qui s'ouvre" },
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

  const title    = isDesktop ? "Installe Zenbat sur ton PC" : "Installe Zenbat sur ton téléphone";
  const subtitle = isDesktop
    ? "Accède à tes devis depuis le bureau, sans passer par le navigateur."
    : "Accède à tes devis en un tap, même sans connexion internet.";

  const continueBtn = (
    <button onClick={onDone} className="zb-pwa-cta" style={{ ...btnPrimary, width: "100%", minHeight: 52, fontSize: 16, marginTop: 16 }}>
      C'est fait — Continuer
    </button>
  );

  return (
    <div className="zb-pwa" style={{ minHeight: "100vh", background: ZB.paper, color: ZB.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: ZB.font }}>
      <style>{`.zb-pwa button:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; } @media (hover: hover) { .zb-pwa .zb-pwa-cta:not(:disabled):hover { background: var(--zb-accent-hover) !important; } }`}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>

        <div style={{ marginBottom: 20, fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>
          <span style={{ color: ZB.accent }}>Zen</span><span style={{ color: ZB.ink }}>bat</span>
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 700, lineHeight: 1.25 }}>
          {title}
        </h1>
        <p style={{ margin: "0 0 20px", color: ZB.ink2, fontSize: 15, lineHeight: 1.45 }}>
          {subtitle}
        </p>

        <div style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "6px 16px 16px", marginBottom: 12 }}>

          {isIOS ? (
            <>
              <StepList title="3 étapes dans Safari" steps={IOS_STEPS} />
              <Note>Fonctionne uniquement depuis <strong style={{ color: ZB.ink }}>Safari</strong> sur iPhone</Note>
              {continueBtn}
            </>
          ) : isDesktop && !deferredPrompt ? (
            // Desktop sans prompt automatique → guide manuel
            <>
              <StepList title="3 clics dans Chrome ou Edge" steps={DESKTOP_STEPS} />
              <Note>Fonctionne avec <strong style={{ color: ZB.ink }}>Chrome</strong> et <strong style={{ color: ZB.ink }}>Edge</strong></Note>
              {continueBtn}
            </>
          ) : (
            // Android ou Desktop avec prompt automatique
            <>
              <p style={{ margin: "10px 0 16px", fontSize: 15, color: ZB.ink2, lineHeight: 1.45 }}>
                {isDesktop
                  ? "Installe Zenbat en un clic pour l'utiliser comme une vraie application."
                  : "Ajoute Zenbat à ton écran d'accueil pour y accéder instantanément."}
              </p>

              {installed ? (
                <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 52, color: ZB.stamp }}>
                  <CheckIcon />
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Installée avec succès !</span>
                </div>
              ) : (
                <button onClick={handleInstall} disabled={installing} className="zb-pwa-cta"
                  style={{ ...btnPrimary, width: "100%", minHeight: 52, fontSize: 16, opacity: installing ? 0.7 : 1, cursor: installing ? "wait" : "pointer" }}>
                  {installing ? "Installation…" : isDesktop ? "Installer sur le bureau" : "Installer l'application"}
                </button>
              )}

              {!deferredPrompt && !installed && (
                <p style={{ fontSize: 13, color: ZB.ink2, textAlign: "center", margin: "10px 0 0", lineHeight: 1.5 }}>
                  Ton navigateur ne supporte pas l'installation automatique.<br/>
                  Utilise Chrome ou Edge pour installer.
                </p>
              )}
            </>
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <button onClick={onDone} style={{ minHeight: 44, background: "none", border: "none", color: ZB.ink2, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer", padding: "0 12px" }}>
            Pas maintenant
          </button>
        </div>
      </div>
    </div>
  );
}

// Étapes numérotées, tracées comme les lignes d'un bordereau.
function StepList({ title, steps }) {
  return (
    <>
      <h2 style={{ margin: 0, padding: "10px 0", fontSize: 16, fontWeight: 700, borderBottom: `2px solid ${ZB.ink}` }}>{title}</h2>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {steps.map((step, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 60, padding: "10px 0", borderBottom: i < steps.length - 1 ? `1px solid ${ZB.ruleSoft}` : "none" }}>
            <span style={{ width: 20, flexShrink: 0, fontSize: 15, fontWeight: 700, color: ZB.ink, ...NUM }}>{i + 1}.</span>
            <span style={{ flexShrink: 0, display: "grid", color: ZB.ink2 }}>{step.icon}</span>
            <span>
              <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: ZB.ink }}>{step.label}</span>
              <span style={{ display: "block", fontSize: 13, color: ZB.ink2, marginTop: 2 }}>{step.sub}</span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function Note({ children }) {
  return (
    <div style={{ marginTop: 8, background: ZB.paper2, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, color: ZB.ink2 }}>
      <span style={{ display: "grid", flexShrink: 0 }}><InfoIcon /></span>
      <span style={{ fontSize: 14, lineHeight: 1.45 }}>{children}</span>
    </div>
  );
}
