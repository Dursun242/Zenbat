import { useState, useEffect } from "react"
import { useAuth } from "../lib/auth.jsx"

export default function AdminPanel({ onBack }) {
  const { session, user: currentUser } = useAuth()
  const [stats,      setStats]      = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [iaLogs,     setIaLogs]     = useState(null)
  const [logsLoading,setLogsLoading]= useState(false)
  const [iaNegs,     setIaNegs]     = useState(null)
  const [negsLoading,setNegsLoading]= useState(false)
  const [negFilter,  setNegFilter]  = useState("all") // all | ai_refusal | user_negative
  const [iaConvs,    setIaConvs]    = useState(null)
  const [convsLoading,setConvsLoading]= useState(false)
  const [openConvUser,setOpenConvUser]= useState(null)
  const [convSearch, setConvSearch] = useState("")
  const [userSearch, setUserSearch] = useState("")
  const [sortBy,     setSortBy]     = useState("joined")
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, name, email, devisTotal, caTotal }
  const [confirmInput, setConfirmInput] = useState("")
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState(null)
  // Drill-down utilisateur
  const [detailUser,   setDetailUser]   = useState(null)   // entrée du tableau usersDetail
  const [detailData,   setDetailData]   = useState(null)   // payload renvoyé par /api/admin-user-detail
  const [detailLoading,setDetailLoading]= useState(false)
  const [detailError,  setDetailError]  = useState(null)
  const [detailTab,    setDetailTab]    = useState("overview")

  useEffect(() => { if (session) { load(); loadLogs(); loadNegs(); loadConvs() } }, [session?.access_token])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/admin-stats", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Erreur serveur")
      setStats(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      const res = await fetch("/api/admin-ia-data?type=logs", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (res.ok) setIaLogs(data.logs || [])
    } catch {} finally { setLogsLoading(false) }
  }

  const loadNegs = async () => {
    setNegsLoading(true)
    try {
      const res = await fetch("/api/admin-ia-data?type=negatives", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (res.ok) setIaNegs(data.logs || [])
    } catch {} finally { setNegsLoading(false) }
  }

  const loadConvs = async () => {
    setConvsLoading(true)
    try {
      const res = await fetch("/api/admin-ia-data?type=conversations", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (res.ok) setIaConvs(data.conversations || [])
    } catch {} finally { setConvsLoading(false) }
  }

  const openDelete = (u) => { setDeleteTarget(u); setConfirmInput(""); setDeleteError(null) }

  const openDetail = async (u) => {
    setDetailUser(u); setDetailData(null); setDetailError(null)
    setDetailTab("overview"); setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin-user-detail?userId=${encodeURIComponent(u.id)}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
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
      const res = await fetch("/api/admin-delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId: deleteTarget.id, confirmEmail: confirmInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Erreur serveur")
      // Retire localement et rafraîchit
      setStats(s => s ? { ...s, usersDetail: s.usersDetail.filter(u => u.id !== deleteTarget.id) } : s)
      setDeleteTarget(null); setConfirmInput("")
      load()
    } catch (e) {
      setDeleteError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const fmtEur  = n => new Intl.NumberFormat("fr-FR", { style:"currency", currency:"EUR", maximumFractionDigits:0 }).format(n||0)
  const fmtD    = d => d ? new Date(d).toLocaleDateString("fr-FR") : "—"
  const fmtDT   = d => d ? new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"2-digit" }) : "—"
  const pct     = (a, b) => b ? Math.round((a / b) * 100) : 0
  const relTime = d => {
    if (!d) return "—"
    const days = Math.floor((Date.now() - new Date(d)) / 86400000)
    if (days === 0) return "Auj."
    if (days === 1) return "Hier"
    if (days < 30)  return `${days}j`
    if (days < 365) return `${Math.floor(days/30)}m`
    return `${Math.floor(days/365)}a`
  }

  const SC = { brouillon:"#94a3b8", envoye:"#3b82f6", en_signature:"#f59e0b", accepte:"#22c55e", refuse:"#ef4444" }
  const SL = { brouillon:"Brou.", envoye:"Env.", en_signature:"Sig.", accepte:"Acc.", refuse:"Ref." }

  const SORT_OPTS = [
    { v:"joined",      l:"Inscription" },
    { v:"lastSignIn",  l:"Connexion" },
    { v:"caTotal",     l:"CA" },
    { v:"devisTotal",  l:"Devis" },
    { v:"ai_used",     l:"IA" },
  ]

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

  const card = (label, value, sub, color="#0f172a", small=false) => (
    <div style={{background:"white", borderRadius:14, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
      <div style={{fontSize:10, color:"#94a3b8", marginBottom:4}}>{label}</div>
      <div style={{fontSize:small?13:22, fontWeight:800, color, lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:10, color:"#cbd5e1", marginTop:4}}>{sub}</div>}
    </div>
  )

  return (
    <div style={{minHeight:"100%", background:"#f8fafc", paddingBottom:40}} className="fu">
      <div style={{background:"#0f172a", padding:"14px 18px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10}}>
        <button onClick={onBack} style={{background:"none", border:"none", color:"#94a3b8", cursor:"pointer", padding:4}}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,5 5,12 12,19"/></svg>
        </button>
        <div style={{flex:1}}>
          <div style={{color:"white", fontWeight:700, fontSize:16}}>Panel Admin</div>
          <div style={{color:"#475569", fontSize:10}}>Vue globale Zenbat</div>
        </div>
        <button onClick={load} style={{background:"#1e293b", border:"1px solid #334155", borderRadius:8, padding:"5px 10px", color:"#94a3b8", fontSize:11, cursor:"pointer"}}>↻ Actualiser</button>
      </div>

      {loading && <div style={{padding:40, textAlign:"center", color:"#94a3b8", fontSize:13}}>Chargement…</div>}

      {error && (
        <div style={{margin:18, background:"#fef2f2", border:"1px solid #fecaca", borderRadius:12, padding:16, color:"#991b1b", fontSize:13}}>
          ❌ {error}
        </div>
      )}

      {stats && (
        <div style={{padding:16}}>
          <div style={{fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.5px", textTransform:"uppercase", marginBottom:8}}>Revenus & Croissance</div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16}}>
            {card("MRR (abonnements)", fmtEur(stats.users.mrr), `${stats.users.pro} abonné(s) Pro × 19 €`, "#22c55e", true)}
            {card("CA signé HT", fmtEur(stats.devis.caAccepte), `${stats.devis.byStatut.accepte} devis acceptés`, "#0ea5e9", true)}
            {card("CA en cours HT", fmtEur(stats.devis.caEnCours), "envoyés + signature", "#f59e0b", true)}
            {card("Valeur moy. devis", fmtEur(stats.devis.avgDevisValue), "sur devis acceptés", "#7c3aed", true)}
          </div>

          <div style={{fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.5px", textTransform:"uppercase", marginBottom:8}}>Utilisateurs</div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16}}>
            {card("Total inscrits",  stats.users.total.toLocaleString("fr-FR"),      `+${stats.users.newThisMonth} ce mois / +${stats.users.newLast7} cette semaine`)}
            {card("Abonnés Pro",     stats.users.pro.toLocaleString("fr-FR"),         `${pct(stats.users.pro, stats.users.total)}% de conversion`, "#22c55e")}
            {card("Actifs (≥1 devis)", stats.users.activeUsers.toLocaleString("fr-FR"), `${pct(stats.users.activeUsers, stats.users.total)}% des inscrits`, "#0ea5e9")}
            {card("Essai ≤7j restants", stats.users.trialEndingSoon.toLocaleString("fr-FR"), "à relancer en priorité", "#f59e0b")}
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16}}>
            {card("Appels IA total", stats.users.totalAiUsed.toLocaleString("fr-FR"), `moy. ${stats.users.total ? Math.round(stats.users.totalAiUsed/stats.users.total) : 0} / user`, "#7c3aed")}
            {card("Inscrits mois-1", stats.users.newLastMonth.toLocaleString("fr-FR"), "mois précédent")}
          </div>

          <div style={{fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.5px", textTransform:"uppercase", marginBottom:8}}>Devis cette semaine</div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16}}>
            {card("Créés (7j)", stats.devis.devisLast7.toLocaleString("fr-FR"), `vs ${stats.devis.devisPrev7} sem. précédente`)}
            {card("Tendance",
              stats.devis.trendDevis !== null ? `${stats.devis.trendDevis > 0 ? "+" : ""}${stats.devis.trendDevis}%` : "—",
              "vs 7 jours précédents",
              stats.devis.trendDevis > 0 ? "#22c55e" : stats.devis.trendDevis < 0 ? "#ef4444" : "#64748b"
            )}
            {card("Total devis", stats.devis.total.toLocaleString("fr-FR"), `+${stats.devis.devisMonth} ce mois`)}
            {card("Taux conversion", `${stats.devis.txConversion}%`, `${stats.devis.byStatut.accepte} acceptés / ${stats.devis.total} total`, "#22c55e")}
          </div>

          <div style={{background:"white", borderRadius:14, padding:16, marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            <div style={{fontWeight:700, fontSize:13, color:"#0f172a", marginBottom:14}}>Entonnoir de conversion</div>
            {[
              { label:"Inscrits",           n: stats.funnel.inscrits,    color:"#0ea5e9" },
              { label:"Ont créé un devis",  n: stats.funnel.avecDevis,   color:"#7c3aed" },
              { label:"Ont envoyé un devis",n: stats.funnel.devisEnvoye, color:"#f59e0b" },
              { label:"Devis accepté",      n: stats.funnel.devisAccepte,color:"#22c55e" },
            ].map((step, i, arr) => {
              const base = arr[0].n || 1
              const w    = Math.round((step.n / base) * 100)
              return (
                <div key={step.label} style={{marginBottom:10}}>
                  <div style={{display:"flex", justifyContent:"space-between", marginBottom:3}}>
                    <span style={{fontSize:12, color:"#374151"}}>{step.label}</span>
                    <span style={{fontSize:12, fontWeight:700, color:step.color}}>{step.n} <span style={{color:"#cbd5e1", fontWeight:400}}>({w}%)</span></span>
                  </div>
                  <div style={{height:8, background:"#f1f5f9", borderRadius:4, overflow:"hidden"}}>
                    <div style={{height:"100%", width:`${w}%`, background:step.color, borderRadius:4, minWidth:step.n>0?6:0, transition:"width .4s"}}/>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{textAlign:"right", fontSize:9, color:"#94a3b8", marginTop:2}}>
                      ↓ {arr[i+1].n > 0 ? `${pct(arr[i+1].n, step.n)}% passent à l'étape suivante` : "aucun"}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{background:"white", borderRadius:14, padding:16, marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            <div style={{fontWeight:700, fontSize:13, color:"#0f172a", marginBottom:12}}>Répartition des devis par statut</div>
            {Object.entries(stats.devis.byStatut).map(([s, n]) => (
              <div key={s} style={{marginBottom:10}}>
                <div style={{display:"flex", justifyContent:"space-between", marginBottom:3}}>
                  <span style={{fontSize:12, color:"#374151"}}>{{ brouillon:"Brouillon", envoye:"Envoyé", en_signature:"En signature", accepte:"Accepté", refuse:"Refusé" }[s]}</span>
                  <span style={{fontSize:12, fontWeight:600, color:SC[s]}}>{n} ({pct(n, stats.devis.total)}%)</span>
                </div>
                <div style={{height:6, background:"#f1f5f9", borderRadius:3, overflow:"hidden"}}>
                  <div style={{height:"100%", width:`${pct(n, stats.devis.total)}%`, background:SC[s], borderRadius:3, minWidth:n>0?4:0}}/>
                </div>
              </div>
            ))}
          </div>

          <div style={{background:"white", borderRadius:14, overflow:"hidden", marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            <div style={{padding:"12px 16px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
              <div style={{fontWeight:700, fontSize:13, color:"#0f172a", flex:1}}>Utilisateurs ({filteredUsers.length})</div>
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Chercher…"
                style={{border:"1px solid #e2e8f0", borderRadius:8, padding:"4px 10px", fontSize:12, color:"#0f172a", background:"#f8fafc", width:120}}/>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{border:"1px solid #e2e8f0", borderRadius:8, padding:"4px 8px", fontSize:11, color:"#374151", background:"#f8fafc"}}>
                {SORT_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>

            {filteredUsers.length === 0 && (
              <div style={{padding:24, textAlign:"center", color:"#94a3b8", fontSize:12}}>Aucun utilisateur</div>
            )}

            {filteredUsers.map((u, i) => (
              <div key={u.id} style={{padding:"12px 16px", borderBottom:"1px solid #f8fafc", background:i%2===0?"white":"#fafbfc", cursor:"pointer"}}
                onClick={(e) => { if (!e.target.closest("button")) openDetail(u); }}>
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                      {u.fullName || u.name}
                    </div>
                    {u.fullName && u.name && u.fullName !== u.name && (
                      <div style={{fontSize:11, color:"#475569", fontWeight:500, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{u.name}</div>
                    )}
                    <div style={{fontSize:10, color:"#94a3b8", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{u.email}</div>
                  </div>
                  <div style={{textAlign:"right", flexShrink:0}}>
                    <span style={{fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20, display:"inline-block", background:u.plan==="pro"?"rgba(34,197,94,.12)":"#f1f5f9", color:u.plan==="pro"?"#15803d":"#64748b"}}>
                      {u.plan==="pro"?"PRO":"FREE"}
                    </span>
                    {u.daysLeft !== null && u.daysLeft <= 10 && (
                      <div style={{fontSize:9, color: u.daysLeft<=3?"#ef4444":"#f59e0b", marginTop:2, fontWeight:600}}>{u.daysLeft}j restants</div>
                    )}
                  </div>
                </div>
                <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6}}>
                  {[
                    { l:"CA signé",   v: fmtEur(u.caTotal),                  c: u.caTotal > 0 ? "#0ea5e9" : "#cbd5e1" },
                    { l:"Devis",      v: u.devisTotal,                        c: u.devisTotal > 0 ? "#374151" : "#cbd5e1" },
                    { l:"Taux conv.", v: u.devisTotal ? `${u.txConv}%` : "—", c: u.txConv >= 50 ? "#22c55e" : "#94a3b8" },
                    { l:"IA",         v: `${u.ai_used}×`,                     c: u.ai_used > 5 ? "#7c3aed" : "#94a3b8" },
                  ].map(m => (
                    <div key={m.l} style={{background:"#f8fafc", borderRadius:8, padding:"5px 8px", textAlign:"center"}}>
                      <div style={{fontSize:9, color:"#94a3b8"}}>{m.l}</div>
                      <div style={{fontSize:12, fontWeight:700, color:m.c, marginTop:1}}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex", gap:10, marginTop:7, alignItems:"center", flexWrap:"wrap"}}>
                  <div style={{fontSize:9, color:"#94a3b8"}}>
                    Inscrit <span style={{color:"#64748b", fontWeight:600}}>{fmtDT(u.joined)}</span>
                    {" · "}Vu <span style={{color:"#64748b", fontWeight:600}}>{relTime(u.lastSignIn)}</span>
                    {u.lastDevis && <>{" · "}Devis <span style={{color:"#64748b", fontWeight:600}}>{relTime(u.lastDevis)}</span></>}
                  </div>
                  {u.devisTotal > 0 && (
                    <div style={{display:"flex", gap:3, marginLeft:"auto"}}>
                      {Object.entries(u.byStatut).filter(([,n]) => n > 0).map(([s, n]) => (
                        <span key={s} title={`${SL[s]}: ${n}`} style={{fontSize:9, padding:"1px 5px", borderRadius:10, background:`${SC[s]}22`, color:SC[s], fontWeight:700}}>
                          {SL[s]} {n}
                        </span>
                      ))}
                    </div>
                  )}
                  {u.id !== currentUser?.id && (
                    <button onClick={() => openDelete(u)}
                      title="Supprimer définitivement ce compte"
                      style={{marginLeft:u.devisTotal>0?0:"auto", background:"#fef2f2", border:"1px solid #fecaca", color:"#b91c1c", borderRadius:8, padding:"3px 8px", fontSize:10, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4}}>
                      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Journal des erreurs IA */}
          <div style={{background:"white", borderRadius:14, overflow:"hidden", marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            <div style={{padding:"12px 16px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:8}}>
              <div style={{fontWeight:700, fontSize:13, color:"#0f172a", flex:1}}>
                Erreurs Agent IA {iaLogs ? `(${iaLogs.length})` : ""}
              </div>
              <button onClick={loadLogs} disabled={logsLoading}
                style={{background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#475569", cursor:"pointer", fontWeight:600}}>
                {logsLoading ? "…" : "↻"}
              </button>
            </div>
            {iaLogs === null && !logsLoading && (
              <div style={{padding:16, textAlign:"center", fontSize:11, color:"#94a3b8"}}>Appliquez la migration 0004 pour activer le journal.</div>
            )}
            {iaLogs && iaLogs.length === 0 && (
              <div style={{padding:16, textAlign:"center", fontSize:11, color:"#94a3b8"}}>Aucune erreur enregistrée 🎉</div>
            )}
            {iaLogs && iaLogs.slice(0, 50).map((l, i) => (
              <div key={l.id} style={{padding:"10px 16px", borderBottom:"1px solid #f8fafc", background:i%2===0?"white":"#fafbfc"}}>
                <div style={{display:"flex", alignItems:"baseline", gap:8, marginBottom:3, flexWrap:"wrap"}}>
                  <span style={{fontSize:11, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis"}}>{l.name}</span>
                  <span style={{fontSize:9, color:"#94a3b8"}}>{l.email}</span>
                  <span style={{marginLeft:"auto", fontSize:9, color:"#94a3b8"}}>{fmtDT(l.created_at)} · {new Date(l.created_at).toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"})}</span>
                </div>
                <div style={{fontSize:11, color:"#b91c1c", fontFamily:"ui-monospace,monospace", wordBreak:"break-word"}}>{l.error}</div>
                {l.user_message && (
                  <div style={{fontSize:10, color:"#64748b", marginTop:4, fontStyle:"italic", overflow:"hidden", textOverflow:"ellipsis"}}>
                    « {l.user_message.slice(0, 180)}{l.user_message.length > 180 ? "…" : ""} »
                  </div>
                )}
                {l.history_len != null && (
                  <div style={{fontSize:9, color:"#94a3b8", marginTop:3}}>
                    Historique : {l.history_len} msg · Streaming : {l.stream_tried ? "tenté" : "non"}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Réponses négatives (refus IA + messages usagers) */}
          <div style={{background:"white", borderRadius:14, overflow:"hidden", marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            <div style={{padding:"12px 16px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
              <div style={{fontWeight:700, fontSize:13, color:"#0f172a", flex:1}}>
                Réponses négatives {iaNegs ? `(${iaNegs.filter(n => negFilter === "all" || n.kind === negFilter).length})` : ""}
              </div>
              <select value={negFilter} onChange={e => setNegFilter(e.target.value)}
                style={{border:"1px solid #e2e8f0", borderRadius:8, padding:"4px 8px", fontSize:11, color:"#374151", background:"#f8fafc"}}>
                <option value="all">Tous</option>
                <option value="ai_refusal">Refus IA</option>
                <option value="user_negative">Mécontent</option>
              </select>
              <button onClick={loadNegs} disabled={negsLoading}
                style={{background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#475569", cursor:"pointer", fontWeight:600}}>
                {negsLoading ? "…" : "↻"}
              </button>
            </div>
            {iaNegs === null && !negsLoading && (
              <div style={{padding:16, textAlign:"center", fontSize:11, color:"#94a3b8"}}>Appliquez la migration 0005 pour activer ce journal.</div>
            )}
            {iaNegs && iaNegs.filter(n => negFilter === "all" || n.kind === negFilter).length === 0 && (
              <div style={{padding:16, textAlign:"center", fontSize:11, color:"#94a3b8"}}>Aucun signal négatif sur cette période 🎉</div>
            )}
            {iaNegs && iaNegs.filter(n => negFilter === "all" || n.kind === negFilter).slice(0, 50).map((n, i) => {
              const isRefusal = n.kind === "ai_refusal"
              const bg  = isRefusal ? "#f1f5f9" : "#fef2f2"
              const fg  = isRefusal ? "#475569" : "#b91c1c"
              const tag = isRefusal ? "Refus IA" : "Usager mécontent"
              return (
                <div key={n.id} style={{padding:"10px 16px", borderBottom:"1px solid #f8fafc", background:i%2===0?"white":"#fafbfc"}}>
                  <div style={{display:"flex", alignItems:"baseline", gap:8, marginBottom:3, flexWrap:"wrap"}}>
                    <span style={{fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20, background:bg, color:fg}}>{tag}</span>
                    <span style={{fontSize:11, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis"}}>{n.name}</span>
                    <span style={{fontSize:9, color:"#94a3b8"}}>{n.email}</span>
                    <span style={{marginLeft:"auto", fontSize:9, color:"#94a3b8"}}>{fmtDT(n.created_at)} · {new Date(n.created_at).toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"})}</span>
                  </div>
                  {n.user_message && (
                    <div style={{fontSize:11, color:"#0f172a", marginTop:4, wordBreak:"break-word"}}>
                      <span style={{fontSize:9, color:"#94a3b8", fontWeight:600, marginRight:6}}>USR</span>
                      « {n.user_message.slice(0, 220)}{n.user_message.length > 220 ? "…" : ""} »
                    </div>
                  )}
                  {n.ai_response && (
                    <div style={{fontSize:11, color:"#475569", marginTop:4, fontStyle:"italic", wordBreak:"break-word"}}>
                      <span style={{fontSize:9, color:"#94a3b8", fontWeight:600, marginRight:6, fontStyle:"normal"}}>IA</span>
                      {n.ai_response.slice(0, 220)}{n.ai_response.length > 220 ? "…" : ""}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Conversations IA compte-par-compte */}
          {(() => {
            // Groupe les conversations par owner_id, trie les users par
            // dernière activité, et filtre par recherche nom/email.
            const byUser = new Map()
            for (const c of (iaConvs || [])) {
              const key = c.owner_id || "anon"
              if (!byUser.has(key)) byUser.set(key, { owner_id: key, name: c.name, email: c.email, items: [] })
              byUser.get(key).items.push(c)
            }
            const groups = Array.from(byUser.values())
              .map(g => ({ ...g, items: [...g.items].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) }))
              .filter(g => {
                if (!convSearch) return true
                const q = convSearch.toLowerCase()
                return (g.name || "").toLowerCase().includes(q) || (g.email || "").toLowerCase().includes(q)
              })
              .sort((a, b) => new Date(b.items.at(-1)?.created_at || 0) - new Date(a.items.at(-1)?.created_at || 0))
            const totalMsg = (iaConvs || []).length

            return (
              <div style={{background:"white", borderRadius:14, overflow:"hidden", marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
                <div style={{padding:"12px 16px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
                  <div style={{fontWeight:700, fontSize:13, color:"#0f172a", flex:1}}>
                    Conversations IA{iaConvs ? ` (${totalMsg} msg · ${groups.length} compte${groups.length > 1 ? "s" : ""})` : ""}
                  </div>
                  <input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="Filtrer…"
                    style={{border:"1px solid #e2e8f0", borderRadius:8, padding:"4px 10px", fontSize:12, color:"#0f172a", background:"#f8fafc", width:120}}/>
                  <button onClick={loadConvs} disabled={convsLoading}
                    style={{background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#475569", cursor:"pointer", fontWeight:600}}>
                    {convsLoading ? "…" : "↻"}
                  </button>
                </div>

                {iaConvs === null && !convsLoading && (
                  <div style={{padding:16, textAlign:"center", fontSize:11, color:"#94a3b8"}}>Appliquez la migration 0006 pour activer ce journal.</div>
                )}
                {iaConvs && groups.length === 0 && (
                  <div style={{padding:16, textAlign:"center", fontSize:11, color:"#94a3b8"}}>Aucune conversation pour l'instant.</div>
                )}

                {groups.map((g, i) => {
                  const open = openConvUser === g.owner_id
                  const last = g.items.at(-1)
                  const firstDevis = g.items.filter(x => x.had_devis).length
                  return (
                    <div key={g.owner_id} style={{borderBottom:"1px solid #f8fafc", background:i%2===0?"white":"#fafbfc"}}>
                      <button onClick={() => setOpenConvUser(open ? null : g.owner_id)}
                        style={{width:"100%", background:"none", border:"none", padding:"12px 16px", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:10}}>
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{fontSize:12, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{g.name || "—"}</div>
                          <div style={{fontSize:10, color:"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{g.email || "—"}</div>
                        </div>
                        <div style={{textAlign:"right", flexShrink:0, display:"flex", gap:6, alignItems:"center"}}>
                          <span style={{fontSize:9, padding:"2px 7px", borderRadius:20, background:"#f1f5f9", color:"#475569", fontWeight:700}}>
                            {g.items.length} msg
                          </span>
                          {firstDevis > 0 && (
                            <span style={{fontSize:9, padding:"2px 7px", borderRadius:20, background:"rgba(34,197,94,.12)", color:"#15803d", fontWeight:700}} title="devis générés">
                              ✓ {firstDevis}
                            </span>
                          )}
                          <span style={{fontSize:9, color:"#94a3b8", minWidth:40, textAlign:"right"}}>{relTime(last?.created_at)}</span>
                          <span style={{color:open ? "#22c55e" : "#cbd5e1", fontSize:14, lineHeight:1, transition:"transform .2s", transform:open ? "rotate(45deg)" : "rotate(0)"}}>+</span>
                        </div>
                      </button>

                      {open && (
                        <div style={{padding:"0 16px 14px 16px", display:"flex", flexDirection:"column", gap:8, animation:"fadeUp .18s ease both"}}>
                          {g.items.map(turn => (
                            <div key={turn.id} style={{display:"flex", flexDirection:"column", gap:4}}>
                              {turn.user_message && (
                                <div style={{alignSelf:"flex-end", maxWidth:"88%", background:"#0f172a", color:"white", borderRadius:"12px 12px 3px 12px", padding:"7px 11px", fontSize:12, lineHeight:1.5, wordBreak:"break-word"}}>
                                  {turn.user_message}
                                </div>
                              )}
                              {turn.ai_response && (
                                <div style={{alignSelf:"flex-start", maxWidth:"88%", background:"#f8fafc", color:"#1e293b", border:"1px solid #f1f5f9", borderRadius:"12px 12px 12px 3px", padding:"7px 11px", fontSize:12, lineHeight:1.5, wordBreak:"break-word"}}>
                                  {turn.ai_response}
                                  {turn.had_devis && <span style={{display:"inline-block", marginLeft:6, fontSize:9, padding:"1px 6px", borderRadius:10, background:"rgba(34,197,94,.12)", color:"#15803d", fontWeight:700, verticalAlign:"middle"}}>devis ✓</span>}
                                </div>
                              )}
                              <div style={{fontSize:9, color:"#cbd5e1", alignSelf:"center", marginTop:1}}>
                                {fmtDT(turn.created_at)} · {new Date(turn.created_at).toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"})}
                                {turn.trade_names && ` · ${turn.trade_names}`}
                                {turn.model && ` · ${turn.model.replace(/^claude-/, "")}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          <div style={{textAlign:"center", fontSize:10, color:"#cbd5e1"}}>
            Données du {fmtD(stats.generatedAt)} à {new Date(stats.generatedAt).toLocaleTimeString("fr-FR")}
          </div>
        </div>
      )}

      {detailUser && (
        <div onClick={closeDetail}
          style={{position:"fixed", inset:0, background:"rgba(15,23,42,.65)", backdropFilter:"blur(4px)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:90, animation:"fadeUp .15s ease both"}}>
          <div onClick={e => e.stopPropagation()}
            style={{background:"#f8fafc", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:720, maxHeight:"92vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 -20px 60px rgba(0,0,0,.35)"}}>

            {/* Header du drawer */}
            <div style={{background:"#0f172a", padding:"14px 18px calc(14px + env(safe-area-inset-top)) 18px", display:"flex", alignItems:"center", gap:12, flexShrink:0}}>
              <button onClick={closeDetail} style={{background:"none", border:"none", color:"#94a3b8", cursor:"pointer", padding:4, display:"flex", alignItems:"center"}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <div style={{flex:1, minWidth:0}}>
                <div style={{color:"white", fontWeight:700, fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                  {detailUser.fullName || detailUser.name}
                </div>
                <div style={{color:"#64748b", fontSize:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{detailUser.email}</div>
              </div>
              <span style={{fontSize:9, fontWeight:700, padding:"3px 8px", borderRadius:20, background:detailUser.plan==="pro"?"rgba(34,197,94,.18)":"rgba(148,163,184,.18)", color:detailUser.plan==="pro"?"#4ade80":"#94a3b8", flexShrink:0}}>
                {detailUser.plan==="pro"?"PRO":"FREE"}
              </span>
            </div>

            {/* Tabs */}
            {detailData && (
              <div style={{background:"white", borderBottom:"1px solid #e2e8f0", display:"flex", overflowX:"auto", flexShrink:0}}>
                {[
                  { k:"overview",  l:"Vue",            n: null },
                  { k:"devis",     l:"Devis",          n: detailData.stats.devisTotal },
                  { k:"invoices",  l:"Factures",       n: detailData.stats.invoicesTotal },
                  { k:"clients",   l:"Clients",        n: detailData.stats.clientsTotal },
                  { k:"conv",      l:"Conversations",  n: detailData.stats.conversations },
                  { k:"issues",    l:"Incidents",      n: detailData.stats.errors + detailData.stats.negatives },
                ].map(t => (
                  <button key={t.k} onClick={() => setDetailTab(t.k)}
                    style={{background:"none", border:"none", borderBottom:`2px solid ${detailTab===t.k ? "#22c55e" : "transparent"}`, padding:"10px 14px", fontSize:12, fontWeight:600, color:detailTab===t.k ? "#0f172a" : "#64748b", cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, display:"flex", alignItems:"center", gap:5}}>
                    {t.l}
                    {t.n !== null && <span style={{fontSize:9, color:"#94a3b8", fontWeight:500}}>({t.n})</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Body scrollable */}
            <div style={{flex:1, overflowY:"auto", padding:16}}>
              {detailLoading && <div style={{padding:40, textAlign:"center", color:"#94a3b8", fontSize:12}}>Chargement…</div>}
              {detailError && (
                <div style={{background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:12, color:"#991b1b", fontSize:12}}>❌ {detailError}</div>
              )}

              {detailData && detailTab === "overview" && (
                <div style={{display:"flex", flexDirection:"column", gap:12}}>
                  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                    {[
                      { l:"CA signé",      v:fmtEur(detailData.stats.caAccepte), c:"#0ea5e9" },
                      { l:"CA en cours",   v:fmtEur(detailData.stats.caEnCours), c:"#f59e0b" },
                      { l:"Devis",         v:detailData.stats.devisTotal,         c:"#7c3aed" },
                      { l:"Factures",      v:detailData.stats.invoicesTotal,      c:"#22c55e" },
                      { l:"Clients",       v:detailData.stats.clientsTotal,       c:"#374151" },
                      { l:"IA utilisée",   v:`${detailData.stats.aiUsed}×`,       c:"#ec4899" },
                    ].map(m => (
                      <div key={m.l} style={{background:"white", borderRadius:10, padding:"10px 12px", boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                        <div style={{fontSize:10, color:"#94a3b8"}}>{m.l}</div>
                        <div style={{fontSize:16, fontWeight:800, color:m.c, marginTop:2}}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{background:"white", borderRadius:10, padding:12, fontSize:11, color:"#475569", lineHeight:1.7}}>
                    <div><strong style={{color:"#0f172a"}}>Inscrit :</strong> {fmtDT(detailData.user.created_at)}</div>
                    <div><strong style={{color:"#0f172a"}}>Email confirmé :</strong> {detailData.user.confirmed_at ? fmtDT(detailData.user.confirmed_at) : "Non"}</div>
                    <div><strong style={{color:"#0f172a"}}>Dernière connexion :</strong> {detailData.user.last_sign_in_at ? relTime(detailData.user.last_sign_in_at) : "—"}</div>
                    {detailData.profile?.company_name && <div><strong style={{color:"#0f172a"}}>Société :</strong> {detailData.profile.company_name}</div>}
                    {detailData.profile?.brand_data?.trades?.length > 0 && (
                      <div><strong style={{color:"#0f172a"}}>Métiers :</strong> {detailData.profile.brand_data.trades.join(", ")}</div>
                    )}
                    {detailData.profile?.brand_data?.siret && <div><strong style={{color:"#0f172a"}}>SIRET :</strong> {detailData.profile.brand_data.siret}</div>}
                    {detailData.profile?.brand_data?.city && <div><strong style={{color:"#0f172a"}}>Ville :</strong> {detailData.profile.brand_data.city}</div>}
                    {detailData.profile?.brand_data?.phone && <div><strong style={{color:"#0f172a"}}>Téléphone :</strong> {detailData.profile.brand_data.phone}</div>}
                  </div>
                  {detailData.user.id !== currentUser?.id && (
                    <button onClick={() => { closeDetail(); openDelete(detailUser); }}
                      style={{background:"#fef2f2", border:"1px solid #fecaca", color:"#b91c1c", borderRadius:10, padding:"10px", fontSize:12, fontWeight:700, cursor:"pointer"}}>
                      🗑 Supprimer ce compte définitivement
                    </button>
                  )}
                </div>
              )}

              {detailData && detailTab === "devis" && (
                <div style={{display:"flex", flexDirection:"column", gap:8}}>
                  {detailData.devis.length === 0
                    ? <div style={{padding:20, textAlign:"center", color:"#94a3b8", fontSize:12}}>Aucun devis.</div>
                    : detailData.devis.map(d => (
                      <div key={d.id} style={{background:"white", borderRadius:10, padding:12, boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                        <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8}}>
                          <div style={{fontFamily:"monospace", fontSize:11, color:"#64748b"}}>{d.numero}</div>
                          <span style={{fontSize:9, padding:"1px 7px", borderRadius:20, background:`${SC[d.statut]||"#94a3b8"}22`, color:SC[d.statut]||"#94a3b8", fontWeight:700}}>{SL[d.statut]||d.statut}</span>
                        </div>
                        <div style={{fontSize:13, fontWeight:600, color:"#0f172a", marginTop:4}}>{d.objet || "Sans objet"}</div>
                        {d.ville_chantier && <div style={{fontSize:10, color:"#94a3b8"}}>{d.ville_chantier}</div>}
                        <div style={{display:"flex", justifyContent:"space-between", marginTop:6, fontSize:11, color:"#64748b"}}>
                          <span>{fmtDT(d.date_emission)}</span>
                          <span style={{fontWeight:700, color:"#0f172a"}}>{fmtEur(d.montant_ht)} HT</span>
                        </div>
                        {d.lignes?.length > 0 && (
                          <details style={{marginTop:8}}>
                            <summary style={{fontSize:11, color:"#64748b", cursor:"pointer"}}>{d.lignes.filter(l => l.type_ligne==="ouvrage").length} ligne(s)</summary>
                            <div style={{marginTop:6, fontSize:11, color:"#475569"}}>
                              {d.lignes.map(l => (
                                <div key={l.id} style={{padding:"3px 0", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", gap:8}}>
                                  <span style={{flex:1, color:l.type_ligne==="lot"?"#0f172a":"#475569", fontWeight:l.type_ligne==="lot"?700:400}}>
                                    {l.type_ligne==="lot" ? `▸ ${l.designation}` : l.designation}
                                  </span>
                                  {l.type_ligne==="ouvrage" && (
                                    <span style={{flexShrink:0}}>{l.quantite} {l.unite} × {fmtEur(l.prix_unitaire)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {detailData && detailTab === "invoices" && (
                <div style={{display:"flex", flexDirection:"column", gap:8}}>
                  {detailData.invoices.length === 0
                    ? <div style={{padding:20, textAlign:"center", color:"#94a3b8", fontSize:12}}>Aucune facture.</div>
                    : detailData.invoices.map(inv => (
                      <div key={inv.id} style={{background:"white", borderRadius:10, padding:12, boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                        <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8}}>
                          <div style={{fontFamily:"monospace", fontSize:11, color:"#64748b"}}>{inv.numero}{inv.avoir_of_invoice_id ? " · avoir" : ""}</div>
                          <div style={{display:"flex", gap:4}}>
                            {inv.locked && <span style={{fontSize:9, padding:"1px 6px", borderRadius:20, background:"#fef3c7", color:"#92400e", fontWeight:700}}>🔒</span>}
                            <span style={{fontSize:9, padding:"1px 7px", borderRadius:20, background:"#f1f5f9", color:"#475569", fontWeight:700}}>{inv.statut}</span>
                          </div>
                        </div>
                        <div style={{fontSize:13, fontWeight:600, color:"#0f172a", marginTop:4}}>{inv.objet || "Sans objet"}</div>
                        <div style={{display:"flex", justifyContent:"space-between", marginTop:6, fontSize:11, color:"#64748b"}}>
                          <span>{fmtDT(inv.date_emission)}</span>
                          <span style={{fontWeight:700, color:"#0f172a"}}>{fmtEur(inv.montant_ht)} HT · {fmtEur(inv.montant_ttc)} TTC</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {detailData && detailTab === "clients" && (
                <div style={{display:"flex", flexDirection:"column", gap:8}}>
                  {detailData.clients.length === 0
                    ? <div style={{padding:20, textAlign:"center", color:"#94a3b8", fontSize:12}}>Aucun client.</div>
                    : detailData.clients.map(c => (
                      <div key={c.id} style={{background:"white", borderRadius:10, padding:12, boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                        <div style={{fontSize:13, fontWeight:700, color:"#0f172a"}}>
                          {c.raison_sociale || `${c.prenom||""} ${c.nom||""}`.trim() || "—"}
                        </div>
                        <div style={{fontSize:11, color:"#64748b", marginTop:2}}>
                          {c.email || "—"}{c.telephone ? ` · ${c.telephone}` : ""}
                        </div>
                        <div style={{fontSize:10, color:"#94a3b8", marginTop:2}}>
                          {[c.ville, c.type==="entreprise"?"Entreprise":"Particulier"].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {detailData && detailTab === "conv" && (
                <div style={{display:"flex", flexDirection:"column", gap:8}}>
                  {detailData.conversations.length === 0
                    ? <div style={{padding:20, textAlign:"center", color:"#94a3b8", fontSize:12}}>Aucune conversation.</div>
                    : detailData.conversations.map(turn => (
                      <div key={turn.id} style={{display:"flex", flexDirection:"column", gap:4}}>
                        {turn.user_message && (
                          <div style={{alignSelf:"flex-end", maxWidth:"88%", background:"#0f172a", color:"white", borderRadius:"12px 12px 3px 12px", padding:"7px 11px", fontSize:12, lineHeight:1.5, wordBreak:"break-word"}}>{turn.user_message}</div>
                        )}
                        {turn.ai_response && (
                          <div style={{alignSelf:"flex-start", maxWidth:"88%", background:"white", color:"#1e293b", border:"1px solid #f1f5f9", borderRadius:"12px 12px 12px 3px", padding:"7px 11px", fontSize:12, lineHeight:1.5, wordBreak:"break-word"}}>
                            {turn.ai_response}
                            {turn.had_devis && <span style={{display:"inline-block", marginLeft:6, fontSize:9, padding:"1px 6px", borderRadius:10, background:"rgba(34,197,94,.12)", color:"#15803d", fontWeight:700}}>devis ✓</span>}
                          </div>
                        )}
                        <div style={{fontSize:9, color:"#cbd5e1", alignSelf:"center"}}>
                          {fmtDT(turn.created_at)} · {new Date(turn.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {detailData && detailTab === "issues" && (
                <div style={{display:"flex", flexDirection:"column", gap:12}}>
                  <div>
                    <div style={{fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:"0.5px", textTransform:"uppercase", marginBottom:6}}>Erreurs IA ({detailData.errors.length})</div>
                    {detailData.errors.length === 0 ? <div style={{fontSize:11, color:"#94a3b8"}}>Aucune erreur 🎉</div> : detailData.errors.map(e => (
                      <div key={e.id} style={{background:"white", borderRadius:10, padding:"8px 12px", marginBottom:6, boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                        <div style={{fontSize:11, color:"#b91c1c", fontFamily:"ui-monospace,monospace", wordBreak:"break-word"}}>{e.error}</div>
                        {e.user_message && <div style={{fontSize:10, color:"#64748b", marginTop:3, fontStyle:"italic"}}>« {e.user_message.slice(0,200)}{e.user_message.length>200?"…":""} »</div>}
                        <div style={{fontSize:9, color:"#94a3b8", marginTop:3}}>{fmtDT(e.created_at)}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:"0.5px", textTransform:"uppercase", marginBottom:6}}>Réponses négatives ({detailData.negatives.length})</div>
                    {detailData.negatives.length === 0 ? <div style={{fontSize:11, color:"#94a3b8"}}>Aucun signal négatif.</div> : detailData.negatives.map(n => (
                      <div key={n.id} style={{background:"white", borderRadius:10, padding:"8px 12px", marginBottom:6, boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                        <span style={{fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20, background:n.kind==="ai_refusal"?"#f1f5f9":"#fef2f2", color:n.kind==="ai_refusal"?"#475569":"#b91c1c"}}>
                          {n.kind==="ai_refusal"?"Refus IA":"Usager mécontent"}
                        </span>
                        {n.user_message && <div style={{fontSize:11, color:"#0f172a", marginTop:4}}>« {n.user_message.slice(0,200)}{n.user_message.length>200?"…":""} »</div>}
                        {n.ai_response && <div style={{fontSize:11, color:"#64748b", marginTop:2, fontStyle:"italic"}}>{n.ai_response.slice(0,200)}{n.ai_response.length>200?"…":""}</div>}
                        <div style={{fontSize:9, color:"#94a3b8", marginTop:3}}>{fmtDT(n.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div onClick={closeDelete}
          style={{position:"fixed", inset:0, background:"rgba(15,23,42,.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:18, zIndex:100, animation:"fadeUp .15s ease both"}}>
          <div onClick={e => e.stopPropagation()}
            style={{background:"white", borderRadius:16, maxWidth:420, width:"100%", padding:22, boxShadow:"0 24px 48px rgba(0,0,0,.3)"}}>
            <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:14}}>
              <div style={{width:42, height:42, borderRadius:12, background:"#fef2f2", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                <svg width="22" height="22" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:15, fontWeight:700, color:"#0f172a"}}>Supprimer ce compte ?</div>
                <div style={{fontSize:11, color:"#64748b", marginTop:2}}>Cette action est <strong style={{color:"#dc2626"}}>irréversible</strong>.</div>
              </div>
            </div>

            <div style={{background:"#f8fafc", borderRadius:12, padding:12, marginBottom:14}}>
              <div style={{fontSize:12, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{deleteTarget.name}</div>
              <div style={{fontSize:11, color:"#64748b", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{deleteTarget.email}</div>
              <div style={{display:"flex", gap:12, marginTop:8, fontSize:10, color:"#64748b", flexWrap:"wrap"}}>
                <span><strong style={{color:"#0f172a"}}>{deleteTarget.devisTotal}</strong> devis</span>
                <span><strong style={{color:"#0f172a"}}>{fmtEur(deleteTarget.caTotal)}</strong> de CA</span>
                <span>Plan <strong style={{color:deleteTarget.plan==="pro"?"#15803d":"#64748b"}}>{deleteTarget.plan==="pro"?"PRO":"FREE"}</strong></span>
              </div>
            </div>

            <div style={{fontSize:11, color:"#64748b", lineHeight:1.5, marginBottom:12}}>
              Seront supprimés : compte utilisateur, profil, clients, devis, lignes et PDF associés.
            </div>

            <label style={{display:"block", fontSize:11, fontWeight:600, color:"#374151", marginBottom:6}}>
              Saisissez l'email <strong style={{color:"#0f172a"}}>{deleteTarget.email}</strong> pour confirmer :
            </label>
            <input value={confirmInput} onChange={e => setConfirmInput(e.target.value)}
              placeholder={deleteTarget.email}
              disabled={deleting}
              autoFocus
              style={{width:"100%", border:"1px solid #e2e8f0", borderRadius:10, padding:"10px 12px", fontSize:13, outline:"none", marginBottom:12}}/>

            {deleteError && (
              <div style={{background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"8px 12px", fontSize:11, color:"#991b1b", marginBottom:12}}>
                ❌ {deleteError}
              </div>
            )}

            <div style={{display:"flex", gap:8}}>
              <button onClick={closeDelete} disabled={deleting}
                style={{flex:1, background:"#f1f5f9", color:"#374151", border:"none", borderRadius:10, padding:"10px", fontSize:12, fontWeight:700, cursor:deleting?"not-allowed":"pointer"}}>
                Annuler
              </button>
              <button onClick={confirmDelete}
                disabled={deleting || confirmInput.trim().toLowerCase() !== (deleteTarget.email || "").toLowerCase()}
                style={{flex:2, background: (deleting || confirmInput.trim().toLowerCase() !== (deleteTarget.email || "").toLowerCase()) ? "#fca5a5" : "#dc2626", color:"white", border:"none", borderRadius:10, padding:"10px", fontSize:12, fontWeight:700, cursor:"pointer"}}>
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
