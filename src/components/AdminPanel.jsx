import { useState, useEffect } from "react"
import { useAuth } from "../lib/auth.jsx"

export default function AdminPanel({ onBack }) {
  const { session, user: currentUser } = useAuth()
  const [stats,      setStats]      = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [userSearch, setUserSearch] = useState("")
  const [sortBy,     setSortBy]     = useState("joined")
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, name, email, devisTotal, caTotal }
  const [confirmInput, setConfirmInput] = useState("")
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState(null)

  useEffect(() => { if (session) load() }, [session?.access_token])

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

  const openDelete = (u) => { setDeleteTarget(u); setConfirmInput(""); setDeleteError(null) }
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
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
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
              <div key={u.id} style={{padding:"12px 16px", borderBottom:"1px solid #f8fafc", background:i%2===0?"white":"#fafbfc"}}>
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{u.name}</div>
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

          <div style={{textAlign:"center", fontSize:10, color:"#cbd5e1"}}>
            Données du {fmtD(stats.generatedAt)} à {new Date(stats.generatedAt).toLocaleTimeString("fr-FR")}
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
