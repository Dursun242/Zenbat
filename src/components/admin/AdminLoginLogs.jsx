// Journal des connexions — événements `login` tracés par Supabase Auth
// (auth.audit_log_entries), exposés via /api/admin-stats?type=login_logs.
// Lecture seule : sert à repérer une connexion inhabituelle (IP, horaire).

const fmtDateTime = d => d
  ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
  : "—"

export default function AdminLoginLogs({ logins, loading, onRefresh }) {
  const count = logins?.length ?? 0
  const uniqueIps = count > 0 ? new Set(logins.map(l => l.ip_address).filter(Boolean)).size : 0

  return (
    <div style={{ background: "white", borderRadius: 14, border: "1px solid #E8E2D8", marginBottom: 18, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #F0EBE3", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1A1612" }}>Connexions</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: "#9A8E82" }}>
            {count} connexion{count !== 1 ? "s" : ""}{count > 0 ? ` · ${uniqueIps} IP distincte${uniqueIps !== 1 ? "s" : ""}` : ""}
          </span>
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
        <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#9A8E82" }}>Aucune connexion récente.</div>
      )}

      {!loading && count > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#FAF7F2" }}>
                {["Email", "Adresse IP", "Date & heure"].map(h => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "#6B6358", fontWeight: 600, fontSize: 11, borderBottom: "1px solid #F0EBE3" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logins.map((l, i) => (
                <tr key={l.id || i} style={{ borderBottom: i < count - 1 ? "1px solid #F8F4EF" : "none" }}>
                  <td style={{ padding: "10px 14px", color: "#1A1612" }}>{l.actor_username || "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#6B6358", fontFamily: "ui-monospace, monospace" }}>{l.ip_address || "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#9A8E82" }}>{fmtDateTime(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
