import { useState, useRef, useEffect } from "react"
import { searchTrades, tradesLabels, TRADE_EXAMPLES } from "../lib/trades.js"
import { brandCompleteness } from "../lib/brandCompleteness.js"
import { supabase } from "../lib/supabase.js"
import { Icheck, Iimg, Logo, Field, FONTS, COLORS, STEPS } from "../components/onboarding/shared.jsx"
import DeleteAccountModal from "../components/onboarding/DeleteAccountModal.jsx"

export default function Onboarding({ brand, setBrand, onDone }) {
  const [step,  setStep]  = useState(0)
  const [local, setLocal] = useState({ ...brand })
  const [tryNext, setTryNext] = useState(false)
  const [tradeInput,  setTradeInput]  = useState("")
  const [showSuggest, setShowSuggest] = useState(false)
  const fileRef    = useRef(null)
  const tradeRef   = useRef(null)
  const set = (k, v) => setLocal(b => ({ ...b, [k]: v }))

  const MAX_TRADES = 10
  const currentTrades = tradesLabels(local.trades || [])

  // ── État RGPD (étape "Vos données") ─────────────────────────────
  const [exportBusy,    setExportBusy]    = useState(false)
  const [exportMsg,     setExportMsg]     = useState(null)
  const [deleteOpen,    setDeleteOpen]    = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleteBusy,    setDeleteBusy]    = useState(false)
  const [deleteError,   setDeleteError]   = useState(null)
  const [myEmail,       setMyEmail]       = useState("")

  // Récupère l'email courant pour la confirmation de suppression (1 seule fois)
  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(
      ({ data }) => { if (mounted && data?.user?.email) setMyEmail(data.user.email) },
      () => {},
    )
    return () => { mounted = false }
  }, [])

  const exportMyData = async () => {
    setExportBusy(true); setExportMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Vous devez être connecté.")
      const res = await fetch("/api/account", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url
      a.download = `zenbat-export-${new Date().toISOString().slice(0,10)}.json`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 3000)
      setExportMsg("✓ Archive téléchargée — conservez-la dans un endroit sûr.")
    } catch (e) {
      setExportMsg("❌ " + (e.message || "Erreur d'export"))
    } finally {
      setExportBusy(false)
    }
  }

  const deleteMyAccount = async () => {
    setDeleteBusy(true); setDeleteError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Session expirée — reconnectez-vous.")
      const res = await fetch("/api/account", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ confirmEmail: deleteConfirm }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      // Suppression OK : on déconnecte et on renvoie sur la landing
      await supabase.auth.signOut().catch(() => {})
      window.location.href = "/"
    } catch (e) {
      setDeleteError(e.message || "Erreur lors de la suppression")
    } finally {
      setDeleteBusy(false)
    }
  }

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
    <div style={{minHeight:"100vh",background:"#1A1612",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700&family=Space+Grotesk:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}input,select,textarea,button{font-family:inherit}@keyframes popIn{0%{opacity:0;transform:scale(.94)}100%{opacity:1;transform:scale(1)}}@keyframes spin{to{transform:rotate(360deg)}}.pop{animation:popIn .25s ease both}.noscroll::-webkit-scrollbar{display:none}`}</style>

      <div style={{padding:"calc(14px + env(safe-area-inset-top)) 20px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <Logo size={18} white/>
          <span style={{color:"#6B6358",fontSize:11,fontWeight:500}}>Étape {step+1} sur {STEPS.length}</span>
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
                  background: current ? "#22c55e" : done ? "#166534" : "#2A231C",
                  border: current ? "2px solid #86efac" : `1px solid ${done?"#22c55e":"#3D3028"}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:700,
                  color: current || done ? "white" : "#6B6358",
                  transition:"all .2s",
                  boxShadow: current ? "0 0 0 4px rgba(34,197,94,.15)" : "none"
                }}>
                  {done ? "✓" : i+1}
                </div>
                <span style={{
                  fontSize:10, lineHeight:1.2, textAlign:"center",
                  fontWeight: current ? 700 : 500,
                  color: current ? "#22c55e" : done ? "#86efac" : "#6B6358"
                }}>{s.short}</span>
              </button>
            )
          })}
        </div>

        {/* Progress bar fine */}
        <div style={{height:2,background:"#2A231C",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",background:"linear-gradient(90deg,#22c55e,#86efac)",borderRadius:2,transition:"width .4s ease",width:`${((step+1)/STEPS.length)*100}%`}}/>
        </div>
      </div>

      <div style={{flex:1,padding:"24px 20px 120px",overflowY:"auto"}}>
        <h2 style={{color:"white",fontSize:24,fontWeight:600,marginBottom:6,letterSpacing:"-0.5px",fontFamily:"'Syne',sans-serif"}} className="pop">{STEPS[step].title}</h2>
        <p style={{color:"#9A8E82",fontSize:13,marginBottom:24,lineHeight:1.5}}>{STEPS[step].subtitle}</p>

        {step===0&&(
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
                  const active = (local.vatRegime || "normal") === opt.id;
                  return (
                    <button key={opt.id} onClick={()=>set("vatRegime",opt.id)}
                      style={{background:active?"#1e3a2f":"#2A231C",border:`1.5px solid ${active?"#22c55e":"#3D3028"}`,borderRadius:12,padding:"10px 12px",textAlign:"left",cursor:"pointer",transition:"all .15s"}}>
                      <div style={{fontSize:12,fontWeight:700,color:active?"#86efac":"white"}}>{opt.title}</div>
                      <div style={{fontSize:10,color:"#9A8E82",marginTop:2,lineHeight:1.3}}>{opt.sub}</div>
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
        )}

        {step===5&&(
          <div className="pop" style={{display:"flex",flexDirection:"column",gap:16}}>

            {/* Export RGPD */}
            <div style={{background:"#2A231C",border:"1px solid #3D3028",borderRadius:14,padding:16}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:10}}>
                <div style={{width:36,height:36,borderRadius:10,background:"#0f2318",border:"1px solid rgba(34,197,94,.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#22c55e"}}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:"white",marginBottom:3}}>Télécharger mes données (RGPD art. 20)</div>
                  <div style={{fontSize:11,color:"#9A8E82",lineHeight:1.5}}>
                    Archive JSON complète : profil, clients, devis, factures, conversations IA, journaux. Vous pouvez la conserver ou la transférer vers un autre service.
                  </div>
                </div>
              </div>
              <button onClick={exportMyData} disabled={exportBusy}
                style={{width:"100%",background:exportBusy?"#3D3028":"#22c55e",color:exportBusy?"#9A8E82":"white",border:"none",borderRadius:12,padding:"11px",fontSize:13,fontWeight:700,cursor:exportBusy?"not-allowed":"pointer"}}>
                {exportBusy ? "Préparation de l'archive…" : "⬇ Télécharger mon archive JSON"}
              </button>
              {exportMsg && (
                <div style={{marginTop:10,fontSize:11,color:exportMsg.startsWith("❌")?"#fca5a5":"#86efac"}}>{exportMsg}</div>
              )}
            </div>

            {/* Suppression compte */}
            <div style={{background:"#2A231C",border:"1px solid #7f1d1d",borderRadius:14,padding:16}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:10}}>
                <div style={{width:36,height:36,borderRadius:10,background:"#3f0e0e",border:"1px solid rgba(239,68,68,.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#ef4444"}}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:"white",marginBottom:3}}>Supprimer mon compte (RGPD art. 17)</div>
                  <div style={{fontSize:11,color:"#9A8E82",lineHeight:1.5}}>
                    Action <strong style={{color:"#fca5a5"}}>irréversible</strong>. Sera supprimé : profil, clients, devis, brouillons, conversations IA. Les factures émises sont conservées en archive (LPF L102 B — 10 ans) sans accès en lecture.
                  </div>
                </div>
              </div>
              <button onClick={() => { setDeleteOpen(true); setDeleteConfirm(""); setDeleteError(null) }}
                style={{width:"100%",background:"transparent",color:"#ef4444",border:"1px solid #7f1d1d",borderRadius:12,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                Supprimer mon compte définitivement
              </button>
            </div>

            <div style={{fontSize:10,color:"#6B6358",lineHeight:1.6,padding:"0 4px"}}>
              💡 Vous pouvez aussi exercer vos autres droits RGPD (rectification, limitation, opposition, plainte CNIL) en écrivant à <span style={{color:"#9A8E82"}}>Zenbat76@gmail.com</span>.
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
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#9A8E82",marginBottom:6}}>CONDITIONS DE PAIEMENT</label>
              <textarea value={local.paymentTerms} onChange={e=>set("paymentTerms",e.target.value)} rows={3}
                style={{width:"100%",background:"#2A231C",border:"1px solid #3D3028",borderRadius:12,padding:"10px 14px",fontSize:13,color:"white",outline:"none",resize:"none"}}/>
            </div>
            <div>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:600,color:"#9A8E82",marginBottom:6}}>
                MENTIONS LÉGALES (pied de devis)<span style={{color:"#ef4444"}}>*</span>
              </label>
              <textarea value={local.mentionsLegales} onChange={e=>set("mentionsLegales",e.target.value)} rows={4}
                placeholder="Ex : Assurance RC pro n°... — TVA non applicable art. 293B..."
                style={{width:"100%",background:"#2A231C",border:"1px solid #3D3028",borderRadius:12,padding:"10px 14px",fontSize:13,color:"white",outline:"none",resize:"none"}}/>
              <div style={{fontSize:10,color:"#6B6358",marginTop:5,lineHeight:1.4}}>💡 L'assurance RC pro et le régime TVA sont obligatoires sur tous vos devis.</div>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#9A8E82",marginBottom:6}}>VALIDITÉ DU DEVIS (jours)</label>
              <input type="number" value={local.validityDays} onChange={e=>set("validityDays",parseInt(e.target.value)||30)}
                style={{width:"100%",background:"#2A231C",border:"1px solid #3D3028",borderRadius:12,padding:"10px 14px",fontSize:13,color:"white",outline:"none"}}/>
            </div>

            {/* Mentions facture obligatoires (CGI 242 nonies A + C. com. L441-10) */}
            <div style={{background:"#2A231C",border:"1px solid #3D3028",borderRadius:12,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#3b82f6",marginBottom:8,letterSpacing:"0.5px",textTransform:"uppercase"}}>
                Mentions facture
              </div>
              <div style={{fontSize:10,color:"#6B6358",lineHeight:1.5,marginBottom:12}}>
                Obligatoires sur toute facture B2B (art. 242 nonies A du CGI).
              </div>
              <Field dark label="Forme juridique" val={local.legalForm} onChange={v=>set("legalForm",v)} placeholder="SAS, SARL, EI, auto-entrepreneur…"/>
              <div style={{height:8}}/>
              <Field dark label="RCS (si commerçant)" val={local.rcs} onChange={v=>set("rcs",v)} placeholder="RCS Le Havre 123 456 789"
                hint="Numéro d'inscription au Registre du Commerce et des Sociétés + ville du greffe."/>
              <div style={{height:8}}/>
              <Field dark label="Capital social (sociétés uniquement)" val={local.capital} onChange={v=>set("capital",v)} placeholder="Ex : 10 000 €"/>
              <div style={{height:8}}/>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:"#9A8E82",marginBottom:6}}>PÉNALITÉS DE RETARD</label>
                <textarea value={local.paymentPenalties||""} onChange={e=>set("paymentPenalties",e.target.value)} rows={2}
                  style={{width:"100%",background:"#1A1612",border:"1px solid #3D3028",borderRadius:10,padding:"9px 12px",fontSize:12,color:"white",outline:"none",resize:"none"}}/>
                <div style={{fontSize:10,color:"#6B6358",marginTop:5,lineHeight:1.4}}>Mention obligatoire (L441-10 C. com.) — taux + indemnité forfaitaire 40 €.</div>
              </div>
              <div style={{height:8}}/>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:"#9A8E82",marginBottom:6}}>ESCOMPTE POUR PAIEMENT ANTICIPÉ</label>
                <textarea value={local.escompte||""} onChange={e=>set("escompte",e.target.value)} rows={2}
                  style={{width:"100%",background:"#1A1612",border:"1px solid #3D3028",borderRadius:10,padding:"9px 12px",fontSize:12,color:"white",outline:"none",resize:"none"}}/>
              </div>
            </div>

            {/* Mentions BTP obligatoires (décret 2017-1809) */}
            <div style={{background:"#2A231C",border:"1px solid #3D3028",borderRadius:12,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#22c55e",marginBottom:8,letterSpacing:"0.5px",textTransform:"uppercase"}}>
                Mentions BTP obligatoires
              </div>
              <div style={{fontSize:10,color:"#6B6358",lineHeight:1.5,marginBottom:12}}>
                Pour tout devis de travaux &gt; 150 € TTC (décret n°2017-1809).
              </div>

              {/* Caractère gratuit / payant */}
              <div style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:"#9A8E82",marginBottom:6}}>LE DEVIS EST :</label>
                <div style={{display:"flex",gap:8}}>
                  <button
                    type="button"
                    onClick={()=>set("devisGratuit",true)}
                    style={{flex:1,background:local.devisGratuit!==false?"#0f2318":"#1A1612",color:local.devisGratuit!==false?"#22c55e":"#6B6358",border:`1.5px solid ${local.devisGratuit!==false?"#22c55e":"#3D3028"}`,borderRadius:10,padding:"9px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    Gratuit
                  </button>
                  <button
                    type="button"
                    onClick={()=>set("devisGratuit",false)}
                    style={{flex:1,background:local.devisGratuit===false?"#2d1a0a":"#1A1612",color:local.devisGratuit===false?"#f59e0b":"#6B6358",border:`1.5px solid ${local.devisGratuit===false?"#f59e0b":"#3D3028"}`,borderRadius:10,padding:"9px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    Payant
                  </button>
                </div>
                {local.devisGratuit===false && (
                  <input
                    value={local.devisTarif||""}
                    onChange={e=>set("devisTarif",e.target.value)}
                    placeholder="Tarif du devis (ex : 50 € TTC)"
                    style={{marginTop:8,width:"100%",background:"#1A1612",border:"1px solid #3D3028",borderRadius:10,padding:"9px 12px",fontSize:13,color:"white",outline:"none"}}/>
                )}
              </div>

              {/* Frais de déplacement */}
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:"#9A8E82",marginBottom:6}}>FRAIS DE DÉPLACEMENT</label>
                <input
                  value={local.travelFees||""}
                  onChange={e=>set("travelFees",e.target.value)}
                  placeholder="Ex : Gratuits dans un rayon de 30 km autour du Havre"
                  style={{width:"100%",background:"#1A1612",border:"1px solid #3D3028",borderRadius:10,padding:"9px 12px",fontSize:13,color:"white",outline:"none"}}/>
                <div style={{fontSize:10,color:"#6B6358",marginTop:5,lineHeight:1.4}}>Laissez vide s'ils sont déjà intégrés aux lignes du devis.</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#1A1612",borderTop:"1px solid #2A231C",padding:"12px 20px calc(14px + env(safe-area-inset-bottom))"}}>
        {/* Indicateur qualité discret */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{flex:1,height:4,background:"#2A231C",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${quality.percent}%`,background:quality.level.color,borderRadius:3,transition:"width .4s ease"}}/>
          </div>
          <span style={{fontSize:10,fontWeight:700,color:quality.level.color,whiteSpace:"nowrap"}}>
            {quality.level.label} · {quality.percent}%
          </span>
        </div>

        <div style={{display:"flex",gap:10}}>
          {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{flex:1,background:"#2A231C",color:"#9A8E82",border:"none",borderRadius:14,padding:"13px",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Retour</button>}
          {step<STEPS.length-1
            ? <button onClick={()=>{ if (!canGoNext) { setTryNext(true); return } setStep(s=>s+1) }}
                style={{flex:2,background:canGoNext?"#22c55e":"#3D3028",color:canGoNext?"white":"#6B6358",border:"none",borderRadius:14,padding:"13px",fontSize:14,fontWeight:700,cursor:canGoNext?"pointer":"not-allowed",transition:"all .15s"}}>
                Continuer →
              </button>
            : <button onClick={save} style={{flex:2,background:"#22c55e",color:"white",border:"none",borderRadius:14,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer"}}>✓ Enregistrer et commencer</button>
          }
        </div>
      </div>

      {deleteOpen && (
        <DeleteAccountModal
          myEmail={myEmail}
          confirm={deleteConfirm}
          setConfirm={setDeleteConfirm}
          busy={deleteBusy}
          error={deleteError}
          onClose={() => setDeleteOpen(false)}
          onConfirm={deleteMyAccount}
        />
      )}
    </div>
  )
}
