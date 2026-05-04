import { fmtDT } from "../../lib/admin/format.js"

function fmtEur(v) {
  if (!v) return null
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)
}

export default function AdminQuotesSent({ data, loading, onRefresh }) {
  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F0EBE3", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1612", flex: 1 }}>
          Devis envoyés {data ? `(${data.length})` : ""}
        </div>
        <button onClick={onRefresh} disabled={loading}
          style={{ background: "#FAF7F2", border: "1px solid #E8E2D8", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#6B6358", cursor: "pointer", fontWeight: 600 }}>
          {loading ? "…" : "↻"}
        </button>
      </div>

      {data && data.length === 0 && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#9A8E82" }}>Aucun devis envoyé pour l'instant.</div>
      )}
      {data && data.slice(0, 100).map((r, i) => (
        <div key={r.id} style={{ padding: "10px 16px", borderBottom: "1px solid #FAF7F2", background: i % 2 === 0 ? "white" : "#fafbfc" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1A1612" }}>
              {r.numero || r.devis_id?.slice(0, 8)}
            </span>
            {r.montant_ht ? (
              <span style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>
                {fmtEur(r.montant_ht * 1.2)}
              </span>
            ) : null}
            <span style={{ marginLeft: "auto", fontSize: 9, color: "#9A8E82" }}>
              {fmtDT(r.created_at)} · {new Date(r.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          {r.objet && (
            <div style={{ fontSize: 10, color: "#6B6358", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.objet}
            </div>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: "#9A8E82" }}>Artisan : <b style={{ color: "#6B6358" }}>{r.artisan_name}</b></span>
            {r.to && <span style={{ fontSize: 9, color: "#9A8E82" }}>→ {r.to}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
