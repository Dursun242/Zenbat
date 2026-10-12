// Bandeau « confirme ton email » (système « Bordereau »). Rendu par App sous
// la barre du haut, dans la colonne de l'application : il prend sa hauteur
// au contenu au lieu de pousser l'app hors de #root (position fixe,
// overflow masqué), ce qui rognait la barre d'action des fiches.
// - avant 7 jours : papier gris, masquable ;
// - ensuite (`blocking`) : terre cuite pâle, non masquable.
import { useState } from "react";
import { useAuth } from "../../lib/auth.jsx";
import { ZB } from "../../lib/theme.js";

const CloseIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>;

export default function EmailVerificationBanner({ blocking = false }) {
  const { session, resendConfirmation } = useAuth();
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [dismissed, setDismissed] = useState(false);

  if (dismissed && !blocking) return null;
  const email = session?.user?.email || "";

  const resend = async () => {
    setState("sending");
    try {
      const res = await resendConfirmation();
      setState(res?.error ? "error" : "sent");
    } catch {
      setState("error");
    }
  };

  return (
    <div role="region" aria-label="Confirmation de l'email" className="zb-email-banner"
      style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "4px 12px", flexWrap: "wrap",
        padding: "6px calc(6px + env(safe-area-inset-right)) 6px calc(18px + env(safe-area-inset-left))",
        background: blocking ? ZB.accentSoft : ZB.paper2, borderBottom: `1px solid ${ZB.rule}`,
        fontFamily: ZB.font, color: ZB.ink }}>
      <style>{`.zb-email-banner button:focus-visible{outline:2px solid ${ZB.accent};outline-offset:2px}`}</style>
      <p style={{ flex: "1 1 220px", minWidth: 0, margin: 0, padding: "6px 0", fontSize: 14, lineHeight: 1.4, color: ZB.ink2, overflowWrap: "anywhere" }}>
        {blocking
          ? <><strong style={{ color: ZB.ink }}>Accès restreint.</strong> Confirme ton email <strong style={{ color: ZB.ink }}>{email}</strong> pour retrouver toutes les fonctions.</>
          : <>Confirme ton email <strong style={{ color: ZB.ink }}>{email}</strong> pour sécuriser ton compte.</>}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: "auto" }}>
        {state === "sent" ? (
          <span role="status" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 8px", fontSize: 14, fontWeight: 600, color: ZB.stamp }}>
            Email renvoyé. Regarde aussi dans tes spams.
          </span>
        ) : (
          <>
            {state === "error" && <span role="alert" style={{ fontSize: 14, fontWeight: 600, color: ZB.danger }}>Envoi impossible.</span>}
            <button type="button" onClick={resend} disabled={state === "sending"}
              style={{ minHeight: 44, padding: "0 8px", background: "none", border: "none", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                color: ZB.accent, textDecoration: "underline", textUnderlineOffset: 3, cursor: state === "sending" ? "default" : "pointer", opacity: state === "sending" ? 0.6 : 1 }}>
              {state === "sending" ? "Envoi…" : state === "error" ? "Réessayer" : "Renvoyer l'email"}
            </button>
          </>
        )}
        {!blocking && (
          <button type="button" onClick={() => setDismissed(true)} aria-label="Masquer ce rappel"
            style={{ width: 44, height: 44, display: "grid", placeItems: "center", padding: 0, background: "none", border: "none", borderRadius: 8, color: ZB.ink2, cursor: "pointer" }}>
            {CloseIcon}
          </button>
        )}
      </div>
    </div>
  );
}
