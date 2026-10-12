import { useEffect } from "react";
import { useModalGuard } from "../../hooks/useModalGuard.js";
import { ZB, NUM } from "../../lib/theme.js";
import { btnPrimary, btnSecondary } from "../ui/Register.jsx";

const CSS = `
  @keyframes zb-stamp-in { 0% { opacity: 0; transform: rotate(-3deg) scale(1.6); } 60% { opacity: 1; transform: rotate(-3deg) scale(.96); } 100% { opacity: 1; transform: rotate(-3deg) scale(1); } }
  .zb-celebrate-stamp { animation: zb-stamp-in .38s ease-out .08s both; }
  .zb-celebrate button:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .zb-celebrate-stamp { animation: none; } }
`;

// Modale affichée à la génération du TOUT PREMIER devis du compte.
// One-shot : le flag est stocké dans localStorage pour ne jamais la remontrer.
// `fontFamily` et `ac` sont conservés pour la compatibilité des appels : la
// modale suit le système « Bordereau » (ZB), pas la couleur de l'artisan.
export default function CelebrateModal({ seconds, fontFamily, ac, onClose, onSave }) {
  useModalGuard(true, onClose);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(26,22,18,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 200, fontFamily: ZB.font, color: ZB.ink, animation: "fadeUp .2s ease both" }}>
      <style>{CSS}</style>
      <div role="dialog" aria-modal="true" aria-labelledby="celebrate-title" className="zb-celebrate" onClick={e => e.stopPropagation()}
        style={{ background: ZB.paper, border: `1px solid ${ZB.rule}`, borderRadius: 10, maxWidth: 380, width: "100%", padding: "28px 20px 20px", textAlign: "center", boxShadow: "0 10px 30px rgba(26,22,18,.16)" }}>
        <div className="zb-celebrate-stamp" aria-hidden="true"
          style={{ display: "inline-block", marginBottom: 18, padding: "6px 14px", border: `4px double ${ZB.stamp}`, borderRadius: 6, color: ZB.stamp, fontSize: 15, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", transform: "rotate(-3deg)" }}>
          Prêt
        </div>
        <h2 id="celebrate-title" style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 700, lineHeight: 1.25, color: ZB.ink }}>
          Ton premier devis est prêt&nbsp;!
        </h2>
        {seconds > 0 && (
          <p style={{ margin: "0 0 14px", fontSize: 15, color: ZB.ink2 }}>
            Rédigé en <strong style={{ color: ZB.ink, fontWeight: 700, ...NUM }}>{seconds}</strong> seconde{seconds > 1 ? "s" : ""}. Pas mal pour un début.
          </p>
        )}
        <p style={{ margin: "0 0 18px", fontSize: 15, color: ZB.ink2, lineHeight: 1.45 }}>
          Ajuste librement les lignes ci-dessus, puis enregistre-le. Tu pourras l'envoyer à ton client en signature ou le télécharger en PDF.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ ...btnSecondary, flex: 1 }}>
            Continuer
          </button>
          <button type="button" onClick={onSave} style={{ ...btnPrimary, flex: 2, minHeight: 52, fontSize: 16 }}>
            Enregistrer ce devis
          </button>
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 13, color: ZB.ink2, lineHeight: 1.4 }}>
          Conseil : complète ton SIRET et ton adresse dans « Mon profil » pour un PDF 100&nbsp;% pro.
        </p>
      </div>
    </div>
  );
}
