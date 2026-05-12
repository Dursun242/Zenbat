import { Icheck, COLORS, FONTS } from "./shared.jsx"

// Étape « Style » : couleur, police, aperçu PDF (step===3).
export default function StyleStep({ local, set, fontFamily }) {
  return (
    <div className="pop" style={{display:"flex",flexDirection:"column",gap:20}}>
      <div>
        <label style={{display:"block",fontSize:11,fontWeight:600,color:"#9A8E82",marginBottom:10}}>COULEUR PRINCIPALE</label>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {COLORS.map(c=>(
            <button key={c} onClick={()=>set("color",c)}
              style={{width:36,height:36,borderRadius:"50%",background:c,border:local.color===c?"3px solid white":"3px solid transparent",cursor:"pointer",boxShadow:local.color===c?"0 0 0 2px "+c:"none",transition:"all .2s"}}/>
          ))}
          <input type="color" value={local.color} onChange={e=>set("color",e.target.value)}
            style={{width:36,height:36,borderRadius:"50%",border:"none",cursor:"pointer",padding:0,background:"none"}}/>
        </div>
      </div>
      <div>
        <label style={{display:"block",fontSize:11,fontWeight:600,color:"#9A8E82",marginBottom:10}}>STYLE DE POLICE</label>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {FONTS.map(f=>(
            <button key={f.id} onClick={()=>set("fontStyle",f.id)}
              style={{background:local.fontStyle===f.id?"#1e3a2f":"#2A231C",border:`1.5px solid ${local.fontStyle===f.id?"#22c55e":"#3D3028"}`,borderRadius:12,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all .2s"}}>
              <div style={{textAlign:"left"}}>
                <div style={{fontFamily:f.sample,fontSize:16,color:"white",fontWeight:700}}>Devis Professionnel</div>
                <div style={{fontSize:10,color:"#6B6358",marginTop:2}}>{f.label}</div>
              </div>
              {local.fontStyle===f.id&&<div style={{color:"#22c55e"}}>{Icheck}</div>}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={{display:"block",fontSize:11,fontWeight:600,color:"#9A8E82",marginBottom:10}}>APERÇU ENTÊTE PDF</label>
        <div style={{background:"white",borderRadius:12,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,.3)"}}>
          <div style={{background:local.color,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            {local.logo
              ? <img src={local.logo} alt="" style={{height:32,maxWidth:120,objectFit:"contain"}}/>
              : <span style={{fontFamily:fontFamily,fontWeight:700,fontSize:16,color:"white"}}>{local.companyName||"Votre Entreprise"}</span>
            }
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:fontFamily,color:"rgba(255,255,255,.9)",fontWeight:700,fontSize:13}}>DEVIS</div>
              <div style={{color:"rgba(255,255,255,.6)",fontSize:10}}>DEV-2026-0001</div>
            </div>
          </div>
          <div style={{padding:"10px 16px",borderBottom:"1px solid #F0EBE3"}}>
            <div style={{fontSize:10,color:"#9A8E82",fontFamily:fontFamily}}>DESTINATAIRE</div>
            <div style={{fontSize:12,fontWeight:600,color:"#1A1612",fontFamily:fontFamily,marginTop:2}}>Client Exemple</div>
          </div>
          <div style={{padding:"8px 16px",display:"flex",justifyContent:"flex-end"}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:"#9A8E82"}}>Total TTC</div>
              <div style={{fontSize:16,fontWeight:700,color:local.color,fontFamily:fontFamily}}>12 500,00 €</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
