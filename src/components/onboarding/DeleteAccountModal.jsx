// Modale de suppression de compte en libre-service (onboarding, étape Données).
// L'utilisateur doit ressaisir son email exact pour confirmer.
export default function DeleteAccountModal({
  myEmail, confirm, setConfirm, busy, error, onClose, onConfirm,
}) {
  const canConfirm = !busy && confirm.trim().toLowerCase() === (myEmail || "").toLowerCase();
  return (
    <div onClick={() => !busy && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 200, animation: "popIn .15s ease both" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 18, maxWidth: 440, width: "100%", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "#3f0e0e", border: "1px solid #7f1d1d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#ef4444" }}>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>Supprimer mon compte ?</div>
            <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 2 }}>Action <strong>irréversible</strong>.</div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginBottom: 14 }}>
          Seront supprimés : profil, clients, devis (brouillons + refusés), conversations IA, journaux, PDF.
          <br/><br/>
          <strong style={{ color: "#cbd5e1" }}>Conservé en archive 10 ans</strong> (LPF L102 B) : factures émises, anonymisées et inaccessibles en lecture sauf injonction administrative.
        </div>

        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
          Saisissez votre email <strong style={{ color: "white" }}>{myEmail || "—"}</strong> pour confirmer :
        </label>
        <input value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder={myEmail}
          disabled={busy} autoFocus
          style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "white", outline: "none", marginBottom: 12, fontFamily: "inherit" }}/>

        {error && (
          <div style={{ background: "#3f0e0e", border: "1px solid #7f1d1d", borderRadius: 10, padding: "8px 12px", fontSize: 11, color: "#fca5a5", marginBottom: 12 }}>
            ❌ {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={busy}
            style={{ flex: 1, background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: 10, padding: "11px", fontSize: 12, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}>
            Annuler
          </button>
          <button onClick={onConfirm} disabled={!canConfirm}
            style={{ flex: 2, background: !canConfirm ? "#7f1d1d" : "#dc2626", color: "white", border: "none", borderRadius: 10, padding: "11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {busy ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </div>
  );
}
