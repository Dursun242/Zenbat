import { ZB } from "../../lib/theme.js";
import { useModalGuard } from "../../hooks/useModalGuard.js";
import { btnSecondary } from "../ui/Register.jsx";
import { inputStyle, labelStyle } from "./shared.jsx";

// Modale de suppression de compte en libre-service (onboarding, étape Données).
// L'utilisateur doit ressaisir son email exact pour confirmer.
export default function DeleteAccountModal({
  myEmail, confirm, setConfirm, busy, error, onClose, onConfirm,
}) {
  const canConfirm = !busy && confirm.trim().toLowerCase() === (myEmail || "").toLowerCase();
  // Échap, retour du téléphone : ferment comme « Annuler », sauf pendant la suppression.
  useModalGuard(true, onClose, { onEscape: () => { if (!busy) onClose(); } });
  return (
    <div onClick={() => !busy && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(26,22,18,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 200, fontFamily: ZB.font, color: ZB.ink }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="zb-form"
        style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 10, maxWidth: 440, width: "100%", padding: 20, boxShadow: "0 10px 30px rgba(26,22,18,.16)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <span style={{ color: ZB.danger, display: "flex", flexShrink: 0, marginTop: 1 }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <div style={{ flex: 1 }}>
            <h2 id="delete-account-title" style={{ margin: 0, fontSize: 19, fontWeight: 700, color: ZB.ink }}>Supprimer mon compte ?</h2>
            <p style={{ margin: "2px 0 0", fontSize: 14, color: ZB.danger, fontWeight: 600 }}>Action irréversible.</p>
          </div>
        </div>

        <p style={{ margin: "0 0 14px", fontSize: 14, color: ZB.ink2, lineHeight: 1.5 }}>
          Seront supprimés : profil, clients, devis (brouillons + refusés), conversations IA, journaux, PDF.
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: ZB.ink2, lineHeight: 1.5 }}>
          <strong style={{ color: ZB.ink }}>Conservé en archive 10 ans</strong> (LPF L102 B) : factures émises, anonymisées et inaccessibles en lecture sauf injonction administrative.
        </p>

        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={labelStyle}>
            Saisis ton email <strong style={{ color: ZB.ink }}>{myEmail || "—"}</strong> pour confirmer
          </span>
          <input value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder={myEmail}
            disabled={busy} autoFocus
            style={inputStyle}/>
        </label>

        {error && (
          <p role="alert" style={{ margin: "0 0 12px", background: ZB.dangerSoft, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: ZB.danger, fontWeight: 600 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} disabled={busy}
            style={{ ...btnSecondary, flex: 1, cursor: busy ? "not-allowed" : "pointer" }}>
            Annuler
          </button>
          <button type="button" onClick={onConfirm} disabled={!canConfirm}
            style={{ flex: 2, minHeight: 48, padding: "0 14px", background: ZB.danger, color: ZB.sheet, border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 15, fontWeight: 700, opacity: canConfirm ? 1 : 0.45, cursor: canConfirm ? "pointer" : "not-allowed" }}>
            {busy ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </div>
  );
}
