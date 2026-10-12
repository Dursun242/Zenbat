import { Icheck, COLORS, FONTS, labelStyle } from "./shared.jsx"
import { ZB } from "../../lib/theme.js"

// Étape « Style » : couleur, police, aperçu PDF (step===3).
// La couleur et la police choisies sont celles des documents de l'artisan :
// elles n'apparaissent que dans l'aperçu, l'interface garde ses jetons.
export default function StyleStep({ local, set, fontFamily }) {
  return (
    <div className="pop" style={{display:"flex",flexDirection:"column",gap:22}}>
      <div>
        <span style={labelStyle} id="onb-color">Couleur de tes documents</span>
        <div role="radiogroup" aria-labelledby="onb-color" style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {COLORS.map(c=>{
            const on = local.color===c
            return (
              <button key={c} type="button" role="radio" aria-checked={on} aria-label={`Couleur ${c}`} onClick={()=>set("color",c)}
                style={{width:44,height:44,borderRadius:"50%",background:c,border:`3px solid ${on ? ZB.sheet : "transparent"}`,outline:on ? `2px solid ${ZB.ink}` : "none",outlineOffset:0,cursor:"pointer",padding:0}}/>
            )
          })}
          <input type="color" value={local.color} onChange={e=>set("color",e.target.value)} aria-label="Autre couleur"
            style={{width:44,height:44,borderRadius:"50%",border:`1px solid ${ZB.rule}`,cursor:"pointer",padding:0,background:ZB.sheet}}/>
        </div>
      </div>
      <div>
        <span style={labelStyle} id="onb-font">Police de tes documents</span>
        <div role="radiogroup" aria-labelledby="onb-font" style={{display:"flex",flexDirection:"column",gap:8}}>
          {FONTS.map(f=>{
            const on = local.fontStyle===f.id
            return (
              <button key={f.id} type="button" role="radio" aria-checked={on} onClick={()=>set("fontStyle",f.id)}
                style={{...choiceStyleRow(on)}}>
                <span style={{textAlign:"left"}}>
                  <span style={{display:"block",fontFamily:f.sample,fontSize:17,color:ZB.ink,fontWeight:700}}>Devis Professionnel</span>
                  <span style={{display:"block",fontSize:13,color:ZB.ink2,marginTop:2}}>{f.label}</span>
                </span>
                {on&&<span style={{color:ZB.accent,display:"flex"}}>{Icheck}</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <span style={labelStyle}>Aperçu de l'en-tête du PDF</span>
        <div style={{background:ZB.sheet,borderRadius:8,overflow:"hidden",border:`1px solid ${ZB.rule}`}}>
          <div style={{background:local.color,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            {local.logo
              ? <img src={local.logo} alt="" style={{height:32,maxWidth:120,objectFit:"contain"}}/>
              : <span style={{fontFamily:fontFamily,fontWeight:700,fontSize:16,color:ZB.sheet}}>{local.companyName||"Ton entreprise"}</span>
            }
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:fontFamily,color:"rgba(255,255,255,.92)",fontWeight:700,fontSize:14}}>DEVIS</div>
              <div style={{color:"rgba(255,255,255,.8)",fontSize:12}}>DEV-2026-0001</div>
            </div>
          </div>
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${ZB.ruleSoft}`}}>
            <div style={{fontSize:12,color:ZB.ink2,fontFamily:fontFamily}}>Destinataire</div>
            <div style={{fontSize:14,fontWeight:600,color:ZB.ink,fontFamily:fontFamily,marginTop:2}}>Client Exemple</div>
          </div>
          <div style={{padding:"8px 16px 12px",display:"flex",justifyContent:"flex-end"}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:12,color:ZB.ink2}}>Total TTC</div>
              <div style={{fontSize:17,fontWeight:700,color:local.color,fontFamily:fontFamily,fontVariantNumeric:"tabular-nums"}}>12 500,00 €</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function choiceStyleRow(on) {
  return {
    minHeight:56, borderRadius:8, border:`1px solid ${on ? ZB.accent : ZB.rule}`, background:on ? ZB.accentSoft : ZB.sheet,
    padding:"10px 14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", fontFamily:"inherit",
  }
}
