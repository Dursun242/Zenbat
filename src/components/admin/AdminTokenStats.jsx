import { fmtD } from "../../lib/admin/format.js"

const MODEL_LABELS = {
  "claude-haiku-4-5-20251001": "Haiku 4.5",
  "claude-sonnet-4-6":         "Sonnet 4.6",
  "claude-sonnet-4-5":         "Sonnet 4.5",
}

const MODEL_COLORS = {
  "claude-haiku-4-5-20251001": "#22c55e",
  "claude-sonnet-4-6":         "#6366f1",
  "claude-sonnet-4-5":         "#0ea5e9",
}

function fmtUsd(n) {
  if (!n) return "$0.000"
  if (n < 0.01) return `$${n.toFixed(4)}`
  if (n < 1)    return `$${n.toFixed(3)}`
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtTk(n) {
  if (!n) return "0"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString("fr-FR")
}

function Card({ label, value, sub, color = "#1A1612" }) {
  return (
    <div style={{ background: "white", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 10, color: "#9A8E82", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function AdminTokenStats({ data, loading, onRefresh }) {
  return (
    <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Tokens & Coûts API Claude</div>
        <button onClick={onRefresh} style={{ background: "#F5F0E8", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#6B6358", cursor: "pointer" }}>↻</button>
      </div>

      {loading && <div style={{ color: "#9A8E82", fontSize: 12, padding: "8px 0" }}>Chargement…</div>}

      {!loading && !data && (
        <div style={{ color: "#9A8E82", fontSize: 12 }}>Aucune donnée — les tokens seront enregistrés dès le prochain appel IA.</div>
      )}

      {!loading && data && (
        <>
          {/* KPIs globaux */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9A8E82", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>Dépenses</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <Card label="Aujourd'hui"      value={fmtUsd(data.today.cost)}    sub={`${data.today.calls} appels`}                                        color="#6366f1" />
            <Card label="Cette semaine"    value={fmtUsd(data.week.cost)}     sub={`${data.week.calls} appels`}                                         color="#0ea5e9" />
            <Card label="Ce mois-ci"       value={fmtUsd(data.month.cost)}    sub={`in: ${fmtTk(data.month.input)} · out: ${fmtTk(data.month.output)}`} color="#f59e0b" />
            <Card label="Total"            value={fmtUsd(data.total.cost)}    sub={`${data.total.calls.toLocaleString("fr-FR")} appels`}                 color="#ef4444" />
            <Card label="Tokens input"     value={fmtTk(data.total.input)}    sub="prompts + contexte" />
            <Card label="Tokens output"    value={fmtTk(data.total.output)}   sub="réponses générées" />
          </div>

          {/* Par modèle */}
          {data.byModel.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9A8E82", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>Par modèle</div>
              <div style={{ marginBottom: 16 }}>
                {data.byModel.map(m => (
                  <div key={m.model} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#FAF7F2", marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: MODEL_COLORS[m.model] || "#94a3b8", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{MODEL_LABELS[m.model] || m.model}</div>
                      <div style={{ fontSize: 10, color: "#9A8E82" }}>{m.calls.toLocaleString("fr-FR")} appels · in {fmtTk(m.input)} · out {fmtTk(m.output)}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: MODEL_COLORS[m.model] || "#1A1612" }}>{fmtUsd(m.cost)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Top utilisateurs */}
          {data.topUsers.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9A8E82", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>Top utilisateurs par coût</div>
              <div style={{ marginBottom: 16 }}>
                {data.topUsers.slice(0, 10).map((u, i) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 8, background: i % 2 === 0 ? "#FAF7F2" : "transparent", marginBottom: 2 }}>
                    <div style={{ fontSize: 10, color: "#9A8E82", width: 16, textAlign: "right" }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                      <div style={{ fontSize: 10, color: "#9A8E82" }}>{u.calls} appels · {fmtTk(u.input + u.output)} tokens</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1612", flexShrink: 0 }}>{fmtUsd(u.cost)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Tendance journalière */}
          {data.dailyTrend.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9A8E82", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>30 derniers jours</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #F0EBE3" }}>
                      <th style={{ textAlign: "left",  padding: "4px 8px", color: "#9A8E82", fontWeight: 600 }}>Date</th>
                      <th style={{ textAlign: "right", padding: "4px 8px", color: "#9A8E82", fontWeight: 600 }}>Appels</th>
                      <th style={{ textAlign: "right", padding: "4px 8px", color: "#9A8E82", fontWeight: 600 }}>Tokens in</th>
                      <th style={{ textAlign: "right", padding: "4px 8px", color: "#9A8E82", fontWeight: 600 }}>Tokens out</th>
                      <th style={{ textAlign: "right", padding: "4px 8px", color: "#9A8E82", fontWeight: 600 }}>Coût</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.dailyTrend].reverse().map(row => (
                      <tr key={row.date} style={{ borderBottom: "1px solid #F5F0E8" }}>
                        <td style={{ padding: "5px 8px", color: "#6B6358" }}>{fmtD(row.date)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right" }}>{row.calls}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", color: "#6366f1" }}>{fmtTk(row.input)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", color: "#0ea5e9" }}>{fmtTk(row.output)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{fmtUsd(row.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
