import { useState, useRef } from "react"
import { BTP_TRADES } from "../lib/trades.js"
import { brandCompleteness } from "../lib/brandCompleteness.js"

const Icheck = <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
const Iimg   = <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>

function Logo({ size=22, white=false }) {
  return (
    <span style={{fontWeight:800,fontSize:size,letterSpacing:"-0.5px"}}>
      <span style={{color:"#22c55e"}}>Zen</span>
      <span style={{color:white?"white":"#0f172a"}}>bat</span>
    </span>
  )
}

function Field({ dark, label, val, onChange, placeholder, type="text", hint, required, invalid }) {
  const borderColor = invalid ? "#ef4444" : dark ? "#334155" : "#e2e8f0"
  return (
    <div>
      <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:600,color:dark?"#94a3b8":"#64748b",marginBottom:6}}>
        <span>{label}{required && <span style={{color:"#ef4444",marginLeft:2}}>*</span>}</span>
      </label>
      <input type={type} value={val||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",background:dark?"#1e293b":"white",border:`1px solid ${borderColor}`,borderRadius:12,padding:"10px 14px",fontSize:13,color:dark?"white":"#0f172a",outline:"none"}}/>
      {hint && <div style={{fontSize:10,color:invalid?"#fca5a5":"#64748b",marginTop:5,lineHeight:1.4}}>{invalid ? "⚠ " : "💡 "}{hint}</div>}
    </div>
  )
}

const FONTS = [
  { id:"modern",  label:"Moderne", sample:"DM Sans" },
  { id:"elegant", label:"Élégant", sample:"Playfair Display" },
  { id:"tech",    label:"Tech",    sample:"Space Grotesk" },
]
const COLORS = ["#22c55e","#3b82f6","#f97316","#8b5cf6","#ef4444","#0891b2","#0f172a","#d97706"]
const STEPS  = [
  { title:"Votre identité",       short:"Identité",  subtitle:"Informations qui apparaîtront en en-tête de tous vos devis." },
  { title:"Vos métiers BTP",      short:"Métiers",   subtitle:"L'Agent IA adapte les devis à vos spécialités uniquement." },
  { title:"Coordonnées",          short:"Contacts",  subtitle:"Comment vos clients peuvent vous joindre depuis un devis." },
  { title:"Apparence PDF",        short:"Design",    subtitle:"Couleur, police et rendu visuel de vos devis." },
  { title:"Informations légales", short:"Légal",     subtitle:"Mentions obligatoires et conditions de paiement." },
]

export default function Onboarding({ brand, setBrand, onDone }) {
  const [step,  setStep]  = useState(0)
  const [local, setLocal] = useState({ ...brand })
  const [tryNext, setTryNext] = useState(false)
  const fileRef = useRef(null)
  const set = (k, v) => setLocal(b => ({ ...b, [k]: v }))

  const quality = brandCompleteness(local)
  const step0Invalid = !local.companyName?.trim()
  const canGoNext = step === 0 ? !step0Invalid : true

  const handleLogo = e => {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => set("logo", ev.target.result)
    reader.readAsDataURL(f)
  }

  const toggleTrade = id => setLocal(b => {
    const cur = b.trades || []
    if (cur.includes(id)) return { ...b, trades: cur.filter(x => x !== id) }
    if (cur.length >= 5) return b
    return { ...b, trades: [...cur, id] }
  })

  const save = () => { setBrand(local); onDone() }
  const fontFamily = local.fontStyle==="elegant"?"Playfair Display":local.fontStyle==="tech"?"Space Grotesk":"DM Sans"

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700&family=Space+Grotesk:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}input,select,textarea,button{font-family:inherit}@keyframes popIn{0%{opacity:0;transform:scale(.94)}100%{opacity:1;transform:scale(1)}}@keyframes spin{to{transform:rotate(360deg)}}.pop{animation:popIn .25s ease both}.noscroll::-webkit-scrollbar{display:none}`}</style>

      <div style={{padding:"calc(14px + env(safe-area-inset-top)) 20px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <Logo size={18} white/>
          <span style={{color:"#64748b",fontSize:11,fontWeight:500}}>Étape {step+1} sur {STEPS.length}</span>
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
                  background: current ? "#22c55e" : done ? "#166534" : "#1e293b",
                  border: current ? "2px solid #86efac" : `1px solid ${done?"#22c55e":"#334155"}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:700,
                  color: current || done ? "white" : "#64748b",
                  transition:"all .2s",
                  boxShadow: current ? "0 0 0 4px rgba(34,197,94,.15)" : "none"
                }}>
                  {done ? "✓" : i+1}
                </div>
                <span style={{
                  fontSize:10, lineHeight:1.2, textAlign:"center",
                  fontWeight: current ? 700 : 500,
                  color: current ? "#22c55e" : done ? "#86efac" : "#475569"
                }}>{s.short}</span>
              </button>
            )
          })}
        </div>

        {/* Progress bar fine */}
        <div style={{height:2,background:"#1e293b",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",background:"linear-gradient(90deg,#22c55e,#86efac)",borderRadius:2,transition:"width .4s ease",width:`${((step+1)/STEPS.length)*100}%`}}/>
        </div>
      </div>

      <div style={{flex:1,padding:"24px 20px 120px",overflowY:"auto"}}>
        <h2 style={{color:"white",fontSize:24,fontWeight:800,marginBottom:6,letterSpacing:"-0.3px"}} className="pop">{STEPS[step].title}</h2>
        <p style={{color:"#94a3b8",fontSize:13,marginBottom:24,lineHeight:1.5}}>{STEPS[step].subtitle}</p>

        {step===0&&(
          <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"#1e293b",borderRadius:16,padding:18,border:"2px dashed #334155",textAlign:"center",cursor:"pointer"}} onClick={()=>fileRef.current?.click()}>
              {local.logo
                ? <img src={local.logo} alt="logo" style={{maxHeight:80,maxWidth:"100%",borderRadius:8,margin:"0 auto",display:"block"}}/>
                : <div>
                    <div style={{color:"#22c55e",marginBottom:8}}>{Iimg}</div>
                    <div style={{color:"#94a3b8",fontSize:13,fontWeight:500}}>Cliquez pour uploader votre logo</div>
                    <div style={{color:"#475569",fontSize:11,marginTop:4}}>PNG, JPG — recommandé 400×100px</div>
                  </div>
              }
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleLogo}/>
            </div>
            {local.logo&&<button onClick={()=>set("logo",null)} style={{background:"none",border:"1px solid #334155",borderRadius:10,padding:"7px",color:"#94a3b8",fontSize:12,cursor:"pointer"}}>Supprimer le logo</button>}
            <Field dark required label="Nom de l'entreprise" val={local.companyName} onChange={v=>{set("companyName",v);setTryNext(false)}} placeholder="Ex : Maçonnerie Dupont SAS"
              invalid={tryNext && step0Invalid}
              hint={tryNext && step0Invalid ? "Le nom est obligatoire pour générer vos devis." : "Apparaît en en-tête de tous vos devis."}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field dark label="Prénom" val={local.firstName} onChange={v=>set("firstName",v)} placeholder="Jean"/>
              <Field dark label="Nom" val={local.lastName} onChange={v=>set("lastName",v)} placeholder="Dupont"/>
            </div>
            <Field dark required label="SIRET" val={local.siret} onChange={v=>set("siret",v)} placeholder="12345678900010"
              hint="Obligatoire sur un devis en France (art. L441-9 du code de commerce)."/>
            <Field dark label="N° TVA intracommunautaire" val={local.tva} onChange={v=>set("tva",v)} placeholder="FR12345678901"
              hint="Requis si vous êtes assujetti à la TVA."/>
          </div>
        )}

        {step===1&&(
          <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"#1e3a2f",border:"1px solid rgba(34,197,94,.3)",borderRadius:12,padding:"10px 14px"}}>
              <div style={{color:"#86efac",fontSize:12,fontWeight:600,marginBottom:2}}>Choisissez jusqu'à 5 métiers</div>
              <div style={{color:"#94a3b8",fontSize:11,lineHeight:1.5}}>L'agent IA générera uniquement des devis pour vos métiers.</div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:"#64748b"}}>
              <span>{(local.trades||[]).length} / 5 sélectionnés</span>
              {(local.trades||[]).length>0&&<button onClick={()=>set("trades",[])} style={{background:"none",border:"none",color:"#64748b",fontSize:11,cursor:"pointer",textDecoration:"underline"}}>Réinitialiser</button>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {BTP_TRADES.map(t=>{
                const selected=(local.trades||[]).includes(t.id)
                const disabled=!selected&&(local.trades||[]).length>=5
                return (
                  <button key={t.id} onClick={()=>toggleTrade(t.id)} disabled={disabled}
                    style={{background:selected?"#1e3a2f":"#1e293b",border:`1.5px solid ${selected?"#22c55e":"#334155"}`,borderRadius:12,padding:"10px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1,transition:"all .15s",minHeight:64}}>
                    <span style={{fontSize:18}}>{t.icon}</span>
                    <span style={{fontSize:10,fontWeight:600,color:selected?"#86efac":"#cbd5e1",textAlign:"center",lineHeight:1.2}}>{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step===2&&(
          <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>
            <Field dark required label="Adresse" val={local.address} onChange={v=>set("address",v)} placeholder="12 rue des Artisans"
              hint="Obligatoire pour identifier l'émetteur du devis."/>
            <Field dark required label="Ville / Code postal" val={local.city} onChange={v=>set("city",v)} placeholder="76600 Le Havre"/>
            <Field dark required label="Téléphone" val={local.phone} onChange={v=>set("phone",v)} placeholder="02 35 00 00 00"
              hint="Permet à vos clients de vous joindre depuis le devis."/>
            <Field dark required label="Email professionnel" val={local.email} onChange={v=>set("email",v)} placeholder="contact@monentreprise.fr"
              hint="Indispensable pour la signature électronique du devis."/>
            <Field dark label="Site web" val={local.website} onChange={v=>set("website",v)} placeholder="www.monentreprise.fr"/>
          </div>
        )}

        {step===3&&(
          <div className="pop" style={{display:"flex",flexDirection:"column",gap:20}}>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:10}}>COULEUR PRINCIPALE</label>
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
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:10}}>STYLE DE POLICE</label>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {FONTS.map(f=>(
                  <button key={f.id} onClick={()=>set("fontStyle",f.id)}
                    style={{background:local.fontStyle===f.id?"#1e3a2f":"#1e293b",border:`1.5px solid ${local.fontStyle===f.id?"#22c55e":"#334155"}`,borderRadius:12,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all .2s"}}>
                    <div style={{textAlign:"left"}}>
                      <div style={{fontFamily:f.sample,fontSize:16,color:"white",fontWeight:700}}>Devis Professionnel</div>
                      <div style={{fontSize:10,color:"#64748b",marginTop:2}}>{f.label}</div>
                    </div>
                    {local.fontStyle===f.id&&<div style={{color:"#22c55e"}}>{Icheck}</div>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:10}}>APERÇU ENTÊTE PDF</label>
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
                <div style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9"}}>
                  <div style={{fontSize:10,color:"#94a3b8",fontFamily:fontFamily}}>DESTINATAIRE</div>
                  <div style={{fontSize:12,fontWeight:600,color:"#0f172a",fontFamily:fontFamily,marginTop:2}}>Client Exemple</div>
                </div>
                <div style={{padding:"8px 16px",display:"flex",justifyContent:"flex-end"}}>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,color:"#94a3b8"}}>Total TTC</div>
                    <div style={{fontSize:16,fontWeight:700,color:local.color,fontFamily:fontFamily}}>12 500,00 €</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step===4&&(
          <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>
            <Field dark label="RIB / Nom de la banque" val={local.rib} onChange={v=>set("rib",v)} placeholder="Crédit Mutuel — Agence Le Havre"/>
            <Field dark required label="IBAN" val={local.iban} onChange={v=>set("iban",v)} placeholder="FR76 1234 5678 9012 3456 7890 123"
              hint="Sans IBAN, vos clients ne peuvent pas régler par virement."/>
            <Field dark label="BIC / SWIFT" val={local.bic} onChange={v=>set("bic",v)} placeholder="CMCIFRPP"/>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>CONDITIONS DE PAIEMENT</label>
              <textarea value={local.paymentTerms} onChange={e=>set("paymentTerms",e.target.value)} rows={3}
                style={{width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:"10px 14px",fontSize:13,color:"white",outline:"none",resize:"none"}}/>
            </div>
            <div>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>
                MENTIONS LÉGALES (pied de devis)<span style={{color:"#ef4444"}}>*</span>
              </label>
              <textarea value={local.mentionsLegales} onChange={e=>set("mentionsLegales",e.target.value)} rows={4}
                placeholder="Ex : Assurance décennale n°... — TVA non applicable art. 293B..."
                style={{width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:"10px 14px",fontSize:13,color:"white",outline:"none",resize:"none"}}/>
              <div style={{fontSize:10,color:"#64748b",marginTop:5,lineHeight:1.4}}>💡 L'assurance décennale (BTP) et le régime TVA sont obligatoires sur tous vos devis.</div>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>VALIDITÉ DU DEVIS (jours)</label>
              <input type="number" value={local.validityDays} onChange={e=>set("validityDays",parseInt(e.target.value)||30)}
                style={{width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:"10px 14px",fontSize:13,color:"white",outline:"none"}}/>
            </div>
          </div>
        )}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0f172a",borderTop:"1px solid #1e293b",padding:"12px 20px calc(14px + env(safe-area-inset-bottom))"}}>
        {/* Indicateur qualité discret */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{flex:1,height:4,background:"#1e293b",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${quality.percent}%`,background:quality.level.color,borderRadius:3,transition:"width .4s ease"}}/>
          </div>
          <span style={{fontSize:10,fontWeight:700,color:quality.level.color,whiteSpace:"nowrap"}}>
            {quality.level.label} · {quality.percent}%
          </span>
        </div>

        <div style={{display:"flex",gap:10}}>
          {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{flex:1,background:"#1e293b",color:"#94a3b8",border:"none",borderRadius:14,padding:"13px",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Retour</button>}
          {step<STEPS.length-1
            ? <button onClick={()=>{ if (!canGoNext) { setTryNext(true); return } setStep(s=>s+1) }}
                style={{flex:2,background:canGoNext?"#22c55e":"#334155",color:canGoNext?"white":"#64748b",border:"none",borderRadius:14,padding:"13px",fontSize:14,fontWeight:700,cursor:canGoNext?"pointer":"not-allowed",transition:"all .15s"}}>
                Continuer →
              </button>
            : <button onClick={save} style={{flex:2,background:"#22c55e",color:"white",border:"none",borderRadius:14,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer"}}>✓ Enregistrer et commencer</button>
          }
        </div>
      </div>
    </div>
  )
}
