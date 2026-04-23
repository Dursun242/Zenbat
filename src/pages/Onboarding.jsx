import { useState, useRef } from "react"
import { searchTrades, tradesLabels, TRADE_EXAMPLES } from "../lib/trades.js"
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
  { title:"Vos métiers",          short:"Métiers",   subtitle:"BTP, artisanat, beauté, tech, santé… L'Agent IA adapte les devis à vos spécialités." },
  { title:"Coordonnées",          short:"Contacts",  subtitle:"Comment vos clients peuvent vous joindre depuis un devis." },
  { title:"Apparence PDF",        short:"Design",    subtitle:"Couleur, police et rendu visuel de vos devis." },
  { title:"Informations légales", short:"Légal",     subtitle:"Mentions obligatoires et conditions de paiement." },
]

export default function Onboarding({ brand, setBrand, onDone }) {
  const [step,  setStep]  = useState(0)
  const [local, setLocal] = useState({ ...brand })
  const [tryNext, setTryNext] = useState(false)
  const [tradeInput,  setTradeInput]  = useState("")
  const [showSuggest, setShowSuggest] = useState(false)
  const fileRef    = useRef(null)
  const tradeRef   = useRef(null)
  const set = (k, v) => setLocal(b => ({ ...b, [k]: v }))

  const MAX_TRADES = 7
  const currentTrades = tradesLabels(local.trades || [])

  const normalize = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

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

            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>RÉGIME DE TVA</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  { id:"normal",    title:"Assujetti à la TVA", sub:"Société, SARL, SAS…" },
                  { id:"franchise", title:"Franchise en base",  sub:"Auto-entrepreneur (art. 293 B)" },
                ].map(opt => {
                  const active = (local.vatRegime || "normal") === opt.id;
                  return (
                    <button key={opt.id} onClick={()=>set("vatRegime",opt.id)}
                      style={{background:active?"#1e3a2f":"#1e293b",border:`1.5px solid ${active?"#22c55e":"#334155"}`,borderRadius:12,padding:"10px 12px",textAlign:"left",cursor:"pointer",transition:"all .15s"}}>
                      <div style={{fontSize:12,fontWeight:700,color:active?"#86efac":"white"}}>{opt.title}</div>
                      <div style={{fontSize:10,color:"#94a3b8",marginTop:2,lineHeight:1.3}}>{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
              {local.vatRegime === "franchise" && (
                <div style={{fontSize:10,color:"#86efac",marginTop:6,lineHeight:1.4}}>💡 Tous les devis seront émis à TVA 0 % avec la mention "{`TVA non applicable, art. 293 B du CGI`}".</div>
              )}
            </div>

            {local.vatRegime !== "franchise" && (
              <Field dark label="N° TVA intracommunautaire" val={local.tva} onChange={v=>set("tva",v)} placeholder="FR12345678901"
                hint="Requis si vous êtes assujetti à la TVA."/>
            )}
          </div>
        )}

        {step===1&&(
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
                <button onClick={()=>set("trades",[])} style={{background:"none",border:"1px solid #334155",borderRadius:20,padding:"5px 10px",fontSize:11,color:"#64748b",cursor:"pointer"}}>Tout effacer</button>
              </div>
            ) : (
              <div style={{color:"#475569",fontSize:12,lineHeight:1.6}}>
                ex : <span style={{color:"#64748b"}}>{TRADE_EXAMPLES.slice(0,4).join(", ")}…</span>
              </div>
            )}

            {/* Champ de saisie + dropdown */}
            {currentTrades.length < MAX_TRADES && (
              <div style={{position:"relative"}}>
                <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#64748b"}}>
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
                  style={{width:"100%",background:"#1e293b",border:`1.5px solid ${showSuggest&&tradeInput?"#22c55e":"#334155"}`,borderRadius:showSuggest&&(dropdownSuggestions.length>0||showExact)?"10px 10px 0 0":"10px",padding:"11px 34px 11px 36px",fontSize:13,color:"white",outline:"none",boxSizing:"border-box",transition:"border-color .15s"}}
                />
                {tradeInput && (
                  <button onMouseDown={e=>{e.preventDefault();setTradeInput("");setShowSuggest(false)}}
                    style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
                )}

                {/* Dropdown */}
                {showSuggest && tradeInput.trim() && (dropdownSuggestions.length > 0 || showExact) && (
                  <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1e293b",border:"1.5px solid #22c55e",borderTop:"none",borderRadius:"0 0 10px 10px",overflow:"hidden",zIndex:100,boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
                    {dropdownSuggestions.map((s,i)=>(
                      <button key={s} onMouseDown={()=>addTrade(s)}
                        style={{width:"100%",background:"none",border:"none",padding:"10px 14px",textAlign:"left",color:"#cbd5e1",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8,borderTop:i>0?"1px solid rgba(255,255,255,.05)":"none"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#253448";e.currentTarget.style.color="white"}}
                        onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="#cbd5e1"}}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{color:"#475569",flexShrink:0}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
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
              <div style={{color:"#475569",fontSize:11,lineHeight:1.5}}>
                BTP, artisanat, beauté, tech, transport… tous les métiers sont acceptés.
              </div>
            )}

            <div style={{fontSize:11,color:currentTrades.length>=MAX_TRADES?"#f59e0b":"#475569",textAlign:"right"}}>
              {currentTrades.length} / {MAX_TRADES}
              {currentTrades.length>=MAX_TRADES&&" — maximum atteint"}
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
                placeholder="Ex : Assurance RC pro n°... — TVA non applicable art. 293B..."
                style={{width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:"10px 14px",fontSize:13,color:"white",outline:"none",resize:"none"}}/>
              <div style={{fontSize:10,color:"#64748b",marginTop:5,lineHeight:1.4}}>💡 L'assurance RC pro et le régime TVA sont obligatoires sur tous vos devis.</div>
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
