// Mini-étape interposée entre le signup et le Dashboard.
// Unique objectif : collecter 1 à 3 métiers pour que l'Agent IA
// produise immédiatement des devis adaptés à l'activité de l'utilisateur.
// Le reste de l'onboarding (coordonnées, design PDF, mentions légales,
// RGPD…) reste accessible à tout moment via "Mon profil".

import { useState, useRef } from "react"
import { searchTrades, tradesLabels, TRADE_EXAMPLES } from "../lib/trades.js"

const MAX_TRADES = 3

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

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}input,button{font-family:inherit}@keyframes popIn{0%{opacity:0;transform:scale(.94)}100%{opacity:1;transform:scale(1)}}`}</style>

      <div style={{padding:"calc(14px + env(safe-area-inset-top)) 20px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <span style={{fontWeight:800,fontSize:20}}>
            <span style={{color:"#22c55e"}}>Zen</span><span style={{color:"#fff"}}>bat</span>
          </span>
          <button onClick={onSkip}
            style={{background:"transparent",border:"1px solid #334155",color:"#64748b",borderRadius:20,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>
            Passer cette étape
          </button>
        </div>
      </div>

      <div style={{flex:1,padding:"0 20px",overflowY:"auto",paddingBottom:120}}>
        <div style={{animation:"popIn .3s ease both",marginTop:20,marginBottom:24}}>
          <div style={{fontSize:12,fontWeight:700,color:"#22c55e",letterSpacing:"1px",textTransform:"uppercase",marginBottom:8}}>1 dernière étape</div>
          <h1 style={{fontSize:28,fontWeight:800,color:"white",letterSpacing:"-0.5px",lineHeight:1.15,marginBottom:8}}>
            Quels sont vos métiers&nbsp;?
          </h1>
          <p style={{fontSize:14,color:"#94a3b8",lineHeight:1.6}}>
            L'Agent IA adaptera instantanément vocabulaire, tarifs et unités à votre activité. Ajoutez-en 1 à {MAX_TRADES}.
          </p>
        </div>

        {/* Tags sélectionnés */}
        {local.length > 0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
            {local.map(t => (
              <span key={t} style={{display:"inline-flex",alignItems:"center",gap:6,background:"#0f2318",border:"1px solid rgba(34,197,94,.35)",color:"#4ade80",borderRadius:20,padding:"6px 12px",fontSize:13,fontWeight:600}}>
                {t}
                <button onClick={()=>removeTrade(t)} style={{background:"none",border:"none",color:"#4ade80",cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 0 0 2px"}}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* Champ de saisie */}
        {local.length < MAX_TRADES && (
          <div style={{position:"relative",marginBottom:14}}>
            <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#64748b"}}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
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
              style={{width:"100%",background:"#1e293b",border:`1.5px solid ${showSuggest && tradeInput?"#22c55e":"#334155"}`,borderRadius:(showSuggest && (suggestions.length>0 || showExact))?"12px 12px 0 0":"12px",padding:"13px 40px 13px 40px",fontSize:14,color:"white",outline:"none",transition:"border-color .15s"}}
            />
            {tradeInput && (
              <button onMouseDown={e=>{e.preventDefault();setTradeInput("");setShowSuggest(false)}}
                style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:20,lineHeight:1}}>×</button>
            )}

            {/* Dropdown suggestions */}
            {showSuggest && tradeInput.trim() && (suggestions.length > 0 || showExact) && (
              <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1e293b",border:"1.5px solid #22c55e",borderTop:"none",borderRadius:"0 0 12px 12px",overflow:"hidden",zIndex:100,boxShadow:"0 8px 24px rgba(0,0,0,.4)",maxHeight:240,overflowY:"auto"}}>
                {suggestions.map((s,i)=>(
                  <button key={s} onMouseDown={()=>addTrade(s)}
                    style={{width:"100%",background:"none",border:"none",padding:"11px 14px",textAlign:"left",color:"#cbd5e1",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8,borderTop:i>0?"1px solid rgba(255,255,255,.05)":"none"}}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{color:"#475569",flexShrink:0}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    {s}
                  </button>
                ))}
                {showExact && (
                  <button onMouseDown={()=>addTrade(tradeInput)}
                    style={{width:"100%",background:"#0f2318",border:"none",borderTop:"1px solid rgba(34,197,94,.2)",padding:"11px 14px",textAlign:"left",color:"#22c55e",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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
            <div style={{fontSize:10,fontWeight:600,color:"#475569",letterSpacing:"1px",textTransform:"uppercase",marginBottom:8}}>Populaires</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {TRADE_EXAMPLES.map(t => (
                <button key={t} onClick={()=>addTrade(t)}
                  style={{background:"#1e293b",border:"1px solid #334155",color:"#94a3b8",borderRadius:18,padding:"6px 12px",fontSize:12,cursor:"pointer"}}>
                  + {t}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{marginTop:20,fontSize:11,color:local.length>=MAX_TRADES?"#f59e0b":"#475569",textAlign:"right"}}>
          {local.length} / {MAX_TRADES} métier{local.length>1?"s":""}{local.length>=MAX_TRADES && " — maximum atteint"}
        </div>

        <div style={{marginTop:24,background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:14,fontSize:11,color:"#94a3b8",lineHeight:1.6}}>
          💡 Vous pourrez compléter le reste de votre profil (coordonnées, logo, mentions légales, RGPD) plus tard via <strong style={{color:"#cbd5e1"}}>Mon profil</strong> — en attendant, vous pouvez déjà créer vos premiers devis.
        </div>
      </div>

      {/* Barre d'action fixe */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0f172a",borderTop:"1px solid #1e293b",padding:"14px 20px calc(14px + env(safe-area-inset-bottom))"}}>
        <button onClick={save} disabled={!canContinue}
          style={{width:"100%",background:canContinue?"#22c55e":"#334155",color:canContinue?"white":"#64748b",border:"none",borderRadius:14,padding:"14px",fontSize:15,fontWeight:700,cursor:canContinue?"pointer":"not-allowed",transition:"all .15s"}}>
          {canContinue ? "✓ Commencer à utiliser Zenbat" : "Ajoutez au moins un métier"}
        </button>
      </div>
    </div>
  )
}
