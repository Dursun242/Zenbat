import { fmtEur } from "../../lib/admin/format.js";

// Modale de confirmation de suppression de compte (panel admin).
// La confirmation exige la saisie exacte de l'email du compte ciblé.
export default function DeleteUserModal({
  target, confirmInput, setConfirmInput, deleting, error, onClose, onConfirm,
}) {
  const canConfirm = !deleting && confirmInput.trim().toLowerCase() === (target.email || "").toLowerCase();
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 100, animation: "fadeUp .15s ease both" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "white", borderRadius: 16, maxWidth: 420, width: "100%", padding: 22, boxShadow: "0 24px 48px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="22" height="22" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1612" }}>Supprimer ce compte ?</div>
            <div style={{ fontSize: 11, color: "#6B6358", marginTop: 2 }}>Cette action est <strong style={{ color: "#dc2626" }}>irréversible</strong>.</div>
          </div>
        </div>

        <div style={{ background: "#FAF7F2", borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{target.name}</div>
          <div style={{ fontSize: 11, color: "#6B6358", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{target.email}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "#6B6358", flexWrap: "wrap" }}>
            <span><strong style={{ color: "#1A1612" }}>{target.devisTotal}</strong> devis</span>
            <span><strong style={{ color: "#1A1612" }}>{fmtEur(target.caTotal)}</strong> de CA</span>
            <span>Plan <strong style={{ color: target.plan === "pro" ? "#15803d" : "#6B6358" }}>{target.plan === "pro" ? "PRO" : "FREE"}</strong></span>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#6B6358", lineHeight: 1.5, marginBottom: 12 }}>
          Seront supprimés : compte utilisateur, profil, clients, devis, lignes et PDF associés.
        </div>

        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#3D3028", marginBottom: 6 }}>
          Saisissez l'email <strong style={{ color: "#1A1612" }}>{target.email}</strong> pour confirmer :
        </label>
        <input value={confirmInput} onChange={e => setConfirmInput(e.target.value)}
          placeholder={target.email}
          disabled={deleting}
          autoFocus
          style={{ width: "100%", border: "1px solid #E8E2D8", borderRadius: 10, padding: "10px 12px", fontSize: 13, outline: "none", marginBottom: 12 }}/>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "8px 12px", fontSize: 11, color: "#991b1b", marginBottom: 12 }}>
            ❌ {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={deleting}
            style={{ flex: 1, background: "#F0EBE3", color: "#3D3028", border: "none", borderRadius: 10, padding: "10px", fontSize: 12, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer" }}>
            Annuler
          </button>
          <button onClick={onConfirm} disabled={!canConfirm}
            style={{ flex: 2, background: !canConfirm ? "#fca5a5" : "#dc2626", color: "white", border: "none", borderRadius: 10, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {deleting ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </div>
  );
}
