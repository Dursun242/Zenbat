import { fmtEur, fmtDT, relTime, SC, SL, SORT_OPTS } from "../../lib/admin/format.js";

export default function AdminUsersTable({ users, userSearch, setUserSearch, sortBy, setSortBy, currentUserId, onOpenDetail, onOpenDelete }) {
  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F0EBE3", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1612", flex: 1 }}>Utilisateurs ({users.length})</div>
        <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Chercher…"
          style={{ border: "1px solid #E8E2D8", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#1A1612", background: "#FAF7F2", width: 120 }}/>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ border: "1px solid #E8E2D8", borderRadius: 8, padding: "4px 8px", fontSize: 11, color: "#3D3028", background: "#FAF7F2" }}>
          {SORT_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      </div>

      {users.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "#9A8E82", fontSize: 12 }}>Aucun utilisateur</div>
      )}

      {users.map((u, i) => (
        <div key={u.id} style={{ padding: "12px 16px", borderBottom: "1px solid #FAF7F2", background: i % 2 === 0 ? "white" : "#fafbfc", cursor: "pointer" }}
          onClick={(e) => { if (!e.target.closest("button")) onOpenDetail(u); }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.fullName || u.name}
              </div>
              {u.fullName && u.name && u.fullName !== u.name && (
                <div style={{ fontSize: 11, color: "#6B6358", fontWeight: 500, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
              )}
              <div style={{ fontSize: 10, color: "#9A8E82", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, display: "inline-block", background: u.plan === "pro" ? "rgba(34,197,94,.12)" : "#F0EBE3", color: u.plan === "pro" ? "#15803d" : "#6B6358" }}>
                {u.plan === "pro" ? "PRO" : "FREE"}
              </span>
              {u.daysLeft !== null && u.daysLeft <= 10 && (
                <div style={{ fontSize: 9, color: u.daysLeft <= 3 ? "#ef4444" : "#f59e0b", marginTop: 2, fontWeight: 600 }}>{u.daysLeft}j restants</div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
            {[
              { l: "CA signé",   v: fmtEur(u.caTotal),                  c: u.caTotal > 0 ? "#0ea5e9" : "#cbd5e1" },
              { l: "Devis",      v: u.devisTotal,                        c: u.devisTotal > 0 ? "#3D3028" : "#cbd5e1" },
              { l: "Taux conv.", v: u.devisTotal ? `${u.txConv}%` : "—", c: u.txConv >= 50 ? "#22c55e" : "#9A8E82" },
              { l: "IA",         v: `${u.ai_used}×`,                     c: u.ai_used > 5 ? "#7c3aed" : "#9A8E82" },
            ].map(m => (
              <div key={m.l} style={{ background: "#FAF7F2", borderRadius: 8, padding: "5px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#9A8E82" }}>{m.l}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: m.c, marginTop: 1 }}>{m.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 7, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 9, color: "#9A8E82" }}>
              Inscrit <span style={{ color: "#6B6358", fontWeight: 600 }}>{fmtDT(u.joined)}</span>
              {" · "}Vu <span style={{ color: "#6B6358", fontWeight: 600 }}>{relTime(u.lastSignIn)}</span>
              {u.lastDevis && <>{" · "}Devis <span style={{ color: "#6B6358", fontWeight: 600 }}>{relTime(u.lastDevis)}</span></>}
            </div>
            {u.devisTotal > 0 && (
              <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
                {Object.entries(u.byStatut).filter(([, n]) => n > 0).map(([s, n]) => (
                  <span key={s} title={`${SL[s]}: ${n}`} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 10, background: `${SC[s]}22`, color: SC[s], fontWeight: 700 }}>
                    {SL[s]} {n}
                  </span>
                ))}
              </div>
            )}
            {u.id !== currentUserId && (
              <button onClick={() => onOpenDelete(u)}
                title="Supprimer définitivement ce compte"
                style={{ marginLeft: u.devisTotal > 0 ? 0 : "auto", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                Supprimer
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
