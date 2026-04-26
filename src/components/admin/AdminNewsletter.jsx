import { fmtD } from "../../lib/admin/format.js"

export default function AdminNewsletter({ subscribers, loading, onRefresh }) {
  const count = subscribers?.length ?? 0

  return (
    <div style={{ background: "white", borderRadius: 14, border: "1px solid #E8E2D8", marginBottom: 18, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #F0EBE3", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1A1612" }}>Newsletter</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: "#9A8E82" }}>{count} abonné{count !== 1 ? "s" : ""}</span>
        </div>
        <button
          onClick={onRefresh}
          style={{ background: "#FAF7F2", border: "1px solid #E8E2D8", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#6B6358", cursor: "pointer" }}
        >
          ↻ Actualiser
        </button>
      </div>

      {loading && (
        <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#9A8E82" }}>Chargement…</div>
      )}

      {!loading && count === 0 && (
        <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#9A8E82" }}>Aucun abonné pour l'instant.</div>
      )}

      {!loading && count > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#FAF7F2" }}>
                {["Email", "Source", "Date d'inscription"].map(h => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "#6B6358", fontWeight: 600, fontSize: 11, borderBottom: "1px solid #F0EBE3" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: i < count - 1 ? "1px solid #F8F4EF" : "none" }}>
                  <td style={{ padding: "10px 14px", color: "#1A1612" }}>{s.email}</td>
                  <td style={{ padding: "10px 14px", color: "#6B6358" }}>{s.source || "landing"}</td>
                  <td style={{ padding: "10px 14px", color: "#9A8E82" }}>{fmtD(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
