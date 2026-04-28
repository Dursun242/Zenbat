import { fmtD } from "../../lib/admin/format.js"

const COL = {
  bad:     { label: "👎 Mauvaises",  bg: "#fef2f2", border: "#fecaca", head: "#991b1b" },
  neutral: { label: "— Sans avis",   bg: "#f8fafc", border: "#e2e8f0", head: "#475569" },
  good:    { label: "👍 Bonnes",     bg: "#f0fdf4", border: "#bbf7d0", head: "#15803d" },
}

function FeedbackCard({ row }) {
  const trades = Array.isArray(row.trades) ? row.trades.slice(0, 2).join(", ") : null
  return (
    <div style={{ background: "white", border: "1px solid #f1f5f9", borderRadius: 8, padding: "8px 10px", fontSize: 11, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontWeight: 600, color: "#1A1612", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {row.user_message || "—"}
      </div>
      {row.reason && (
        <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 5, padding: "2px 7px", fontSize: 10, color: "#854d0e", display: "inline-block", alignSelf: "flex-start" }}>
          {row.reason}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#9A8E82" }}>
        {trades && <span>🔧 {trades}</span>}
        {row.lignes_count > 0 && <span>📋 {row.lignes_count} ligne{row.lignes_count > 1 ? "s" : ""}</span>}
        <span>{row.name || row.email || "—"}</span>
        <span style={{ marginLeft: "auto" }}>{fmtD(row.created_at)}</span>
      </div>
    </div>
  )
}

export default function AdminFeedback({ data, loading, onRefresh }) {
  if (loading) return (
    <div style={{ background: "white", borderRadius: 14, border: "1px solid #F0EBE3", padding: 24, marginTop: 16, textAlign: "center", color: "#9A8E82", fontSize: 13 }}>
      Chargement des feedbacks…
    </div>
  )

  const rows = data || []
  const bad     = rows.filter(r => r.vote === -1)
  const good    = rows.filter(r => r.vote === 1)
  // "sans avis" = conversations IA sans vote — non disponible ici, on affiche juste le résumé
  const total   = rows.length
  const pctGood = total ? Math.round(good.length / total * 100) : 0

  const cols = [
    { key: "bad",  items: bad },
    { key: "good", items: good },
  ]

  return (
    <div style={{ background: "white", borderRadius: 14, border: "1px solid #F0EBE3", overflow: "hidden", marginTop: 16 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #FAF7F2", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1612" }}>Feedback IA</div>
          <div style={{ fontSize: 11, color: "#9A8E82", marginTop: 2 }}>
            {total} vote{total > 1 ? "s" : ""} · {pctGood}% positifs
          </div>
        </div>
        <button onClick={onRefresh} style={{ background: "#FAF7F2", border: "1px solid #F0EBE3", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#6B6358", cursor: "pointer" }}>↻</button>
      </div>

      {total === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#9A8E82", fontSize: 12 }}>
          Aucun feedback reçu pour l'instant.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          {cols.map(({ key, items }) => {
            const c = COL[key]
            return (
              <div key={key} style={{ borderRight: key === "bad" ? "1px solid #F0EBE3" : "none" }}>
                <div style={{ background: c.bg, borderBottom: `1px solid ${c.border}`, padding: "8px 12px", fontSize: 11, fontWeight: 700, color: c.head }}>
                  {c.label} · {items.length}
                </div>
                <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6, maxHeight: 480, overflowY: "auto" }}>
                  {items.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#9A8E82", fontSize: 11, padding: 16 }}>—</div>
                  ) : (
                    items.map(r => <FeedbackCard key={r.id} row={r} />)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
