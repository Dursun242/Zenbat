import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase.js"
import { getToken } from "../../lib/getToken.js"
import DeleteAccountModal from "./DeleteAccountModal.jsx"
import { ZB } from "../../lib/theme.js"
import { btnSecondary } from "../ui/Register.jsx"

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
      if (!token) throw new Error("Tu dois être connecté.")
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
      setExportMsg("Archive téléchargée — conserve-la dans un endroit sûr.")
    } catch (e) {
      setExportMsg("Erreur : " + (e.message || "export impossible"))
    } finally {
      setExportBusy(false)
    }
  }

  const deleteMyAccount = async () => {
    setDeleteBusy(true); setDeleteError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error("Session expirée — reconnecte-toi.")
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
      <div className="pop" style={{background:ZB.sheet,border:`1px solid ${ZB.rule}`,borderRadius:8}}>

        {/* Export RGPD */}
        <section style={{padding:18}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:14}}>
            <span style={{color:ZB.ink2,display:"flex",flexShrink:0,marginTop:1}}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </span>
            <div style={{flex:1}}>
              <h3 style={{fontSize:16,fontWeight:700,color:ZB.ink,marginBottom:4}}>Télécharger mes données (RGPD art. 20)</h3>
              <p style={{fontSize:14,color:ZB.ink2,lineHeight:1.45}}>
                Archive JSON complète : profil, clients, devis, factures, conversations IA, journaux. Tu peux la conserver ou la transférer vers un autre service.
              </p>
            </div>
          </div>
          <button type="button" onClick={exportMyData} disabled={exportBusy}
            style={{...btnSecondary,width:"100%",opacity:exportBusy?0.6:1,cursor:exportBusy?"not-allowed":"pointer"}}>
            {exportBusy ? "Préparation de l'archive…" : "Télécharger mon archive JSON"}
          </button>
          {exportMsg && (
            <p role="status" style={{marginTop:10,fontSize:14,fontWeight:600,color:exportMsg.startsWith("Erreur")?ZB.danger:ZB.stamp}}>{exportMsg}</p>
          )}
        </section>

        {/* Suppression compte */}
        <section style={{padding:18,borderTop:`1px solid ${ZB.rule}`}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:14}}>
            <span style={{color:ZB.danger,display:"flex",flexShrink:0,marginTop:1}}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            </span>
            <div style={{flex:1}}>
              <h3 style={{fontSize:16,fontWeight:700,color:ZB.ink,marginBottom:4}}>Supprimer mon compte (RGPD art. 17)</h3>
              <p style={{fontSize:14,color:ZB.ink2,lineHeight:1.45}}>
                Action <strong style={{color:ZB.danger}}>irréversible</strong>. Sera supprimé : profil, clients, devis, brouillons, conversations IA. Les factures émises sont conservées en archive (LPF L102 B — 10 ans) sans accès en lecture.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => { setDeleteOpen(true); setDeleteConfirm(""); setDeleteError(null) }}
            style={{...btnSecondary,width:"100%",color:ZB.danger,borderColor:ZB.danger}}>
            Supprimer mon compte définitivement
          </button>
        </section>

        <p style={{fontSize:14,color:ZB.ink2,lineHeight:1.5,padding:"14px 18px",borderTop:`1px solid ${ZB.rule}`}}>
          Tu peux aussi exercer tes autres droits RGPD (rectification, limitation, opposition, plainte CNIL) via le <a href="/contact" style={{color:ZB.accent,fontWeight:600}}>formulaire de contact</a>.
        </p>
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
