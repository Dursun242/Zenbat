import { useMemo, useState } from "react";
import { fmtDT } from "../../lib/admin/format.js";
import { ExportCsvButton } from "../../lib/exportCsv.jsx";

// Erreurs JS remontées par AppLogger (index.html) : crashes React,
// échecs de save, erreurs micro, fetchs ratés… Migration 0017.
// L'admin filtre par niveau, par état "résolu", et peut cocher un log
// pour marquer un incident traité.
export default function AdminAppLogs({ logs, loading, onRefresh, onMarkResolved, level, setLevel, onlyUnresolved, setOnlyUnresolved }) {
  const [openId, setOpenId] = useState(null);
  const count    = logs?.length ?? 0;
  const filtered = logs || [];

  // Stats rapides en haut du panel — utile pour repérer un message qui
  // se répète (= bug systémique vs incident isolé).
  const topMessages = useMemo(() => {
    const map = new Map();
    for (const l of filtered) {
      const key = (l.message || "").slice(0, 80);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .filter(([, n]) => n >= 2);
  }, [filtered]);

  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F0EBE3", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1612", flex: 1 }}>
          Erreurs application {logs ? `(${count})` : ""}
        </div>
        <select value={level} onChange={e => setLevel(e.target.value)}
          style={{ border: "1px solid #E8E2D8", borderRadius: 8, padding: "4px 8px", fontSize: 11, color: "#3D3028", background: "#FAF7F2" }}>
          <option value="">Tous niveaux</option>
          <option value="error">Erreurs</option>
          <option value="warn">Warnings</option>
          <option value="info">Info</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6B6358", cursor: "pointer" }}>
          <input type="checkbox" checked={onlyUnresolved} onChange={e => setOnlyUnresolved(e.target.checked)}/>
          Non résolus
        </label>
        <ExportCsvButton
          disabled={count === 0}
          filename="zenbat-erreurs-app.csv"
          getRows={() => filtered}
          columns={[
            { key: "created_at", label: "Date" },
            { key: "level",      label: "Niveau" },
            { key: "message",    label: "Message" },
            { key: "stack",      label: "Stack" },
            { key: "context",    label: "Contexte", accessor: l => l.context ? JSON.stringify(l.context) : "" },
            { key: "resolved",   label: "Résolu" },
          ]}
        />
        <button onClick={onRefresh} disabled={loading}
          style={{ background: "#FAF7F2", border: "1px solid #E8E2D8", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#6B6358", cursor: "pointer", fontWeight: 600 }}>
          {loading ? "…" : "↻"}
        </button>
      </div>

      {topMessages.length > 0 && (
        <div style={{ padding: "10px 16px", background: "#fef9c3", borderBottom: "1px solid #fde68a", fontSize: 11, color: "#92400e" }}>
          <strong>Récurrents :</strong>{" "}
          {topMessages.map(([msg, n], i) => (
            <span key={i}>{i > 0 ? " · " : ""}<code style={{ fontSize: 10 }}>{msg}</code> ×{n}</span>
          ))}
        </div>
      )}

      {logs === null && !loading && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#9A8E82" }}>Appliquez la migration 0017 pour activer ce journal.</div>
      )}
      {logs && filtered.length === 0 && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#9A8E82" }}>Aucune erreur sur cette période 🎉</div>
      )}

      {filtered.slice(0, 100).map((l, i) => {
        const isOpen = openId === l.id;
        const levelColor = l.level === "error" ? "#b91c1c" : l.level === "warn" ? "#b45309" : "#3b82f6";
        const levelBg    = l.level === "error" ? "#fef2f2" : l.level === "warn" ? "#fffbeb" : "#eff6ff";
        return (
          <div key={l.id} style={{ borderBottom: "1px solid #FAF7F2", background: l.resolved ? "#f9fafb" : (i % 2 === 0 ? "white" : "#fafbfc"), opacity: l.resolved ? 0.6 : 1 }}>
            <button onClick={() => setOpenId(isOpen ? null : l.id)}
              style={{ width: "100%", background: "none", border: "none", padding: "10px 16px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: levelBg, color: levelColor, flexShrink: 0 }}>
                {(l.level || "?").toUpperCase()}
              </span>
              <span style={{ fontSize: 11, color: "#1A1612", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace" }}>
                {l.message}
              </span>
              <span style={{ fontSize: 9, color: "#9A8E82", flexShrink: 0 }}>{fmtDT(l.created_at)}</span>
              <span style={{ color: isOpen ? "#22c55e" : "#cbd5e1", fontSize: 14, lineHeight: 1, transform: isOpen ? "rotate(45deg)" : "rotate(0)", transition: "transform .2s" }}>+</span>
            </button>

            {isOpen && (
              <div style={{ padding: "8px 16px 14px 16px", fontSize: 11, color: "#3D3028", display: "flex", flexDirection: "column", gap: 8 }}>
                {l.stack && (
                  <pre style={{ background: "#1A1612", color: "#f0fdf4", padding: 10, borderRadius: 8, overflow: "auto", fontSize: 10, lineHeight: 1.5, margin: 0, maxHeight: 200 }}>
                    {l.stack}
                  </pre>
                )}
                {l.context && (
                  <div style={{ background: "#FAF7F2", borderRadius: 8, padding: 10, fontSize: 10, lineHeight: 1.5, fontFamily: "ui-monospace, monospace", wordBreak: "break-word" }}>
                    {Object.entries(l.context).map(([k, v]) => (
                      <div key={k}><strong>{k}:</strong> {typeof v === "object" ? JSON.stringify(v) : String(v)}</div>
                    ))}
                  </div>
                )}
                {!l.resolved && onMarkResolved && (
                  <button onClick={() => onMarkResolved(l.id)}
                    style={{ alignSelf: "flex-start", background: "#22c55e", border: "none", color: "white", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    ✓ Marquer comme résolu
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
