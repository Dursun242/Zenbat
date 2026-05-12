import { useState, useRef } from "react"
import { searchTrades, tradesLabels, TRADE_EXAMPLES } from "../../lib/trades.js"

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

  return (
    <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Tags sélectionnés */}
      {currentTrades.length > 0 ? (
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {currentTrades.map(t=>(
            <span key={t} style={{display:"inline-flex",alignItems:"center",gap:5,background:"#1e3a2f",border:"1px solid #22c55e",borderRadius:20,padding:"5px 12px",fontSize:13,color:"#86efac",fontWeight:600}}>
              {t}
              <button onClick={()=>removeTrade(t)} style={{background:"none",border:"none",color:"#4ade80",cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 0 0 2px"}}>×</button>
            </span>
          ))}
          <button onClick={()=>set("trades",[])} style={{background:"none",border:"1px solid #3D3028",borderRadius:20,padding:"5px 10px",fontSize:11,color:"#6B6358",cursor:"pointer"}}>Tout effacer</button>
        </div>
      ) : (
        <div style={{color:"#6B6358",fontSize:12,lineHeight:1.6}}>
          ex : <span style={{color:"#6B6358"}}>{TRADE_EXAMPLES.slice(0,4).join(", ")}…</span>
        </div>
      )}

      {/* Champ de saisie + dropdown */}
      {currentTrades.length < MAX_TRADES && (
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#6B6358"}}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input
            ref={tradeRef}
            value={tradeInput}
            onChange={e=>{setTradeInput(e.target.value);setShowSuggest(true)}}
            onKeyDown={handleTradeKey}
            onFocus={()=>setShowSuggest(true)}
            onBlur={()=>setTimeout(()=>setShowSuggest(false),150)}
            placeholder="Tapez votre métier… (Électricité, Coiffure, Dev web…)"
            style={{width:"100%",background:"#2A231C",border:`1.5px solid ${showSuggest&&tradeInput?"#22c55e":"#3D3028"}`,borderRadius:showSuggest&&(dropdownSuggestions.length>0||showExact)?"10px 10px 0 0":"10px",padding:"11px 34px 11px 36px",fontSize:13,color:"white",outline:"none",boxSizing:"border-box",transition:"border-color .15s"}}
          />
          {tradeInput && (
            <button onMouseDown={e=>{e.preventDefault();setTradeInput("");setShowSuggest(false)}}
              style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#6B6358",cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
          )}

          {/* Dropdown */}
          {showSuggest && tradeInput.trim() && (dropdownSuggestions.length > 0 || showExact) && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#2A231C",border:"1.5px solid #22c55e",borderTop:"none",borderRadius:"0 0 10px 10px",overflow:"hidden",zIndex:100,boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
              {dropdownSuggestions.map((s,i)=>(
                <button key={s} onMouseDown={()=>addTrade(s)}
                  style={{width:"100%",background:"none",border:"none",padding:"10px 14px",textAlign:"left",color:"#cbd5e1",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8,borderTop:i>0?"1px solid rgba(255,255,255,.05)":"none"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="#253448";e.currentTarget.style.color="white"}}
                  onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="#cbd5e1"}}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{color:"#6B6358",flexShrink:0}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {s}
                </button>
              ))}
              {showExact && (
                <button onMouseDown={()=>addTrade(tradeInput)}
                  style={{width:"100%",background:"#0f2318",border:"none",borderTop:"1px solid rgba(34,197,94,.2)",padding:"10px 14px",textAlign:"left",color:"#22c55e",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}
                  onMouseEnter={e=>e.currentTarget.style.background="#1e3a2f"}
                  onMouseLeave={e=>e.currentTarget.style.background="#0f2318"}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Ajouter « {tradeInput.trim()} »
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {currentTrades.length === 0 && !tradeInput && (
        <div style={{color:"#6B6358",fontSize:11,lineHeight:1.5}}>
          Tous les métiers sont acceptés — BTP, artisanat, beauté, tech, transport, santé, créatif, événementiel, immobilier, mode… ou le vôtre. Tapez librement et cliquez sur « Ajouter » si votre métier n'est pas dans la liste.
        </div>
      )}

      <div style={{fontSize:11,color:currentTrades.length>=MAX_TRADES?"#f59e0b":"#6B6358",textAlign:"right"}}>
        {currentTrades.length} / {MAX_TRADES}
        {currentTrades.length>=MAX_TRADES&&" — maximum atteint"}
      </div>
    </div>
  )
}
