import { useState, useRef, useEffect } from "react"
import { searchTrades, tradesLabels, TRADE_EXAMPLES } from "../../lib/trades.js"
import { ZB } from "../../lib/theme.js"
import { inputStyle, Iclose, Iplus, Isearch } from "./shared.jsx"

const MAX_TRADES = 10
const normalize = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

// Étape « Métiers » (step===1) : autocomplete sur les métiers connus avec
// possibilité d'ajouter un libellé libre. L'état d'UI (saisie, dropdown,
// suggestions calculées) vit ici ; seule la liste finale `trades` est
// remontée au parent via `set("trades", …)`.
export default function TradesStep({ local, set }) {
  const [tradeInput,  setTradeInput]  = useState("")
  const [showSuggest, setShowSuggest] = useState(false)
  const tradeRef = useRef(null)

  const currentTrades = tradesLabels(local.trades || [])

  const addTrade = (label) => {
    const trimmed = label.trim()
    if (!trimmed || currentTrades.length >= MAX_TRADES) return
    if (currentTrades.some(t => normalize(t) === normalize(trimmed))) return
    set("trades", [...currentTrades, trimmed])
    setTradeInput("")
    setShowSuggest(false)
  }

  const removeTrade = (label) => set("trades", currentTrades.filter(t => t !== label))

  // « Tout effacer » demande un second appui (annulé après 4 s).
  const [armedClear, setArmedClear] = useState(false)
  useEffect(() => {
    if (!armedClear) return
    const t = setTimeout(() => setArmedClear(false), 4000)
    return () => clearTimeout(t)
  }, [armedClear])
  const clearAll = () => {
    if (!armedClear) { setArmedClear(true); return }
    setArmedClear(false)
    set("trades", [])
  }

  const handleTradeKey = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      if (dropdownSuggestions.length > 0) addTrade(dropdownSuggestions[0])
      else addTrade(tradeInput)
    } else if (e.key === "Backspace" && !tradeInput && currentTrades.length) {
      removeTrade(currentTrades[currentTrades.length - 1])
    } else if (e.key === "Escape") {
      setShowSuggest(false)
    }
  }

  const dropdownSuggestions = tradeInput.trim()
    ? searchTrades(tradeInput).filter(s => !currentTrades.some(t => normalize(t) === normalize(s)))
    : []
  const showExact = tradeInput.trim() && !dropdownSuggestions.some(s => normalize(s) === normalize(tradeInput.trim()))

  const dropdownOpen = showSuggest && tradeInput.trim() && (dropdownSuggestions.length > 0 || showExact)

  return (
    <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>
      <style>{TRADES_CSS}</style>

      {/* Tags sélectionnés */}
      {currentTrades.length > 0 ? (
        <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
          {currentTrades.map(t=>(
            <span key={t} style={{display:"inline-flex",alignItems:"center",minHeight:44,background:ZB.accentSoft,border:`1px solid ${ZB.rule}`,borderRadius:8,padding:"0 0 0 12px",fontSize:15,color:ZB.ink,fontWeight:600}}>
              {t}
              <button type="button" onClick={()=>removeTrade(t)} aria-label={`Retirer ${t}`}
                style={{width:40,height:44,display:"grid",placeItems:"center",background:"none",border:"none",color:ZB.ink2,cursor:"pointer",padding:0}}>{Iclose}</button>
            </span>
          ))}
          <button type="button" onClick={clearAll}
            style={{background:"none",border:"none",minHeight:44,padding:"0 8px",fontSize:15,fontWeight:armedClear?700:600,color:armedClear?ZB.danger:ZB.ink2,cursor:"pointer",fontFamily:"inherit"}}>
            {armedClear ? "Appuie encore pour tout effacer" : "Tout effacer"}
          </button>
        </div>
      ) : (
        <div style={{color:ZB.ink2,fontSize:14,lineHeight:1.5}}>
          ex : {TRADE_EXAMPLES.slice(0,4).join(", ")}…
        </div>
      )}

      {/* Champ de saisie + dropdown */}
      {currentTrades.length < MAX_TRADES && (
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:ZB.ink3,display:"flex"}}>
            {Isearch}
          </span>
          <input
            ref={tradeRef}
            value={tradeInput}
            onChange={e=>{setTradeInput(e.target.value);setShowSuggest(true)}}
            onKeyDown={handleTradeKey}
            onFocus={()=>setShowSuggest(true)}
            onBlur={()=>setTimeout(()=>setShowSuggest(false),150)}
            placeholder="Tape ton métier… (Électricité, Coiffure, Dev web…)"
            aria-label="Ajouter un métier"
            style={{...inputStyle,borderRadius:dropdownOpen?"8px 8px 0 0":8,padding:"11px 44px 11px 40px"}}
          />
          {tradeInput && (
            <button type="button" aria-label="Effacer la saisie" onMouseDown={e=>{e.preventDefault();setTradeInput("");setShowSuggest(false)}}
              style={{position:"absolute",right:2,top:"50%",transform:"translateY(-50%)",width:44,height:44,display:"grid",placeItems:"center",background:"none",border:"none",color:ZB.ink2,cursor:"pointer",padding:0}}>{Iclose}</button>
          )}

          {/* Dropdown */}
          {dropdownOpen && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:ZB.sheet,border:`1px solid ${ZB.rule}`,borderTop:"none",borderRadius:"0 0 8px 8px",overflow:"hidden",zIndex:100,boxShadow:"0 10px 30px rgba(26,22,18,.16)"}}>
              {dropdownSuggestions.map((s,i)=>(
                <button key={s} type="button" className="zb-opt" onMouseDown={()=>addTrade(s)}
                  style={{width:"100%",minHeight:44,background:ZB.sheet,border:"none",padding:"10px 14px",textAlign:"left",color:ZB.ink,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",gap:10,borderTop:i>0?`1px solid ${ZB.ruleSoft}`:"none",fontFamily:"inherit"}}>
                  <span style={{color:ZB.ink3,display:"flex",flexShrink:0}}>{Isearch}</span>
                  {s}
                </button>
              ))}
              {showExact && (
                <button type="button" className="zb-opt" onMouseDown={()=>addTrade(tradeInput)}
                  style={{width:"100%",minHeight:44,background:ZB.sheet,border:"none",borderTop:`1px solid ${ZB.ruleSoft}`,padding:"10px 14px",textAlign:"left",color:ZB.accent,fontSize:15,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontFamily:"inherit"}}>
                  {Iplus}
                  Ajouter « {tradeInput.trim()} »
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {currentTrades.length === 0 && !tradeInput && (
        <div style={{color:ZB.ink2,fontSize:14,lineHeight:1.5}}>
          Tous les métiers sont acceptés — BTP, artisanat, beauté, tech, transport, santé, créatif, événementiel, immobilier, mode… ou le tien. Tape librement et appuie sur « Ajouter » si ton métier n'est pas dans la liste.
        </div>
      )}

      <div style={{fontSize:13,fontWeight:600,color:currentTrades.length>=MAX_TRADES?ZB.warn:ZB.ink2,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>
        {currentTrades.length} / {MAX_TRADES}
        {currentTrades.length>=MAX_TRADES&&" — maximum atteint"}
      </div>
    </div>
  )
}

const TRADES_CSS = `@media (hover: hover) { .zb-opt:hover { background: ${ZB.paper2} !important; } }`
