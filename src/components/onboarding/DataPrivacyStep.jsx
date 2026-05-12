import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase.js"
import { getToken } from "../../lib/getToken.js"
import DeleteAccountModal from "./DeleteAccountModal.jsx"

// Étape RGPD de l'onboarding (anciennement step===5 inliné dans Onboarding.jsx).
// Regroupe l'export portabilité (art. 20) et la suppression de compte
// (art. 17) via les endpoints /api/account.
export default function DataPrivacyStep() {
  const [exportBusy,    setExportBusy]    = useState(false)
  const [exportMsg,     setExportMsg]     = useState(null)
  const [deleteOpen,    setDeleteOpen]    = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleteBusy,    setDeleteBusy]    = useState(false)
  const [deleteError,   setDeleteError]   = useState(null)
  const [myEmail,       setMyEmail]       = useState("")

  // Récupère l'email courant pour la confirmation de suppression (1 seule fois)
  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(
      ({ data }) => { if (mounted && data?.user?.email) setMyEmail(data.user.email) },
      () => {},
    )
    return () => { mounted = false }
  }, [])

  const exportMyData = async () => {
    setExportBusy(true); setExportMsg(null)
    try {
      const token = await getToken()
      if (!token) throw new Error("Vous devez être connecté.")
      const res = await fetch("/api/account", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url
      a.download = `zenbat-export-${new Date().toISOString().slice(0,10)}.json`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 3000)
      setExportMsg("✓ Archive téléchargée — conservez-la dans un endroit sûr.")
    } catch (e) {
      setExportMsg("❌ " + (e.message || "Erreur d'export"))
    } finally {
      setExportBusy(false)
    }
  }

  const deleteMyAccount = async () => {
    setDeleteBusy(true); setDeleteError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error("Session expirée — reconnectez-vous.")
      const res = await fetch("/api/account", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ confirmEmail: deleteConfirm }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      await supabase.auth.signOut().catch(() => {})
      window.location.href = "/"
    } catch (e) {
      setDeleteError(e.message || "Erreur lors de la suppression")
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
      <div className="pop" style={{display:"flex",flexDirection:"column",gap:16}}>

        {/* Export RGPD */}
        <div style={{background:"#2A231C",border:"1px solid #3D3028",borderRadius:14,padding:16}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#0f2318",border:"1px solid rgba(34,197,94,.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#22c55e"}}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"white",marginBottom:3}}>Télécharger mes données (RGPD art. 20)</div>
              <div style={{fontSize:11,color:"#9A8E82",lineHeight:1.5}}>
                Archive JSON complète : profil, clients, devis, factures, conversations IA, journaux. Vous pouvez la conserver ou la transférer vers un autre service.
              </div>
            </div>
          </div>
          <button onClick={exportMyData} disabled={exportBusy}
            style={{width:"100%",background:exportBusy?"#3D3028":"#22c55e",color:exportBusy?"#9A8E82":"white",border:"none",borderRadius:12,padding:"11px",fontSize:13,fontWeight:700,cursor:exportBusy?"not-allowed":"pointer"}}>
            {exportBusy ? "Préparation de l'archive…" : "⬇ Télécharger mon archive JSON"}
          </button>
          {exportMsg && (
            <div style={{marginTop:10,fontSize:11,color:exportMsg.startsWith("❌")?"#fca5a5":"#86efac"}}>{exportMsg}</div>
          )}
        </div>

        {/* Suppression compte */}
        <div style={{background:"#2A231C",border:"1px solid #7f1d1d",borderRadius:14,padding:16}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#3f0e0e",border:"1px solid rgba(239,68,68,.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#ef4444"}}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"white",marginBottom:3}}>Supprimer mon compte (RGPD art. 17)</div>
              <div style={{fontSize:11,color:"#9A8E82",lineHeight:1.5}}>
                Action <strong style={{color:"#fca5a5"}}>irréversible</strong>. Sera supprimé : profil, clients, devis, brouillons, conversations IA. Les factures émises sont conservées en archive (LPF L102 B — 10 ans) sans accès en lecture.
              </div>
            </div>
          </div>
          <button onClick={() => { setDeleteOpen(true); setDeleteConfirm(""); setDeleteError(null) }}
            style={{width:"100%",background:"transparent",color:"#ef4444",border:"1px solid #7f1d1d",borderRadius:12,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            Supprimer mon compte définitivement
          </button>
        </div>

        <div style={{fontSize:10,color:"#6B6358",lineHeight:1.6,padding:"0 4px"}}>
          💡 Vous pouvez aussi exercer vos autres droits RGPD (rectification, limitation, opposition, plainte CNIL) via le <a href="/contact" style={{color:"#9A8E82"}}>formulaire de contact</a>.
        </div>
      </div>

      {deleteOpen && (
        <DeleteAccountModal
          myEmail={myEmail}
          confirm={deleteConfirm}
          setConfirm={setDeleteConfirm}
          busy={deleteBusy}
          error={deleteError}
          onClose={() => setDeleteOpen(false)}
          onConfirm={deleteMyAccount}
        />
      )}
    </>
  )
}
