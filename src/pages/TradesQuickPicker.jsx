// Mini-étape interposée entre le signup et le Dashboard.
// Unique objectif : collecter 1 à 3 métiers pour que l'Agent IA
// produise immédiatement des devis adaptés à l'activité de l'utilisateur.
// Le reste de l'onboarding (coordonnées, design PDF, mentions légales,
// RGPD…) reste accessible à tout moment via "Mon profil".

import { useState, useRef } from "react"
import { searchTrades, tradesLabels, TRADE_EXAMPLES } from "../lib/trades.js"
import { ZB } from "../lib/theme.js"
import { btnPrimary } from "../components/ui/Register.jsx"
import { Logo, FORM_CSS, inputStyle, Iclose, Iplus, Isearch } from "../components/onboarding/shared.jsx"

const MAX_TRADES = 10

const normalize = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

export default function TradesQuickPicker({ brand, setBrand, onDone, onSkip }) {
  const [local, setLocal]           = useState(tradesLabels(brand?.trades || []))
  const [tradeInput, setTradeInput] = useState("")
  const [showSuggest, setShowSuggest] = useState(false)
  const inputRef = useRef(null)

  const canContinue = local.length >= 1

  const addTrade = (label) => {
    const trimmed = (label || "").trim()
    if (!trimmed || local.length >= MAX_TRADES) return
    if (local.some(t => normalize(t) === normalize(trimmed))) return
    setLocal([...local, trimmed])
    setTradeInput(""); setShowSuggest(false)
  }
  const removeTrade = (label) => setLocal(local.filter(t => t !== label))

  const onKey = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      if (suggestions.length > 0) addTrade(suggestions[0])
      else addTrade(tradeInput)
    } else if (e.key === "Backspace" && !tradeInput && local.length) {
      removeTrade(local[local.length - 1])
    } else if (e.key === "Escape") {
      setShowSuggest(false)
    }
  }

  const suggestions = tradeInput.trim()
    ? searchTrades(tradeInput).filter(s => !local.some(t => normalize(t) === normalize(s)))
    : []
  const showExact = tradeInput.trim() && !suggestions.some(s => normalize(s) === normalize(tradeInput.trim()))

  const save = () => {
    setBrand(b => ({ ...b, trades: local }))
    onDone()
  }

  const dropdownOpen = showSuggest && tradeInput.trim() && (suggestions.length > 0 || showExact)
  const checkIcon = <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true" style={{flexShrink:0,marginTop:1}}><polyline points="20,6 9,17 4,12"/></svg>

  return (
    <div className="zb-form" style={{minHeight:"100vh",background:ZB.paper,color:ZB.ink,fontFamily:ZB.font,display:"flex",flexDirection:"column"}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input,button{font-family:inherit}${FORM_CSS}`}</style>

      <div style={{padding:"calc(10px + env(safe-area-inset-top)) 16px 0",maxWidth:640,width:"100%",margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:48,borderBottom:`2px solid ${ZB.ink}`}}>
          <Logo size={20}/>
          <button type="button" onClick={onSkip}
            style={{background:"none",border:"none",color:ZB.ink2,minHeight:44,padding:"0 4px",fontSize:15,fontWeight:600,cursor:"pointer"}}>
            Passer cette étape
          </button>
        </div>
      </div>

      <div style={{flex:1,padding:"0 16px",overflowY:"auto",paddingBottom:120,maxWidth:640,width:"100%",margin:"0 auto"}}>
        <div className="pop" style={{marginTop:24,marginBottom:20}}>
          <p style={{fontSize:14,fontWeight:600,color:ZB.ink2,marginBottom:6}}>Dernière étape</p>
          <h1 style={{fontSize:26,fontWeight:700,color:ZB.ink,letterSpacing:"-0.01em",lineHeight:1.2,marginBottom:10}}>
            Quels sont tes métiers&nbsp;?
          </h1>
          <p style={{fontSize:15,color:ZB.ink2,lineHeight:1.5,marginBottom:14}}>
            Plus tu en ajoutes, plus l'Agent IA produit des devis <strong style={{color:ZB.ink}}>précis et professionnels</strong> dès le premier essai.
          </p>
          <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:8,fontSize:15,color:ZB.ink,lineHeight:1.4}}>
            <li style={{display:"flex",gap:8}}><span style={{color:ZB.ink2}}>{checkIcon}</span>Vocabulaire technique exact à ton métier</li>
            <li style={{display:"flex",gap:8}}><span style={{color:ZB.ink2}}>{checkIcon}</span>Tarifs du marché 2026 pré-calibrés</li>
            <li style={{display:"flex",gap:8}}><span style={{color:ZB.ink2}}>{checkIcon}</span>Unités et lots adaptés (m², ml, forfait, h…)</li>
          </ul>
        </div>

        {/* Tags sélectionnés */}
        {local.length > 0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {local.map(t => (
              <span key={t} style={{display:"inline-flex",alignItems:"center",minHeight:44,background:ZB.accentSoft,border:`1px solid ${ZB.rule}`,color:ZB.ink,borderRadius:8,padding:"0 0 0 12px",fontSize:15,fontWeight:600}}>
                {t}
                <button type="button" onClick={()=>removeTrade(t)} aria-label={`Retirer ${t}`}
                  style={{width:40,height:44,display:"grid",placeItems:"center",background:"none",border:"none",color:ZB.ink2,cursor:"pointer",padding:0}}>{Iclose}</button>
              </span>
            ))}
          </div>
        )}

        {/* Champ de saisie */}
        {local.length < MAX_TRADES && (
          <div style={{position:"relative",marginBottom:14}}>
            <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:ZB.ink3,display:"flex"}}>
              {Isearch}
            </span>
            <input
              ref={inputRef}
              value={tradeInput}
              onChange={e=>{setTradeInput(e.target.value);setShowSuggest(true)}}
              onKeyDown={onKey}
              onFocus={()=>setShowSuggest(true)}
              onBlur={()=>setTimeout(()=>setShowSuggest(false),150)}
              autoFocus
              placeholder="Ex : Électricité, Coiffure, Plomberie, Dev web…"
              aria-label="Ajouter un métier"
              style={{...inputStyle,borderRadius:dropdownOpen?"8px 8px 0 0":8,padding:"11px 44px 11px 40px"}}
            />
            {tradeInput && (
              <button type="button" aria-label="Effacer la saisie" onMouseDown={e=>{e.preventDefault();setTradeInput("");setShowSuggest(false)}}
                style={{position:"absolute",right:2,top:"50%",transform:"translateY(-50%)",width:44,height:44,display:"grid",placeItems:"center",background:"none",border:"none",color:ZB.ink2,cursor:"pointer",padding:0}}>{Iclose}</button>
            )}

            {/* Dropdown suggestions */}
            {dropdownOpen && (
              <div style={{position:"absolute",top:"100%",left:0,right:0,background:ZB.sheet,border:`1px solid ${ZB.rule}`,borderTop:"none",borderRadius:"0 0 8px 8px",zIndex:100,boxShadow:"0 10px 30px rgba(26,22,18,.16)",maxHeight:240,overflowY:"auto"}}>
                {suggestions.map((s,i)=>(
                  <button key={s} type="button" className="zb-opt" onMouseDown={()=>addTrade(s)}
                    style={{width:"100%",minHeight:44,background:ZB.sheet,border:"none",padding:"10px 14px",textAlign:"left",color:ZB.ink,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",gap:10,borderTop:i>0?`1px solid ${ZB.ruleSoft}`:"none"}}>
                    <span style={{color:ZB.ink3,display:"flex",flexShrink:0}}>{Isearch}</span>
                    {s}
                  </button>
                ))}
                {showExact && (
                  <button type="button" className="zb-opt" onMouseDown={()=>addTrade(tradeInput)}
                    style={{width:"100%",minHeight:44,background:ZB.sheet,border:"none",borderTop:`1px solid ${ZB.ruleSoft}`,padding:"10px 14px",textAlign:"left",color:ZB.accent,fontSize:15,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                    {Iplus}
                    Ajouter « {tradeInput.trim()} »
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Exemples rapides */}
        {local.length === 0 && !tradeInput && (
          <>
            <p style={{fontSize:14,fontWeight:600,color:ZB.ink2,marginBottom:8}}>Populaires</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {TRADE_EXAMPLES.map(t => (
                <button key={t} type="button" className="zb-opt" onClick={()=>addTrade(t)}
                  style={{display:"inline-flex",alignItems:"center",gap:6,minHeight:44,background:ZB.sheet,border:`1px solid ${ZB.rule}`,color:ZB.ink,borderRadius:8,padding:"0 12px",fontSize:15,cursor:"pointer"}}>
                  <span style={{color:ZB.ink2,display:"flex"}}>{Iplus}</span>{t}
                </button>
              ))}
            </div>
          </>
        )}

        <p style={{marginTop:16,fontSize:13,fontWeight:600,color:ZB.ink2,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>
          {local.length === 0 ? "Aucun métier ajouté" : `${local.length} métier${local.length>1?"s":""} sélectionné${local.length>1?"s":""}`}
          {local.length >= MAX_TRADES && <span style={{color:ZB.warn,marginLeft:6}}>· max atteint</span>}
        </p>

        <p style={{marginTop:24,borderTop:`1px solid ${ZB.rule}`,paddingTop:14,fontSize:14,color:ZB.ink2,lineHeight:1.5}}>
          Tu pourras compléter le reste de ton profil (coordonnées, logo, mentions légales, RGPD) plus tard via <strong style={{color:ZB.ink}}>Mon profil</strong> — en attendant, tu peux déjà créer tes premiers devis.
        </p>
      </div>

      {/* Barre d'action fixe */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:ZB.paper,borderTop:`1px solid ${ZB.rule}`,padding:"12px 16px calc(12px + env(safe-area-inset-bottom))"}}>
        <div style={{maxWidth:640,margin:"0 auto"}}>
          <button type="button" onClick={save} disabled={!canContinue}
            style={{...btnPrimary,width:"100%",minHeight:52,fontSize:16,background:canContinue?ZB.accent:ZB.paper2,color:canContinue?ZB.sheet:ZB.ink2,border:canContinue?"none":`1px solid ${ZB.rule}`,cursor:canContinue?"pointer":"not-allowed"}}>
            {canContinue ? "Commencer à utiliser Zenbat" : "Ajoute au moins un métier"}
          </button>
        </div>
      </div>
    </div>
  )
}
