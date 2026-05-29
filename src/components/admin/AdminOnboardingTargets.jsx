import { useState, useEffect, useRef } from "react"
import { fmtDT, relTime } from "../../lib/admin/format.js"
import { getToken } from "../../lib/getToken.js"

// Comptes inscrits qui n'ont pas encore créé de devis : cible idéale du mail
// tutoriel de bienvenue (relance manuelle depuis le panel). L'admin clique
// "Envoyer" sur une ligne → POST /api/admin-stats action send_welcome_tuto
// → la Edge Function welcome-email envoie via Resend. Le bouton se grise une
// fois l'envoi tracé (profiles.welcome_tuto_resent_at) pour éviter le spam.
export default function AdminOnboardingTargets({ data, loading, onRefresh, embedded = false }) {
  const Container = embedded ? "div" : "section"
  const [sending, setSending]   = useState({}) // user_id → bool
  const [resentAt, setResentAt] = useState({}) // user_id → ISO (override local data)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, fail: 0 })
  const [err, setErr]           = useState("")
  // Flag d'unmount : si l'admin ferme/replie la section pendant un sendAll
  // en cours, on stoppe la boucle pour éviter d'envoyer des mails au-delà
  // de ce que l'admin pensait, et de setState sur composant démonté.
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const targets = data?.targets || []

  // Le bouton "Envoyer" est désactivé si on a déjà tracé un envoi pour ce
  // user (en base ou via override local après envoi de cette session).
  const isAlreadySent = (t) => !!(resentAt[t.id] || t.welcomeTutoResentAt)

  const sendOne = async (userId) => {
    setErr("")
    setSending(prev => ({ ...prev, [userId]: true }))
    try {
      const token = await getToken()
      const r = await fetch("/api/admin-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "send_welcome_tuto", user_id: userId }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d?.error || `HTTP ${r.status}`)
      setResentAt(prev => ({ ...prev, [userId]: d.sent_at }))
      return true
    } catch (e) {
      setErr(`Échec pour ${userId.slice(0, 8)} : ${e.message || e}`)
      return false
    } finally {
      setSending(prev => ({ ...prev, [userId]: false }))
    }
  }

  const sendAll = async () => {
    const todo = targets.filter(t => !isAlreadySent(t))
    if (todo.length === 0) return
    const ok = window.confirm(`Envoyer le mail tuto à ${todo.length} compte${todo.length > 1 ? "s" : ""} ? Ceux qui ont déjà reçu une relance sont automatiquement ignorés.`)
    if (!ok) return
    setBulkRunning(true)
    setBulkProgress({ done: 0, total: todo.length, fail: 0 })
    let done = 0, fail = 0
    for (const t of todo) {
      if (!mountedRef.current) break  // section fermée → stop la boucle
      const success = await sendOne(t.id)
      done++
      if (!success) fail++
      if (mountedRef.current) setBulkProgress({ done, total: todo.length, fail })
      // Petite pause pour ne pas saturer Resend / la Edge Function
      await new Promise(r => setTimeout(r, 300))
    }
    if (mountedRef.current) setBulkRunning(false)
  }

  const pendingCount = targets.filter(t => !isAlreadySent(t)).length
  const sentCount    = targets.filter(t => isAlreadySent(t)).length

  return (
    <Container style={{ background: embedded ? "transparent" : "white", borderRadius: 14, padding: embedded ? 0 : "14px 16px" }}>
      {!embedded && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Onboarding — comptes sans devis</div>
          <button onClick={onRefresh} style={{ background: "#F5F0E8", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#6B6358", cursor: "pointer" }}>↻</button>
        </div>
      )}

      {loading && <div style={{ color: "#9A8E82", fontSize: 12, padding: "8px 0" }}>Chargement…</div>}

      {!loading && data && (
        <>
          {/* Résumé + bouton bulk */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, color: "#6B6358" }}>
              <b style={{ color: "#1A1612" }}>{targets.length}</b> compte{targets.length > 1 ? "s" : ""} sans devis
              {sentCount > 0 && <> · <span style={{ color: "#16a34a" }}>{sentCount} relancé{sentCount > 1 ? "s" : ""}</span></>}
              {pendingCount > 0 && <> · <span style={{ color: "#d97706" }}>{pendingCount} en attente</span></>}
            </div>
            {pendingCount > 0 && (
              <button
                onClick={sendAll}
                disabled={bulkRunning}
                style={{
                  background: bulkRunning ? "#cbd5e1" : "#16a34a",
                  color: "white", border: "none", borderRadius: 8, padding: "6px 12px",
                  fontSize: 11, fontWeight: 700, cursor: bulkRunning ? "not-allowed" : "pointer",
                }}>
                {bulkRunning
                  ? `Envoi… ${bulkProgress.done}/${bulkProgress.total}${bulkProgress.fail ? ` (${bulkProgress.fail} fail)` : ""}`
                  : `📧 Envoyer tuto aux ${pendingCount}`}
              </button>
            )}
          </div>

          {err && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 8, fontSize: 11, color: "#991b1b", marginBottom: 10 }}>
              {err}
            </div>
          )}

          {targets.length === 0 ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12, fontSize: 12, color: "#166534" }}>
              ✓ Aucun compte sans devis — tout le monde a passé le premier cap.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {targets.map(t => {
                const sent = isAlreadySent(t)
                const sentTs = resentAt[t.id] || t.welcomeTutoResentAt
                return (
                  <div key={t.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", background: "white",
                    border: `1px solid ${sent ? "#dcfce7" : "#F0EBE3"}`,
                    borderRadius: 8, fontSize: 11,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 600, color: "#1A1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.name}
                        </span>
                        {t.plan === "pro" && (
                          <span style={{ fontSize: 9, background: "#C97B5C", color: "white", padding: "1px 6px", borderRadius: 8, fontWeight: 700 }}>
                            PRO
                          </span>
                        )}
                      </div>
                      <div style={{ color: "#6B6358", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.email} · inscrit {relTime(t.joinedAt)}
                        {t.lastSignInAt && <> · vu {relTime(t.lastSignInAt)}</>}
                      </div>
                      {sent && sentTs && (
                        <div style={{ color: "#16a34a", marginTop: 2, fontWeight: 600 }}>
                          ✓ Tuto envoyé le {fmtDT(sentTs)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => sendOne(t.id)}
                      disabled={sent || sending[t.id] || bulkRunning}
                      style={{
                        background: sent ? "#F5F0E8" : (sending[t.id] ? "#cbd5e1" : "#1A1612"),
                        color: sent ? "#9A8E82" : "white",
                        border: "none", borderRadius: 6, padding: "5px 10px",
                        fontSize: 10, fontWeight: 700,
                        cursor: (sent || sending[t.id] || bulkRunning) ? "not-allowed" : "pointer",
                        flexShrink: 0, whiteSpace: "nowrap",
                      }}>
                      {sending[t.id] ? "…" : sent ? "✓ Envoyé" : "Envoyer"}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </Container>
  )
}
