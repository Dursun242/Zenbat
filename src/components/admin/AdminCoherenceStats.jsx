import { fmtDT } from "../../lib/admin/format.js";

const STATUS_COLOR = { pass: "#22c55e", warn: "#f59e0b", fail: "#ef4444" };
const STATUS_LABEL = { pass: "Validé", warn: "Avertissement", fail: "Corrigé" };

export default function AdminCoherenceStats({ data, loading, onRefresh }) {
  const rows = data?.validations || [];

  const byStatus = rows.reduce((a, r) => {
    a[r.overall_status] = (a[r.overall_status] || 0) + 1;
    return a;
  }, {});

  const byTypology = rows.reduce((a, r) => {
    if (r.typology_id) a[r.typology_id] = (a[r.typology_id] || 0) + 1;
    return a;
  }, {});

  const totalCorrected = rows.filter(r => r.iteration_count > 1).length;

  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F0EBE3", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1612", flex: 1 }}>
          Moteur de cohérence {rows.length > 0 ? `(${rows.length} validations)` : ""}
        </div>
        <button onClick={onRefresh} disabled={loading}
          style={{ background: "#FAF7F2", border: "1px solid #E8E2D8", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#6B6358", cursor: "pointer", fontWeight: 600 }}>
          {loading ? "…" : "↻"}
        </button>
      </div>

      {data === null && !loading && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#9A8E82" }}>
          Appliquer la migration 0024 pour activer les logs de cohérence.
        </div>
      )}

      {rows.length === 0 && data !== null && !loading && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#9A8E82" }}>
          Aucune validation enregistrée — les devis générés apparaîtront ici.
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ padding: "12px 16px" }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
            {["pass", "warn", "fail"].map(s => (
              <div key={s} style={{ background: "#FAF7F2", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: STATUS_COLOR[s] }}>{byStatus[s] || 0}</div>
                <div style={{ fontSize: 10, color: "#9A8E82", marginTop: 2 }}>{STATUS_LABEL[s]}</div>
              </div>
            ))}
            <div style={{ background: "#FAF7F2", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#7c3aed" }}>{totalCorrected}</div>
              <div style={{ fontSize: 10, color: "#9A8E82", marginTop: 2 }}>Corrigés auto</div>
            </div>
          </div>

          {/* Top typologies */}
          {Object.keys(byTypology).length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9A8E82", letterSpacing: "1px", marginBottom: 6 }}>TOP TYPOLOGIES</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(byTypology).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, count]) => (
                  <span key={id} style={{ background: "#F0EBE3", borderRadius: 20, padding: "3px 10px", fontSize: 10, color: "#3D3028" }}>
                    {id.replace(/_/g, " ")} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 20 dernières validations */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9A8E82", letterSpacing: "1px", marginBottom: 6 }}>DERNIÈRES VALIDATIONS</div>
          {rows.slice(0, 20).map((r, i) => (
            <div key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid #FAF7F2", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[r.overall_status], minWidth: 70 }}>
                {STATUS_LABEL[r.overall_status]}
              </span>
              <span style={{ fontSize: 11, color: "#3D3028", flex: 1 }}>
                {r.typology_id?.replace(/_/g, " ") || "—"}
              </span>
              {r.iteration_count > 1 && (
                <span style={{ fontSize: 9, background: "#ede9fe", color: "#7c3aed", borderRadius: 4, padding: "1px 6px" }}>
                  {r.iteration_count} essais
                </span>
              )}
              <span style={{ fontSize: 9, color: "#9A8E82", flexShrink: 0 }}>
                {fmtDT(r.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
