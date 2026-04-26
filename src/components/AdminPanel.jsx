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
  const [openConvUser, setOpenConvUser] = useState(null)
  const [convSearch,   setConvSearch]   = useState("")
  const [userSearch,   setUserSearch]   = useState("")
  const [sortBy,       setSortBy]       = useState("joined")
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [confirmInput, setConfirmInput] = useState("")
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState(null)
  const [detailUser,   setDetailUser]   = useState(null)
  const [detailData,   setDetailData]   = useState(null)
  const [detailLoading,setDetailLoading]= useState(false)
  const [detailError,  setDetailError]  = useState(null)
  const [detailTab,    setDetailTab]    = useState("overview")

  useEffect(() => { if (session) { load(); loadLogs(); loadNegs(); loadConvs(); loadNewsletter() } }, [session?.access_token])

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
      const res  = await fetch("/api/admin-ia-data?type=logs", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setIaLogs(data.logs || [])
    } catch {} finally { setLogsLoading(false) }
  }

  const loadNegs = async () => {
    setNegsLoading(true)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-ia-data?type=negatives", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setIaNegs(data.logs || [])
    } catch {} finally { setNegsLoading(false) }
  }

  const loadConvs = async () => {
    setConvsLoading(true)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-ia-data?type=conversations", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setIaConvs(data.conversations || [])
    } catch {} finally { setConvsLoading(false) }
  }

  const loadNewsletter = async () => {
    setNewsletterLoading(true)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-ia-data?type=newsletter", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setNewsletter(data.subscribers || [])
    } catch {} finally { setNewsletterLoading(false) }
  }

  const openDelete = (u) => { setDeleteTarget(u); setConfirmInput(""); setDeleteError(null) }

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
  const closeDelete = () => { if (deleting) return; setDeleteTarget(null); setConfirmInput(""); setDeleteError(null) }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true); setDeleteError(null)
    try {
      const token = await getToken()
      const res  = await fetch("/api/admin-delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: deleteTarget.id, confirmEmail: confirmInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Erreur serveur")
      setStats(s => s ? { ...s, usersDetail: s.usersDetail.filter(u => u.id !== deleteTarget.id) } : s)
      setDeleteTarget(null); setConfirmInput("")
      load()
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
      if (sortBy === "joined" || sortBy === "lastSignIn") return new Date(b[sortBy] || 0) - new Date(a[sortBy] || 0)
      return (b[sortBy] || 0) - (a[sortBy] || 0)
    })

  return (
    <div style={{ minHeight: "100%", background: "#FAF7F2", paddingBottom: 40 }}>
      <div style={{ background: "#1A1612", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#9A8E82", cursor: "pointer", padding: 4 }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,5 5,12 12,19"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: 16 }}>Panel Admin</div>
          <div style={{ color: "#6B6358", fontSize: 10 }}>Vue globale Zenbat</div>
        </div>
        <button onClick={load} style={{ background: "#2A231C", border: "1px solid #3D3028", borderRadius: 8, padding: "5px 10px", color: "#9A8E82", fontSize: 11, cursor: "pointer" }}>↻ Actualiser</button>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "#9A8E82", fontSize: 13 }}>Chargement…</div>}
      {error && (
        <div style={{ margin: 18, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 16, color: "#991b1b", fontSize: 13 }}>
          ❌ {error}
        </div>
      )}

      {stats && (
        <div style={{ padding: 16 }}>
          <AdminKPIs stats={stats} />
          <AdminUsersTable
            users={filteredUsers}
            userSearch={userSearch}    setUserSearch={setUserSearch}
            sortBy={sortBy}            setSortBy={setSortBy}
            currentUserId={currentUser?.id}
            onOpenDetail={openDetail}  onOpenDelete={openDelete}
          />
          <AdminErrorLogs    iaLogs={iaLogs}  loading={logsLoading}  onRefresh={loadLogs} />
          <AdminNegativeLogs iaNegs={iaNegs}  loading={negsLoading}  negFilter={negFilter} setNegFilter={setNegFilter} onRefresh={loadNegs} />
          <AdminConversations
            iaConvs={iaConvs}      loading={convsLoading}
            convSearch={convSearch} setConvSearch={setConvSearch}
            openConvUser={openConvUser} setOpenConvUser={setOpenConvUser}
            onRefresh={loadConvs}
          />
          <AdminNewsletter
            subscribers={newsletter}  loading={newsletterLoading}
            onRefresh={loadNewsletter}
          />
          <div style={{ textAlign: "center", fontSize: 10, color: "#cbd5e1" }}>
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
          currentUserId={currentUser?.id}
        />
      )}

      {deleteTarget && (
        <DeleteUserModal
          target={deleteTarget}  confirmInput={confirmInput}  setConfirmInput={setConfirmInput}
          deleting={deleting}    error={deleteError}          onClose={closeDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}
