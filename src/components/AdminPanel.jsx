import { useState, useEffect } from "react"
import { useAuth } from "../lib/auth.jsx"
import { getToken } from "../lib/getToken.js"
import { fmtD } from "../lib/admin/format.js"
import AdminKPIs         from "./admin/AdminKPIs.jsx"
import AdminUsersTable   from "./admin/AdminUsersTable.jsx"
import AdminErrorLogs    from "./admin/AdminErrorLogs.jsx"
import AdminNegativeLogs from "./admin/AdminNegativeLogs.jsx"
import AdminConversations from "./admin/AdminConversations.jsx"
import AdminNewsletter    from "./admin/AdminNewsletter.jsx"
import AdminCoherenceStats from "./admin/AdminCoherenceStats.jsx"
import AdminFeedback       from "./admin/AdminFeedback.jsx"
import AdminAgentBenchmark from "./admin/AdminAgentBenchmark.jsx"
import AdminQuotesSent    from "./admin/AdminQuotesSent.jsx"
import Collapsible        from "./admin/Collapsible.jsx"
import DeleteUserModal    from "./admin/DeleteUserModal.jsx"
import UserDetailDrawer  from "./admin/UserDetailDrawer.jsx"

export default function AdminPanel({ onBack }) {
  const { session, user: currentUser } = useAuth()
  const [stats,        setStats]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [iaLogs,       setIaLogs]       = useState(null)
  const [logsLoading,  setLogsLoading]  = useState(false)
  const [iaNegs,       setIaNegs]       = useState(null)
  const [negsLoading,  setNegsLoading]  = useState(false)
  const [negFilter,    setNegFilter]    = useState("all")
  const [iaConvs,          setIaConvs]          = useState(null)
  const [convsLoading,     setConvsLoading]     = useState(false)
  const [newsletter,       setNewsletter]       = useState(null)
  const [newsletterLoading,setNewsletterLoading]= useState(false)
  const [coherence,        setCoherence]        = useState(null)
  const [coherenceLoading, setCoherenceLoading] = useState(false)
  const [feedback,         setFeedback]         = useState(null)
  const [feedbackLoading,  setFeedbackLoading]  = useState(false)
  const [quotesSent,       setQuotesSent]       = useState(null)
  const [quotesSentLoading,setQuotesSentLoading]= useState(false)
  const [openConvUser, setOpenConvUser] = useState(null)
  const [convSearch,   setConvSearch]   = useState("")
  const [userSearch,   setUserSearch]   = useState("")
  const [sortBy,       setSortBy]       = useState("joined")
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteMode,   setDeleteMode]   = useState("delete") // 'delete' | 'reset_data'
  const [confirmInput, setConfirmInput] = useState("")
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState(null)
  const [detailUser,   setDetailUser]   = useState(null)
  const [detailData,   setDetailData]   = useState(null)
  const [detailLoading,setDetailLoading]= useState(false)
  const [detailError,  setDetailError]  = useState(null)
  const [detailTab,    setDetailTab]    = useState("overview")
  const [planToggling, setPlanToggling] = useState(false)

  useEffect(() => { if (session) { load() } }, [session?.access_token])

  // Belt-and-suspenders : si l'identité change pendant que le panel est
  // monté (logout admin → login utilisateur normal sans démontage), on
  // purge immédiatement toutes les données chargées pour éviter qu'un
  // compte non-admin voie les stats de l'admin précédent. App.jsx gate
  // déjà ce composant via isAdmin, mais on se prémunit contre un edge
  // case de re-render asynchrone.
  useEffect(() => {
    setStats(null); setIaLogs(null); setIaNegs(null); setIaConvs(null)
    setNewsletter(null); setCoherence(null); setFeedback(null); setQuotesSent(null)
    setOpenConvUser(null); setDetailUser(null); setDetailData(null)
  }, [currentUser?.id])

  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase()
  const callerEmail = (currentUser?.email || "").trim().toLowerCase()
  if (adminEmail && callerEmail && callerEmail !== adminEmail) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, color: "#555" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Accès refusé</div>
          <div style={{ fontSize: 14, color: "#888" }}>Cette section est réservée à l'administrateur.</div>
        </div>
      </div>
    )
  }

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-stats", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Erreur serveur")
      setStats(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-stats?type=logs", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setIaLogs(data.logs || [])
    } catch {} finally { setLogsLoading(false) }
  }

  const loadNegs = async () => {
    setNegsLoading(true)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-stats?type=negatives", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setIaNegs(data.logs || [])
    } catch {} finally { setNegsLoading(false) }
  }

  const loadConvs = async () => {
    setConvsLoading(true)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-stats?type=conversations", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setIaConvs(data.conversations || [])
    } catch {} finally { setConvsLoading(false) }
  }

  const loadNewsletter = async () => {
    setNewsletterLoading(true)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-stats?type=newsletter", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setNewsletter(data.subscribers || [])
    } catch {} finally { setNewsletterLoading(false) }
  }

  const loadCoherence = async () => {
    setCoherenceLoading(true)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-stats?type=coherence", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setCoherence(data)
    } catch {} finally { setCoherenceLoading(false) }
  }

  const loadFeedback = async () => {
    setFeedbackLoading(true)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-stats?type=feedback", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setFeedback(data.feedback || [])
    } catch {} finally { setFeedbackLoading(false) }
  }

  const loadQuotesSent = async () => {
    setQuotesSentLoading(true)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-stats?type=quotes_sent", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setQuotesSent(data.quotes_sent || [])
    } catch {} finally { setQuotesSentLoading(false) }
  }

  const openDelete = (u) => { setDeleteMode("delete"); setDeleteTarget(u); setConfirmInput(""); setDeleteError(null) }
  const openReset  = (u) => { setDeleteMode("reset_data"); setDeleteTarget(u); setConfirmInput(""); setDeleteError(null) }

  const openDetail = async (u) => {
    setDetailUser(u); setDetailData(null); setDetailError(null)
    setDetailTab("overview"); setDetailLoading(true)
    try {
      const token = await getToken()
      const res  = await fetch(`/api/admin-user-detail?userId=${encodeURIComponent(u.id)}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Erreur serveur")
      setDetailData(data)
    } catch (e) {
      setDetailError(e.message || "Impossible de charger le détail")
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => { setDetailUser(null); setDetailData(null); setDetailError(null) }

  // Bascule manuelle du plan d'un user (override admin, indépendant de Stripe).
  // Met à jour profile.plan en DB puis met à jour optimistiquement detailData
  // pour que le drawer reflète immédiatement le nouveau plan (badge + libellé
  // du bouton). La liste d'users est rafraîchie au prochain reload de stats.
  const toggleUserPlan = async (newPlan) => {
    if (!detailUser || planToggling) return
    setPlanToggling(true)
    try {
      const token = await getToken()
      const res   = await fetch("/api/admin-user-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "set_plan", userId: detailUser.id, plan: newPlan }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data?.error || "Échec du changement de plan"); return }
      setDetailData(prev => prev ? { ...prev, profile: { ...(prev.profile || {}), plan: data.plan } } : prev)
    } catch (e) {
      alert(e?.message || "Erreur réseau")
    } finally {
      setPlanToggling(false)
    }
  }
  const closeDelete = () => { if (deleting) return; setDeleteTarget(null); setConfirmInput(""); setDeleteError(null) }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true); setDeleteError(null)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: deleteTarget.id, confirmEmail: confirmInput, mode: deleteMode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Erreur serveur")
      if (deleteMode === "delete") {
        setStats(s => s ? { ...s, usersDetail: s.usersDetail.filter(u => u.id !== deleteTarget.id) } : s)
      }
      setDeleteTarget(null); setConfirmInput("")
      load()
      // Si on était en train de regarder le détail de ce user, on le rafraîchit
      // pour voir 0 devis / 0 factures après reset.
      if (detailUser && detailUser.id === deleteTarget.id) {
        if (deleteMode === "delete") closeDetail()
        else openDetail(detailUser)
      }
    } catch (e) {
      setDeleteError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const filteredUsers = (stats?.usersDetail || [])
    .filter(u => {
      if (!userSearch) return true
      const q = userSearch.toLowerCase()
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.fullName || "").toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (["joined", "lastSignIn", "lastDevis"].includes(sortBy)) return new Date(b[sortBy] || 0) - new Date(a[sortBy] || 0)
      if (sortBy === "name") return (a.fullName || a.name || "").localeCompare(b.fullName || b.name || "", "fr")
      if (sortBy === "accepte") return (b.byStatut?.accepte || 0) - (a.byStatut?.accepte || 0)
      return (b[sortBy] || 0) - (a[sortBy] || 0)
    })

  return (
    <div style={{ minHeight: "100%", background: "#FAF7F2", paddingBottom: 40 }}>
      <div style={{ background: "#1A1612", padding: "14px 18px 16px", paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10, boxShadow: "0 2px 12px rgba(26,22,18,.18)" }}>
        <button onClick={onBack} aria-label="Retour"
          style={{ background: "#2A231C", border: "none", color: "#9A8E82", cursor: "pointer", padding: 8, borderRadius: 8, display: "flex", alignItems: "center" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,5 5,12 12,19"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px", fontFamily: "'Syne', sans-serif" }}>Panel Admin</div>
          <div style={{ color: "#9A8E82", fontSize: 10, letterSpacing: "0.5px", textTransform: "uppercase", marginTop: 1 }}>Vue globale Zenbat</div>
        </div>
        <button onClick={load}
          style={{ background: "#2A231C", border: "1px solid #3D3028", borderRadius: 8, padding: "6px 12px", color: "#C97B5C", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 13 }}>↻</span> Actualiser
        </button>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "#9A8E82", fontSize: 13 }}>Chargement…</div>}
      {error && (
        <div style={{ margin: 18, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 16, color: "#991b1b", fontSize: 13 }}>
          ❌ {error}
        </div>
      )}

      {stats && (
        <div style={{ padding: 16 }}>

          {/* KPIs héros + détails repliés à l'intérieur — toujours visible */}
          <AdminKPIs stats={stats} />

          {/* Utilisateurs : avec recherche, c'est le coeur du travail admin */}
          <AdminUsersTable
            users={filteredUsers}
            userSearch={userSearch}    setUserSearch={setUserSearch}
            sortBy={sortBy}            setSortBy={setSortBy}
            currentUserId={currentUser?.id}
            onOpenDetail={openDetail}  onOpenDelete={openDelete}
          />

          {/* Sections secondaires repliables — chargées seulement à l'ouverture */}
          <Collapsible title="Devis envoyés"   subtitle="Historique des envois email aux clients"
            count={quotesSent?.length}        loaded={quotesSent !== null} onExpand={loadQuotesSent}>
            <AdminQuotesSent data={quotesSent} loading={quotesSentLoading} onRefresh={loadQuotesSent} embedded />
          </Collapsible>

          <Collapsible title="Conversations IA" subtitle="Échanges utilisateurs ↔ agent"
            count={iaConvs?.length}            loaded={iaConvs !== null}    onExpand={loadConvs}>
            <AdminConversations
              iaConvs={iaConvs}      loading={convsLoading}
              convSearch={convSearch} setConvSearch={setConvSearch}
              openConvUser={openConvUser} setOpenConvUser={setOpenConvUser}
              onRefresh={loadConvs}            />
          </Collapsible>

          <Collapsible title="Erreurs IA"      subtitle="Appels Claude qui ont échoué"
            count={iaLogs?.length}             loaded={iaLogs !== null}     onExpand={loadLogs}>
            <AdminErrorLogs iaLogs={iaLogs} loading={logsLoading} onRefresh={loadLogs} embedded />
          </Collapsible>

          <Collapsible title="Retours négatifs" subtitle="Mauvais devis générés signalés par les users"
            count={iaNegs?.length}             loaded={iaNegs !== null}     onExpand={loadNegs}>
            <AdminNegativeLogs iaNegs={iaNegs} loading={negsLoading} negFilter={negFilter} setNegFilter={setNegFilter} onRefresh={loadNegs} embedded />
          </Collapsible>

          <Collapsible title="Newsletter"      subtitle="Inscrits depuis la landing page"
            count={newsletter?.length}         loaded={newsletter !== null} onExpand={loadNewsletter}>
            <AdminNewsletter subscribers={newsletter} loading={newsletterLoading} onRefresh={loadNewsletter} embedded />
          </Collapsible>

          <Collapsible title="Cohérence devis IA" subtitle="Détection automatique d'anomalies"
            loaded={coherence !== null} onExpand={loadCoherence}>
            <AdminCoherenceStats data={coherence} loading={coherenceLoading} onRefresh={loadCoherence} embedded />
          </Collapsible>

          <Collapsible title="Feedback utilisateurs" subtitle="Pouces ↑ / ↓ sur les réponses IA"
            count={feedback?.length} loaded={feedback !== null} onExpand={loadFeedback}>
            <AdminFeedback data={feedback} loading={feedbackLoading} onRefresh={loadFeedback} embedded />
          </Collapsible>

          <Collapsible title="Benchmark Agent IA" subtitle="Tests de prompts comparés">
            <AdminAgentBenchmark embedded />
          </Collapsible>

          <div style={{ textAlign: "center", fontSize: 10, color: "#9A8E82", marginTop: 16 }}>
            Données du {fmtD(stats.generatedAt)} à {new Date(stats.generatedAt).toLocaleTimeString("fr-FR")}
          </div>
        </div>
      )}

      {detailUser && (
        <UserDetailDrawer
          user={detailUser}    data={detailData}       loading={detailLoading}
          error={detailError}  tab={detailTab}         onTabChange={setDetailTab}
          onClose={closeDetail}
          onRequestDelete={() => { closeDetail(); openDelete(detailUser); }}
          onRequestReset={() => { openReset(detailUser); }}
          onTogglePlan={toggleUserPlan}
          planToggling={planToggling}
          currentUserId={currentUser?.id}
        />
      )}

      {deleteTarget && (
        <DeleteUserModal
          target={deleteTarget}  mode={deleteMode}
          confirmInput={confirmInput}  setConfirmInput={setConfirmInput}
          deleting={deleting}    error={deleteError}          onClose={closeDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}
