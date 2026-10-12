import { useRef } from "react"
import { Iimg, Field, labelStyle, hintStyle, choiceStyle } from "./shared.jsx"
import { ZB } from "../../lib/theme.js"
import { compressLogoFile } from "../../lib/compressLogo.js"

// Étape « Branding » (step===0) : logo, raison sociale, identité, SIRET, TVA.
//
// Note : la validation `step0Invalid` reste pilotée par le parent (utile pour
// `canGoNext` du bouton « Continuer »). Le parent passe `tryNext` / `setTryNext`
// et `step0Invalid` ; ce composant n'expose pas son état interne.
export default function BrandingStep({ local, set, tryNext, setTryNext, step0Invalid }) {
  const fileRef = useRef(null)

  // Compresse + borne à 800×300 px max avant stockage dans brand_data.
  // Sans ça, une photo iPhone non redimensionnée faisait gonfler chaque
  // PDF Factur-X à 3+ Mo et l'émission échouait (limite body Vercel 4,5 Mo).
  const handleLogo = async e => {
    const f = e.target.files[0]
    if (!f) return
    const out = await compressLogoFile(f)
    if (out) set("logo", out)
  }

  return (
    <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div>
        <span style={labelStyle}>Logo</span>
        <button type="button" onClick={()=>fileRef.current?.click()} aria-label={local.logo ? "Changer le logo" : undefined}
          style={{width:"100%",minHeight:96,background:ZB.sheet,borderRadius:8,padding:16,border:`1px dashed ${ZB.rule}`,textAlign:"center",cursor:"pointer",fontFamily:"inherit",display:"block"}}>
          {local.logo
            ? <img src={local.logo} alt="Ton logo" style={{maxHeight:80,maxWidth:"100%",margin:"0 auto",display:"block"}}/>
            : <span style={{display:"block"}}>
                <span style={{color:ZB.ink2,display:"inline-block",marginBottom:6}}>{Iimg}</span>
                <span style={{display:"block",color:ZB.ink,fontSize:15,fontWeight:600}}>Appuie pour ajouter ton logo</span>
                <span style={{display:"block",color:ZB.ink2,fontSize:13,marginTop:4}}>PNG, JPG — recommandé 400×100 px</span>
              </span>
          }
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleLogo}/>
        {local.logo&&<button type="button" onClick={()=>set("logo",null)} style={{background:"none",border:"none",minHeight:44,padding:"0 4px",color:ZB.ink2,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Supprimer le logo</button>}
      </div>
      <Field required label="Nom de l'entreprise" val={local.companyName} onChange={v=>{set("companyName",v);setTryNext(false)}} placeholder="Ex : Maçonnerie Dupont SAS"
        invalid={tryNext && step0Invalid}
        hint={tryNext && step0Invalid ? "Le nom est obligatoire pour générer tes devis." : "Apparaît en en-tête de tous tes devis."}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Prénom" val={local.firstName} onChange={v=>set("firstName",v)} placeholder="Jean"/>
        <Field label="Nom" val={local.lastName} onChange={v=>set("lastName",v)} placeholder="Dupont"/>
      </div>
      <Field required label="SIRET" val={local.siret} onChange={v=>set("siret",v)} placeholder="12345678900010"
        hint="Obligatoire sur un devis en France (art. L441-9 du code de commerce)."/>

      <div>
        <span style={labelStyle} id="onb-vat">Régime de TVA</span>
        <div role="radiogroup" aria-labelledby="onb-vat" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[
            { id:"normal",    title:"Assujetti à la TVA", sub:"Société, SARL, SAS…" },
            { id:"franchise", title:"Franchise en base",  sub:"Auto-entrepreneur (art. 293 B)" },
          ].map(opt => {
            const active = (local.vatRegime || "normal") === opt.id
            return (
              <button key={opt.id} type="button" role="radio" aria-checked={active} onClick={()=>set("vatRegime",opt.id)}
                style={{...choiceStyle(active),padding:"10px 12px",textAlign:"left"}}>
                <span style={{display:"block",fontSize:15,fontWeight:700,color:ZB.ink}}>{opt.title}</span>
                <span style={{display:"block",fontSize:13,color:ZB.ink2,marginTop:2,lineHeight:1.3}}>{opt.sub}</span>
              </button>
            )
          })}
        </div>
        {local.vatRegime === "franchise" && (
          <div style={hintStyle}>Tous les devis seront émis à TVA 0 % avec la mention "{`TVA non applicable, art. 293 B du CGI`}". Plafond 2026 : 39 100 € de CA pour les prestations BTP.</div>
        )}
      </div>

      {local.vatRegime !== "franchise" && (
        <Field label="N° TVA intracommunautaire" val={local.tva} onChange={v=>set("tva",v)} placeholder="FR12345678901"
          hint="Format : FR + 2 chiffres + 9 chiffres SIREN. Disponible sur ton extrait Kbis ou via le-sirene.insee.fr."/>
      )}
    </div>
  )
}
