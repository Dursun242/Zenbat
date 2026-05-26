import { useRef } from "react"
import { Iimg, Field } from "./shared.jsx"
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
      <div style={{background:"#2A231C",borderRadius:16,padding:18,border:"2px dashed #3D3028",textAlign:"center",cursor:"pointer"}} onClick={()=>fileRef.current?.click()}>
        {local.logo
          ? <img src={local.logo} alt="logo" style={{maxHeight:80,maxWidth:"100%",borderRadius:8,margin:"0 auto",display:"block"}}/>
          : <div>
              <div style={{color:"#22c55e",marginBottom:8}}>{Iimg}</div>
              <div style={{color:"#9A8E82",fontSize:13,fontWeight:500}}>Cliquez pour uploader votre logo</div>
              <div style={{color:"#6B6358",fontSize:11,marginTop:4}}>PNG, JPG — recommandé 400×100px</div>
            </div>
        }
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleLogo}/>
      </div>
      {local.logo&&<button onClick={()=>set("logo",null)} style={{background:"none",border:"1px solid #3D3028",borderRadius:10,padding:"7px",color:"#9A8E82",fontSize:12,cursor:"pointer"}}>Supprimer le logo</button>}
      <Field dark required label="Nom de l'entreprise" val={local.companyName} onChange={v=>{set("companyName",v);setTryNext(false)}} placeholder="Ex : Maçonnerie Dupont SAS"
        invalid={tryNext && step0Invalid}
        hint={tryNext && step0Invalid ? "Le nom est obligatoire pour générer vos devis." : "Apparaît en en-tête de tous vos devis."}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field dark label="Prénom" val={local.firstName} onChange={v=>set("firstName",v)} placeholder="Jean"/>
        <Field dark label="Nom" val={local.lastName} onChange={v=>set("lastName",v)} placeholder="Dupont"/>
      </div>
      <Field dark required label="SIRET" val={local.siret} onChange={v=>set("siret",v)} placeholder="12345678900010"
        hint="Obligatoire sur un devis en France (art. L441-9 du code de commerce)."/>

      <div>
        <label style={{display:"block",fontSize:11,fontWeight:600,color:"#9A8E82",marginBottom:6}}>RÉGIME DE TVA</label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[
            { id:"normal",    title:"Assujetti à la TVA", sub:"Société, SARL, SAS…" },
            { id:"franchise", title:"Franchise en base",  sub:"Auto-entrepreneur (art. 293 B)" },
          ].map(opt => {
            const active = (local.vatRegime || "normal") === opt.id
            return (
              <button key={opt.id} onClick={()=>set("vatRegime",opt.id)}
                style={{background:active?"#1e3a2f":"#2A231C",border:`1.5px solid ${active?"#22c55e":"#3D3028"}`,borderRadius:12,padding:"10px 12px",textAlign:"left",cursor:"pointer",transition:"all .15s"}}>
                <div style={{fontSize:12,fontWeight:700,color:active?"#86efac":"white"}}>{opt.title}</div>
                <div style={{fontSize:10,color:"#9A8E82",marginTop:2,lineHeight:1.3}}>{opt.sub}</div>
              </button>
            )
          })}
        </div>
        {local.vatRegime === "franchise" && (
          <div style={{fontSize:10,color:"#86efac",marginTop:6,lineHeight:1.4}}>💡 Tous les devis seront émis à TVA 0 % avec la mention "{`TVA non applicable, art. 293 B du CGI`}". Plafond 2026 : 39 100 € de CA pour les prestations BTP.</div>
        )}
      </div>

      {local.vatRegime !== "franchise" && (
        <Field dark label="N° TVA intracommunautaire" val={local.tva} onChange={v=>set("tva",v)} placeholder="FR12345678901"
          hint="Format : FR + 2 chiffres + 9 chiffres SIREN. Disponible sur votre extrait Kbis ou via le-sirene.insee.fr."/>
      )}
    </div>
  )
}
