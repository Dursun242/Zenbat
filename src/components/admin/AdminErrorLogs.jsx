import { fmtDT } from "../../lib/admin/format.js";

export default function AdminErrorLogs({ iaLogs, loading, onRefresh }) {
  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", flex: 1 }}>
          Erreurs Agent IA {iaLogs ? `(${iaLogs.length})` : ""}
        </div>
        <button onClick={onRefresh} disabled={loading}
          style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#475569", cursor: "pointer", fontWeight: 600 }}>
          {loading ? "…" : "↻"}
        </button>
      </div>

      {iaLogs === null && !loading && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>Appliquez la migration 0004 pour activer le journal.</div>
      )}
      {iaLogs && iaLogs.length === 0 && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>Aucune erreur enregistrée 🎉</div>
      )}
      {iaLogs && iaLogs.slice(0, 50).map((l, i) => (
        <div key={l.id} style={{ padding: "10px 16px", borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "white" : "#fafbfc" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
            <span style={{ fontSize: 9, color: "#94a3b8" }}>{l.email}</span>
            <span style={{ marginLeft: "auto", fontSize: 9, color: "#94a3b8" }}>{fmtDT(l.created_at)} · {new Date(l.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div style={{ fontSize: 11, color: "#b91c1c", fontFamily: "ui-monospace,monospace", wordBreak: "break-word" }}>{l.error}</div>
          {l.user_message && (
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis" }}>
              « {l.user_message.slice(0, 180)}{l.user_message.length > 180 ? "…" : ""} »
            </div>
          )}
          {l.history_len != null && (
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 3 }}>
              Historique : {l.history_len} msg · Streaming : {l.stream_tried ? "tenté" : "non"}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
