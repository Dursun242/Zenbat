import { fmtDT, relTime } from "../../lib/admin/format.js";

export default function AdminConversations({ iaConvs, loading, convSearch, setConvSearch, openConvUser, setOpenConvUser, onRefresh }) {
  const byUser = new Map();
  for (const c of (iaConvs || [])) {
    const key = c.owner_id || "anon";
    if (!byUser.has(key)) byUser.set(key, { owner_id: key, name: c.name, email: c.email, items: [] });
    byUser.get(key).items.push(c);
  }
  const groups = Array.from(byUser.values())
    .map(g => ({ ...g, items: [...g.items].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) }))
    .filter(g => {
      if (!convSearch) return true;
      const q = convSearch.toLowerCase();
      return (g.name || "").toLowerCase().includes(q) || (g.email || "").toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.items.at(-1)?.created_at || 0) - new Date(a.items.at(-1)?.created_at || 0));
  const totalMsg = (iaConvs || []).length;

  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", flex: 1 }}>
          Conversations IA{iaConvs ? ` (${totalMsg} msg · ${groups.length} compte${groups.length > 1 ? "s" : ""})` : ""}
        </div>
        <input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="Filtrer…"
          style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#0f172a", background: "#f8fafc", width: 120 }}/>
        <button onClick={onRefresh} disabled={loading}
          style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#475569", cursor: "pointer", fontWeight: 600 }}>
          {loading ? "…" : "↻"}
        </button>
      </div>

      {iaConvs === null && !loading && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>Appliquez la migration 0006 pour activer ce journal.</div>
      )}
      {iaConvs && groups.length === 0 && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>Aucune conversation pour l'instant.</div>
      )}

      {groups.map((g, i) => {
        const open       = openConvUser === g.owner_id;
        const last       = g.items.at(-1);
        const firstDevis = g.items.filter(x => x.had_devis).length;
        return (
          <div key={g.owner_id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "white" : "#fafbfc" }}>
            <button onClick={() => setOpenConvUser(open ? null : g.owner_id)}
              style={{ width: "100%", background: "none", border: "none", padding: "12px 16px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name || "—"}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.email || "—"}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: "#f1f5f9", color: "#475569", fontWeight: 700 }}>
                  {g.items.length} msg
                </span>
                {firstDevis > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: "rgba(34,197,94,.12)", color: "#15803d", fontWeight: 700 }} title="devis générés">
                    ✓ {firstDevis}
                  </span>
                )}
                <span style={{ fontSize: 9, color: "#94a3b8", minWidth: 40, textAlign: "right" }}>{relTime(last?.created_at)}</span>
                <span style={{ color: open ? "#22c55e" : "#cbd5e1", fontSize: 14, lineHeight: 1, transition: "transform .2s", transform: open ? "rotate(45deg)" : "rotate(0)" }}>+</span>
              </div>
            </button>

            {open && (
              <div style={{ padding: "0 16px 14px 16px", display: "flex", flexDirection: "column", gap: 8, animation: "fadeUp .18s ease both" }}>
                {g.items.map(turn => (
                  <div key={turn.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {turn.user_message && (
                      <div style={{ alignSelf: "flex-end", maxWidth: "88%", background: "#0f172a", color: "white", borderRadius: "12px 12px 3px 12px", padding: "7px 11px", fontSize: 12, lineHeight: 1.5, wordBreak: "break-word" }}>
                        {turn.user_message}
                      </div>
                    )}
                    {turn.ai_response && (
                      <div style={{ alignSelf: "flex-start", maxWidth: "88%", background: "#f8fafc", color: "#1e293b", border: "1px solid #f1f5f9", borderRadius: "12px 12px 12px 3px", padding: "7px 11px", fontSize: 12, lineHeight: 1.5, wordBreak: "break-word" }}>
                        {turn.ai_response}
                        {turn.had_devis && <span style={{ display: "inline-block", marginLeft: 6, fontSize: 9, padding: "1px 6px", borderRadius: 10, background: "rgba(34,197,94,.12)", color: "#15803d", fontWeight: 700, verticalAlign: "middle" }}>devis ✓</span>}
                      </div>
                    )}
                    <div style={{ fontSize: 9, color: "#cbd5e1", alignSelf: "center", marginTop: 1 }}>
                      {fmtDT(turn.created_at)} · {new Date(turn.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      {turn.trade_names && ` · ${turn.trade_names}`}
                      {turn.model && ` · ${turn.model.replace(/^claude-/, "")}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
