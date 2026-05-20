import { fmtDT, relTime } from "../../lib/admin/format.js"

// Vue rétention/churn : les inscriptions sans la vue du churn = pilotage à
// l'aveugle. On affiche deux choses complémentaires :
//   - les dormants (users avec ≥1 devis mais sans activité depuis 14j+)
//     → cible de relance commerciale immédiate.
//   - les cohortes mensuelles (% d'inscrits de chaque mois encore actifs
//     dans la dernière fenêtre de 30j) → pilotage produit / activation.
export default function AdminRetention({ data, loading, onRefresh, embedded = false }) {
  const Container = embedded ? "div" : "section"
  return (
    <Container style={{ background: embedded ? "transparent" : "white", borderRadius: 14, padding: embedded ? 0 : "14px 16px" }}>
      {!embedded && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Rétention & churn</div>
          <button onClick={onRefresh} style={{ background: "#F5F0E8", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#6B6358", cursor: "pointer" }}>↻</button>
        </div>
      )}

      {loading && <div style={{ color: "#9A8E82", fontSize: 12, padding: "8px 0" }}>Chargement…</div>}

      {!loading && data?.meta?.rpcMissing && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 10, fontSize: 11, color: "#92400e", marginBottom: 12 }}>
          ⚠ RPC <code>admin_last_activity_per_owner</code> indisponible — applique la migration <b>0051</b> dans Supabase pour des données fraîches. En attendant, fallback sur <code>last_sign_in_at</code> (périmé sur PWA).
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── Résumé cohortes ────────────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9A8E82", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>
              Cohortes d'inscription (% encore actifs sur les {data.meta?.activeWindowDays || 30} derniers jours)
            </div>
            {(data.cohorts || []).length === 0 ? (
              <div style={{ fontSize: 12, color: "#9A8E82", padding: 8 }}>Aucune cohorte.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {data.cohorts.map(c => {
                  const pct = c.retentionPct
                  const color = pct >= 60 ? "#22c55e" : pct >= 30 ? "#f59e0b" : "#ef4444"
                  return (
                    <div key={c.month} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
                      <div style={{ width: 64, fontWeight: 600, color: "#6B6358" }}>{c.month}</div>
                      <div style={{ flex: 1, height: 18, background: "#F0EBE3", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width .3s" }} />
                      </div>
                      <div style={{ width: 110, textAlign: "right", color: "#6B6358" }}>
                        <b style={{ color }}>{pct}%</b> · {c.stillActive}/{c.signups}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Liste dormants ────────────────────────────────────────── */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9A8E82", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Dormants ({data.dormants?.length || 0})
              </div>
              <div style={{ fontSize: 10, color: "#9A8E82" }}>
                Sans activité depuis ≥ {data.meta?.dormantThresholdDays || 14}j · ≥1 devis créé
              </div>
            </div>
            {(data.dormants || []).length === 0 ? (
              <div style={{ fontSize: 12, color: "#9A8E82", padding: 16, textAlign: "center" }}>
                Aucun dormant 🎉
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.dormants.map(u => (
                  <div key={u.id} style={{ background: "white", borderRadius: 10, padding: "8px 12px", boxShadow: "0 1px 3px rgba(0,0,0,.04)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.name}
                        {u.plan === "pro" && (
                          <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 6px", borderRadius: 10, background: "rgba(34,197,94,.15)", color: "#15803d", fontWeight: 700 }}>PRO</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "#9A8E82", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.email} · {u.devisTotal} devis · inscrit {fmtDT(u.joinedAt)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: u.daysSince > 60 ? "#ef4444" : u.daysSince > 30 ? "#f59e0b" : "#6B6358" }}>
                        {u.daysSince != null ? `${u.daysSince}j` : "—"}
                      </div>
                      <div style={{ fontSize: 9, color: "#9A8E82" }}>{u.lastActivity ? relTime(u.lastActivity) : "jamais"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Container>
  )
}
