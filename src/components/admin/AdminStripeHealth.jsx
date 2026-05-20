import { fmtDT, relTime, fmtEur } from "../../lib/admin/format.js"

// Vue santé revenue Stripe — données live depuis l'API Stripe (pas du
// cache DB). Trois cas qui méritent attention immédiate :
//   - past_due : paiement échoué récemment, le user va churn s'il ne
//     met pas sa carte à jour. À relancer DIRECTEMENT.
//   - cancelingActive : a cliqué "annuler", encore actif jusqu'à la fin
//     de la période. Cible de winback avant désactivation.
//   - recentlyCanceled : déjà parti depuis ≤ 90j. Diag des causes.
export default function AdminStripeHealth({ data, loading, onRefresh, embedded = false }) {
  const Container = embedded ? "div" : "section"
  return (
    <Container style={{ background: embedded ? "transparent" : "white", borderRadius: 14, padding: embedded ? 0 : "14px 16px" }}>
      {!embedded && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Santé revenue Stripe</div>
          <button onClick={onRefresh} style={{ background: "#F5F0E8", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#6B6358", cursor: "pointer" }}>↻</button>
        </div>
      )}

      {loading && <div style={{ color: "#9A8E82", fontSize: 12, padding: "8px 0" }}>Chargement Stripe…</div>}

      {!loading && data && (
        <>
          {/* ── KPI summary ───────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 16 }}>
            {[
              { l: "MRR live",            v: fmtEur(data.summary.mrrEur),               c: "#22c55e" },
              { l: "Abonnements actifs",  v: data.summary.activeCount,                  c: "#0ea5e9" },
              { l: "Past due",            v: data.summary.pastDueCount,                 c: data.summary.pastDueCount ? "#ef4444" : "#9A8E82" },
              { l: "À churner",           v: data.summary.cancelingCount,               c: data.summary.cancelingCount ? "#f59e0b" : "#9A8E82" },
              { l: "Churn ce mois",       v: data.summary.churnThisMonth,               c: "#7c3aed" },
              { l: "Churn 90j",           v: data.summary.recentlyCanceled90d,          c: "#6B6358" },
            ].map(k => (
              <div key={k.l} style={{ background: "white", borderRadius: 10, padding: "10px 12px", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                <div style={{ fontSize: 9, color: "#9A8E82", letterSpacing: "0.3px", textTransform: "uppercase" }}>{k.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.c, marginTop: 2 }}>{k.v}</div>
              </div>
            ))}
          </div>

          <Bucket title="Paiements échoués (past_due)" subtitle="Carte refusée — relancer pour éviter le churn" tone="danger" subs={data.pastDue} />
          <Bucket title="À churner — annulation programmée" subtitle="Encore actifs jusqu'à expiration de la période" tone="warn" subs={data.cancelingActive} />
          <Bucket title="Churns récents (90 derniers jours)" subtitle="Diagnostic des causes" tone="neutral" subs={data.recentlyCanceled} />
        </>
      )}
    </Container>
  )
}

function Bucket({ title, subtitle, tone, subs }) {
  const toneColor = tone === "danger" ? "#ef4444" : tone === "warn" ? "#f59e0b" : "#9A8E82"
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: toneColor, letterSpacing: "0.5px", textTransform: "uppercase" }}>
          {title} ({subs?.length || 0})
        </div>
        <div style={{ fontSize: 10, color: "#9A8E82" }}>{subtitle}</div>
      </div>
      {!subs || subs.length === 0 ? (
        <div style={{ fontSize: 11, color: "#9A8E82", padding: 8, textAlign: "center" }}>Aucun.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {subs.map(s => (
            <div key={s.id} style={{ background: "white", borderRadius: 8, padding: "7px 10px", boxShadow: "0 1px 2px rgba(0,0,0,.03)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                  {!s.zenbat_link && (
                    <span title="Pas de profil Zenbat lié à ce customer Stripe" style={{ marginLeft: 6, fontSize: 9, padding: "1px 6px", borderRadius: 10, background: "#fef2f2", color: "#b91c1c", fontWeight: 700 }}>orphan</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: "#9A8E82", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.email || "—"}
                  {s.amount_monthly != null && (
                    <> · {fmtEur(s.amount_monthly)}/{s.interval === "year" ? "an" : "mois"}</>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, fontSize: 10, color: "#9A8E82" }}>
                {tone === "danger" && s.current_period_end && (
                  <div style={{ color: "#ef4444", fontWeight: 700 }}>Expire {relTime(s.current_period_end)}</div>
                )}
                {tone === "warn" && s.current_period_end && (
                  <div style={{ color: "#f59e0b", fontWeight: 700 }}>Fin {fmtDT(s.current_period_end)}</div>
                )}
                {tone === "neutral" && s.canceled_at && (
                  <div>Parti {relTime(s.canceled_at)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
