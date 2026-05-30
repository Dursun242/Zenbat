import { useMemo, useState } from "react";
import { fmtDT } from "../../lib/admin/format.js";
import { ExportCsvButton } from "../../lib/exportCsv.jsx";

// Erreurs JS remontées par AppLogger (index.html) : crashes React,
// échecs de save, erreurs micro, fetchs ratés… Migration 0017.
// L'admin filtre par niveau, par état "résolu", et peut cocher un log
// pour marquer un incident traité.
export default function AdminAppLogs({ logs, loading, onRefresh, onMarkResolved, level, setLevel, onlyUnresolved, setOnlyUnresolved }) {
  const [openId, setOpenId] = useState(null);
  const [showDashboard, setShowDashboard] = useState(true);
  const count    = logs?.length ?? 0;
  const filtered = logs || [];

  // Dashboard : compteurs + erreurs par jour (14j) + top messages +
  // top sessions affectées. Calculé sur l'ensemble des logs chargés
  // (jusqu'à 500 dernières) — indépendant des filtres level/résolus
  // pour donner une vue d'ensemble fiable.
  const dash = useMemo(() => {
    if (!logs || logs.length === 0) return null;
    const now = Date.now();
    const DAY = 86400000;

    const total       = logs.length;
    const unresolved  = logs.filter(l => !l.resolved).length;
    const errors      = logs.filter(l => l.level === "error").length;
    const last24h     = logs.filter(l => now - new Date(l.created_at).getTime() < DAY).length;
    const last7d      = logs.filter(l => now - new Date(l.created_at).getTime() < 7 * DAY).length;

    // Buckets 14 derniers jours (idx 0 = il y a 13 jours, idx 13 = aujourd'hui)
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now - (13 - i) * DAY);
      return {
        date: d,
        label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        short: d.toLocaleDateString("fr-FR", { day: "2-digit" }),
        count: 0,
      };
    });
    for (const log of logs) {
      const t = new Date(log.created_at).getTime();
      const diff = Math.floor((now - t) / DAY);
      if (diff >= 0 && diff < 14) days[13 - diff].count += 1;
    }
    const maxDaily = Math.max(1, ...days.map(d => d.count));

    // Top messages — normalisation par les 80 premiers chars pour
    // regrouper les variantes mineures (même cause sous-jacente).
    const msgMap = new Map();
    for (const log of logs) {
      const key = (log.message || "").slice(0, 80);
      msgMap.set(key, (msgMap.get(key) || 0) + 1);
    }
    const topMessages = Array.from(msgMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Top sessions affectées — révèle si N erreurs viennent d'un seul
    // utilisateur en boucle vs N utilisateurs distincts (=bug systémique).
    const sessMap = new Map();
    for (const log of logs) {
      const sid = log.context?.session_id;
      if (!sid) continue;
      const entry = sessMap.get(sid) || { count: 0, ua: log.context?.ua || "", lastAt: log.created_at };
      entry.count += 1;
      if (new Date(log.created_at) > new Date(entry.lastAt)) entry.lastAt = log.created_at;
      sessMap.set(sid, entry);
    }
    const topSessions = Array.from(sessMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
    const distinctSessions = sessMap.size;

    return { total, unresolved, errors, last24h, last7d, days, maxDaily, topMessages, topSessions, distinctSessions };
  }, [logs]);

  const Card = ({ label, value, accent }) => (
    <div style={{ flex: 1, minWidth: 110, background: "#FAF7F2", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "#9A8E82", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || "#1A1612", marginTop: 2, lineHeight: 1 }}>{value}</div>
    </div>
  );

  const detectDevice = (ua) => {
    if (!ua) return "—";
    if (/iPhone/i.test(ua)) return "📱 iPhone";
    if (/iPad/i.test(ua)) return "📱 iPad";
    if (/Android/i.test(ua)) return "📱 Android";
    if (/Macintosh/i.test(ua)) return "💻 macOS";
    if (/Windows/i.test(ua)) return "💻 Windows";
    if (/Linux/i.test(ua)) return "💻 Linux";
    return "—";
  };

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

      {dash && (
        <div style={{ borderBottom: "1px solid #F0EBE3", background: "#fafbfc" }}>
          <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6B6358", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Vue d'ensemble
            </span>
            <button onClick={() => setShowDashboard(s => !s)}
              style={{ background: "none", border: "none", color: "#9A8E82", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
              {showDashboard ? "Masquer ▴" : "Afficher ▾"}
            </button>
          </div>

          {showDashboard && (
            <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Compteurs */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Card label="Total"        value={dash.total} />
                <Card label="Non résolus"  value={dash.unresolved} accent={dash.unresolved > 0 ? "#b91c1c" : "#15803d"} />
                <Card label="Niveau error" value={dash.errors}     accent={dash.errors > 0 ? "#b91c1c" : "#15803d"} />
                <Card label="24 h"         value={dash.last24h} />
                <Card label="7 jours"      value={dash.last7d} />
                <Card label="Sessions"     value={dash.distinctSessions} />
              </div>

              {/* Graphique 14 jours */}
              <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", border: "1px solid #F0EBE3" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6358", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>Erreurs par jour — 14 derniers jours</span>
                  <span style={{ fontWeight: 500, color: "#9A8E82" }}>max {dash.maxDaily}</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", height: 80, gap: 4 }}>
                  {dash.days.map((d, i) => {
                    const h = d.count === 0 ? 2 : Math.max(4, (d.count / dash.maxDaily) * 76);
                    const isToday = i === 13;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
                           title={`${d.label} : ${d.count} erreur${d.count !== 1 ? "s" : ""}`}>
                        <div style={{ fontSize: 9, color: "#9A8E82", lineHeight: 1, minHeight: 11 }}>
                          {d.count > 0 ? d.count : ""}
                        </div>
                        <div style={{
                          width: "100%", height: h, borderRadius: "3px 3px 0 0",
                          background: d.count === 0 ? "#F0EBE3" : isToday ? "#1A1612" : "#9A8E82",
                          transition: "height .2s",
                        }}/>
                        <div style={{ fontSize: 9, color: isToday ? "#1A1612" : "#9A8E82", fontWeight: isToday ? 700 : 400 }}>
                          {d.short}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top messages + Top sessions côte à côte sur grand écran */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                {/* Top messages récurrents */}
                <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", border: "1px solid #F0EBE3" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6358", marginBottom: 8 }}>
                    Messages les plus fréquents
                  </div>
                  {dash.topMessages.length === 0 ? (
                    <div style={{ fontSize: 11, color: "#9A8E82", fontStyle: "italic" }}>—</div>
                  ) : dash.topMessages.map(([msg, n], i) => {
                    const pct = Math.round((n / dash.total) * 100);
                    return (
                      <div key={i} style={{ marginBottom: i < dash.topMessages.length - 1 ? 8 : 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                          <code style={{ fontSize: 10, color: "#1A1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontFamily: "ui-monospace, monospace" }}>
                            {msg || "(vide)"}
                          </code>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#1A1612" }}>{n}</span>
                          <span style={{ fontSize: 10, color: "#9A8E82" }}>{pct}%</span>
                        </div>
                        <div style={{ height: 4, background: "#F0EBE3", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: pct > 30 ? "#b91c1c" : pct > 10 ? "#b45309" : "#9A8E82" }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Top sessions affectées */}
                <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", border: "1px solid #F0EBE3" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6358", marginBottom: 8 }}>
                    Sessions les plus touchées
                  </div>
                  {dash.topSessions.length === 0 ? (
                    <div style={{ fontSize: 11, color: "#9A8E82", fontStyle: "italic" }}>—</div>
                  ) : dash.topSessions.map(([sid, info], i) => (
                    <div key={sid} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "5px 0", borderBottom: i < dash.topSessions.length - 1 ? "1px solid #F0EBE3" : "none" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 11, color: "#1A1612", fontFamily: "ui-monospace, monospace" }}>{sid.slice(0, 8)}…</div>
                        <div style={{ fontSize: 10, color: "#9A8E82", marginTop: 1 }}>{detectDevice(info.ua)} · {fmtDT(info.lastAt)}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: info.count >= 5 ? "#b91c1c" : "#1A1612", flexShrink: 0 }}>
                        {info.count} {info.count === 1 ? "erreur" : "erreurs"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
