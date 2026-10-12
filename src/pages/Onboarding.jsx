import { useState, useEffect, useRef } from "react"
import { brandCompleteness } from "../lib/brandCompleteness.js"
import { isValidEmail } from "../lib/utils.js"
import { useAuth } from "../lib/auth.jsx"
import { Logo, STEPS, FORM_CSS } from "../components/onboarding/shared.jsx"
import { ZB, NUM } from "../lib/theme.js"
import { btnPrimary, btnSecondary } from "../components/ui/Register.jsx"
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

  // Sauvegarde à chaque modification de step ou local — debounced 400 ms
  // pour ne pas marteler localStorage à chaque frappe dans les inputs
  // (sur Safari iOS, les writes localStorage peuvent être lents et
  // bloquer brièvement le rendu).
  useEffect(() => {
    if (!userId) return
    const t = setTimeout(() => writeDraft(userId, step, local), 400)
    return () => clearTimeout(t)
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

  // Indicateur de complétude : encre au repos, vert tampon une fois complet.
  const qualityColor = quality.level.id === "pro" ? ZB.stamp : ZB.ink2

  return (
    <div className="zb-form" style={{minHeight:"100vh",background:ZB.paper,color:ZB.ink,fontFamily:ZB.font,display:"flex",flexDirection:"column"}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input,select,textarea,button{font-family:inherit}.noscroll::-webkit-scrollbar{display:none}${FORM_CSS}`}</style>

      <div style={{padding:"calc(10px + env(safe-area-inset-top)) 16px 0",maxWidth:760,width:"100%",margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,minHeight:44}}>
          <Logo size={20}/>
          <span style={{color:ZB.ink2,fontSize:13,fontWeight:600}}>Étape {step+1} sur {STEPS.length}</span>
        </div>

        {/* Fil d'étapes cliquable (étapes précédentes seulement) */}
        <nav aria-label="Étapes" className="noscroll" style={{display:"flex",alignItems:"stretch",gap:2,marginBottom:8,overflowX:"auto",scrollbarWidth:"none"}}>
          {STEPS.map((s,i)=>{
            const done    = i < step
            const current = i === step
            const go      = () => { if (i <= step) setStep(i) }
            return (
              <button key={i} onClick={go} disabled={i > step} aria-current={current ? "step" : undefined}
                style={{
                  flex:"1 0 auto",
                  background:"none",border:"none",padding:"4px 2px",minHeight:44,
                  display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                  cursor:i<=step?"pointer":"default",minWidth:56,fontFamily:"inherit"
                }}>
                <span style={{
                  width:24,height:24,borderRadius:"50%",
                  background: current ? ZB.accent : ZB.sheet,
                  border: `1px solid ${current ? ZB.accent : done ? ZB.ink : ZB.rule}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:12,fontWeight:700,
                  color: current ? ZB.sheet : done ? ZB.ink : ZB.ink3,
                }}>
                  {done
                    ? <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20,6 9,17 4,12"/></svg>
                    : i+1}
                </span>
                <span style={{
                  fontSize:12, lineHeight:1.2, textAlign:"center",
                  fontWeight: current ? 700 : 500,
                  color: current ? ZB.ink : done ? ZB.ink2 : ZB.ink3
                }}>{s.short}</span>
              </button>
            )
          })}
        </nav>

        {/* Filet de progression (2px encre) */}
        <div aria-hidden="true" style={{height:2,background:ZB.rule,overflow:"hidden"}}>
          <div style={{height:"100%",background:ZB.ink,transition:"width .4s ease",width:`${((step+1)/STEPS.length)*100}%`}}/>
        </div>
      </div>

      <div style={{flex:1,padding:"24px 16px 150px",overflowY:"auto",maxWidth:760,width:"100%",margin:"0 auto"}}>
        <h2 style={{color:ZB.ink,fontSize:21,fontWeight:700,lineHeight:1.25,marginBottom:6}} className="pop">{STEPS[step].title}</h2>
        <p style={{color:ZB.ink2,fontSize:15,marginBottom:22,lineHeight:1.45}}>{STEPS[step].subtitle}</p>

        {step===0 && <BrandingStep local={local} set={set} tryNext={tryNext} setTryNext={setTryNext} step0Invalid={step0Invalid}/>}
        {step===1 && <TradesStep   local={local} set={set}/>}
        {step===2 && <ContactStep  local={local} set={set} tryNext={tryNext}/>}
        {step===3 && <StyleStep    local={local} set={set} fontFamily={fontFamily}/>}
        {step===4 && <LegalStep    local={local} set={set}/>}
        {step===5 && <DataPrivacyStep/>}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:ZB.paper,borderTop:`1px solid ${ZB.rule}`,padding:"10px 16px calc(12px + env(safe-area-inset-bottom))"}}>
        <div style={{maxWidth:760,margin:"0 auto"}}>
          {/* Indicateur de complétude du profil */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div aria-hidden="true" style={{flex:1,height:4,background:ZB.ruleSoft,borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${quality.percent}%`,background:quality.level.id === "pro" ? ZB.stamp : ZB.ink,borderRadius:2,transition:"width .4s ease"}}/>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:qualityColor,whiteSpace:"nowrap",...NUM}}>
              Profil : {quality.level.label} · {quality.percent}%
            </span>
          </div>

          <div style={{display:"flex",gap:10}}>
            {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{...btnSecondary,flex:1,minHeight:52}}>Retour</button>}
            {step<STEPS.length-1
              ? <button onClick={()=>{ if (!canGoNext) { setTryNext(true); return } setStep(s=>s+1) }} aria-disabled={!canGoNext}
                  style={{...btnPrimary,flex:2,minHeight:52,fontSize:16,opacity:canGoNext?1:0.5,cursor:canGoNext?"pointer":"not-allowed"}}>
                  Continuer
                </button>
              : <button onClick={save} style={{...btnPrimary,flex:2,minHeight:52,fontSize:16}}>Enregistrer et commencer</button>
            }
          </div>
        </div>
      </div>

    </div>
  )
}
