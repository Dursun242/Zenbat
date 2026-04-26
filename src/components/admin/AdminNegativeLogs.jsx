import { fmtDT } from "../../lib/admin/format.js";

export default function AdminNegativeLogs({ iaNegs, loading, negFilter, setNegFilter, onRefresh }) {
  const filtered = (iaNegs || []).filter(n => negFilter === "all" || n.kind === negFilter);

  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", flex: 1 }}>
          Réponses négatives {iaNegs ? `(${filtered.length})` : ""}
        </div>
        <select value={negFilter} onChange={e => setNegFilter(e.target.value)}
          style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 8px", fontSize: 11, color: "#374151", background: "#f8fafc" }}>
          <option value="all">Tous</option>
          <option value="ai_refusal">Refus IA</option>
          <option value="user_negative">Mécontent</option>
        </select>
        <button onClick={onRefresh} disabled={loading}
          style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#475569", cursor: "pointer", fontWeight: 600 }}>
          {loading ? "…" : "↻"}
        </button>
      </div>

      {iaNegs === null && !loading && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>Appliquez la migration 0005 pour activer ce journal.</div>
      )}
      {iaNegs && filtered.length === 0 && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>Aucun signal négatif sur cette période 🎉</div>
      )}
      {iaNegs && filtered.slice(0, 50).map((n, i) => {
        const isRefusal = n.kind === "ai_refusal";
        const bg  = isRefusal ? "#f1f5f9" : "#fef2f2";
        const fg  = isRefusal ? "#475569" : "#b91c1c";
        const tag = isRefusal ? "Refus IA" : "Usager mécontent";
        return (
          <div key={n.id} style={{ padding: "10px 16px", borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "white" : "#fafbfc" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: bg, color: fg }}>{tag}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis" }}>{n.name}</span>
              <span style={{ fontSize: 9, color: "#94a3b8" }}>{n.email}</span>
              <span style={{ marginLeft: "auto", fontSize: 9, color: "#94a3b8" }}>{fmtDT(n.created_at)} · {new Date(n.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {n.user_message && (
              <div style={{ fontSize: 11, color: "#0f172a", marginTop: 4, wordBreak: "break-word" }}>
                <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, marginRight: 6 }}>USR</span>
                « {n.user_message.slice(0, 220)}{n.user_message.length > 220 ? "…" : ""} »
              </div>
            )}
            {n.ai_response && (
              <div style={{ fontSize: 11, color: "#475569", marginTop: 4, fontStyle: "italic", wordBreak: "break-word" }}>
                <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, marginRight: 6, fontStyle: "normal" }}>IA</span>
                {n.ai_response.slice(0, 220)}{n.ai_response.length > 220 ? "…" : ""}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
