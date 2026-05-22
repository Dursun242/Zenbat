import { useState, useEffect, useRef } from "react"
import { brandCompleteness } from "../lib/brandCompleteness.js"
import { isValidEmail } from "../lib/utils.js"
import { useAuth } from "../lib/auth.jsx"
import { Logo, STEPS } from "../components/onboarding/shared.jsx"
import BrandingStep    from "../components/onboarding/BrandingStep.jsx"
import TradesStep      from "../components/onboarding/TradesStep.jsx"
import ContactStep     from "../components/onboarding/ContactStep.jsx"
import StyleStep       from "../components/onboarding/StyleStep.jsx"
import LegalStep       from "../components/onboarding/LegalStep.jsx"
import DataPrivacyStep from "../components/onboarding/DataPrivacyStep.jsx"

// Persistance du brouillon d'onboarding : sans ça, un utilisateur qui
// abandonne à l'étape 3 sur 6 perd tout et recommence de zéro. La clé est
// scopée par user.id (cohérent avec appShell.js / AgentIA) et inclut un
// TTL de 7 jours pour ne pas restaurer un vieux brouillon à un utilisateur
// qui revient éditer son brand des mois plus tard.
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000
const draftKey = (userId) => `zenbat_onboarding_draft_${userId || "anon"}`

function readDraft(userId) {
  try {
    const raw = localStorage.getItem(draftKey(userId))
    if (!raw) return null
    const { step, local, savedAt } = JSON.parse(raw)
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(draftKey(userId))
      return null
    }
    return { step, local }
  } catch { return null }
}

function writeDraft(userId, step, local) {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify({ step, local, savedAt: Date.now() }))
  } catch {}
}

function clearDraft(userId) {
  try { localStorage.removeItem(draftKey(userId)) } catch {}
}

export default function Onboarding({ brand, setBrand, onDone }) {
  const { user } = useAuth()
  const userId = user?.id

  // Au premier mount : si un brouillon récent existe, on le restaure
  // (cas de l'utilisateur qui a abandonné à l'étape 3 et revient).
  // Sinon on part du brand actuel comme avant.
  const [step,  setStep]  = useState(() => readDraft(userId)?.step ?? 0)
  const [local, setLocal] = useState(() => readDraft(userId)?.local ?? { ...brand })
  const [tryNext, setTryNext] = useState(false)
  const set = (k, v) => setLocal(b => ({ ...b, [k]: v }))

  // Au mount, user peut ne pas être encore résolu : les initialiseurs
  // useState lisent alors le brouillon "anon" au lieu de celui de
  // l'utilisateur. On re-hydrate une seule fois dès que userId arrive.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current || !userId) return
    hydratedRef.current = true
    const draft = readDraft(userId)
    if (draft) {
      if (typeof draft.step === "number") setStep(draft.step)
      if (draft.local) setLocal(draft.local)
    }
  }, [userId])

  // Sauvegarde à chaque modification de step ou local.
  useEffect(() => {
    if (!userId) return
    writeDraft(userId, step, local)
  }, [userId, step, local])

  // Reset tryNext quand on change d'étape pour ne pas garder un état
  // d'erreur visible quand l'utilisateur revient en arrière.
  useEffect(() => { setTryNext(false) }, [step])

  const quality = brandCompleteness(local)
  const step0Invalid = !local.companyName?.trim()
  const step2Invalid = !isValidEmail(local.email)
  const canGoNext =
    step === 0 ? !step0Invalid :
    step === 2 ? !step2Invalid :
    true

  const save = () => {
    setBrand(local)
    clearDraft(userId)
    onDone()
  }
  const fontFamily = local.fontStyle==="elegant"?"Playfair Display":local.fontStyle==="tech"?"Space Grotesk":"DM Sans"

  return (
    <div style={{minHeight:"100vh",background:"#1A1612",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700&family=Space+Grotesk:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}input,select,textarea,button{font-family:inherit}@keyframes popIn{0%{opacity:0;transform:scale(.94)}100%{opacity:1;transform:scale(1)}}@keyframes spin{to{transform:rotate(360deg)}}.pop{animation:popIn .25s ease both}.noscroll::-webkit-scrollbar{display:none}`}</style>

      <div style={{padding:"calc(14px + env(safe-area-inset-top)) 20px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <Logo size={18} white/>
          <span style={{color:"#6B6358",fontSize:11,fontWeight:500}}>Étape {step+1} sur {STEPS.length}</span>
        </div>

        {/* Breadcrumb nommé cliquable (étapes précédentes seulement) */}
        <div className="noscroll" style={{display:"flex",alignItems:"center",gap:4,marginBottom:14,overflowX:"auto",scrollbarWidth:"none"}}>
          {STEPS.map((s,i)=>{
            const done    = i < step
            const current = i === step
            const go      = () => { if (i <= step) setStep(i) }
            return (
              <button key={i} onClick={go} disabled={i > step}
                style={{
                  flex:"1 0 auto",
                  background:"none",border:"none",padding:"4px 0",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:5,
                  cursor:i<=step?"pointer":"default",minWidth:56
                }}>
                <div style={{
                  width:22,height:22,borderRadius:"50%",
                  background: current ? "#22c55e" : done ? "#166534" : "#2A231C",
                  border: current ? "2px solid #86efac" : `1px solid ${done?"#22c55e":"#3D3028"}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:700,
                  color: current || done ? "white" : "#6B6358",
                  transition:"all .2s",
                  boxShadow: current ? "0 0 0 4px rgba(34,197,94,.15)" : "none"
                }}>
                  {done ? "✓" : i+1}
                </div>
                <span style={{
                  fontSize:10, lineHeight:1.2, textAlign:"center",
                  fontWeight: current ? 700 : 500,
                  color: current ? "#22c55e" : done ? "#86efac" : "#6B6358"
                }}>{s.short}</span>
              </button>
            )
          })}
        </div>

        {/* Progress bar fine */}
        <div style={{height:2,background:"#2A231C",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",background:"linear-gradient(90deg,#22c55e,#86efac)",borderRadius:2,transition:"width .4s ease",width:`${((step+1)/STEPS.length)*100}%`}}/>
        </div>
      </div>

      <div style={{flex:1,padding:"24px 20px 120px",overflowY:"auto"}}>
        <h2 style={{color:"white",fontSize:24,fontWeight:600,marginBottom:6,letterSpacing:"-0.5px",fontFamily:"'Syne',sans-serif"}} className="pop">{STEPS[step].title}</h2>
        <p style={{color:"#9A8E82",fontSize:13,marginBottom:24,lineHeight:1.5}}>{STEPS[step].subtitle}</p>

        {step===0 && <BrandingStep local={local} set={set} tryNext={tryNext} setTryNext={setTryNext} step0Invalid={step0Invalid}/>}
        {step===1 && <TradesStep   local={local} set={set}/>}
        {step===2 && <ContactStep  local={local} set={set} tryNext={tryNext}/>}
        {step===3 && <StyleStep    local={local} set={set} fontFamily={fontFamily}/>}
        {step===4 && <LegalStep    local={local} set={set}/>}
        {step===5 && <DataPrivacyStep/>}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#1A1612",borderTop:"1px solid #2A231C",padding:"12px 20px calc(14px + env(safe-area-inset-bottom))"}}>
        {/* Indicateur qualité discret */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{flex:1,height:4,background:"#2A231C",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${quality.percent}%`,background:quality.level.color,borderRadius:3,transition:"width .4s ease"}}/>
          </div>
          <span style={{fontSize:10,fontWeight:700,color:quality.level.color,whiteSpace:"nowrap"}}>
            {quality.level.label} · {quality.percent}%
          </span>
        </div>

        <div style={{display:"flex",gap:10}}>
          {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{flex:1,background:"#2A231C",color:"#9A8E82",border:"none",borderRadius:14,padding:"13px",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Retour</button>}
          {step<STEPS.length-1
            ? <button onClick={()=>{ if (!canGoNext) { setTryNext(true); return } setStep(s=>s+1) }}
                style={{flex:2,background:canGoNext?"#22c55e":"#3D3028",color:canGoNext?"white":"#6B6358",border:"none",borderRadius:14,padding:"13px",fontSize:14,fontWeight:700,cursor:canGoNext?"pointer":"not-allowed",transition:"all .15s"}}>
                Continuer →
              </button>
            : <button onClick={save} style={{flex:2,background:"#22c55e",color:"white",border:"none",borderRadius:14,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer"}}>✓ Enregistrer et commencer</button>
          }
        </div>
      </div>

    </div>
  )
}
