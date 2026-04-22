import { useState, useRef, useEffect } from "react"
import { fmt, fmtD } from "../lib/utils.js"

const Ix = {
  pdf:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M8 13h8M8 17h5"/></svg>,
  x:    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  odoo: <svg width="15" height="15" viewBox="0 0 24 24" fill="#714B67"><circle cx="12" cy="12" r="3"/><circle cx="4" cy="12" r="3"/><circle cx="20" cy="12" r="3"/></svg>,
}

export default function PDFViewer({ d, cl, brand, onClose, hidden=false, onPageReady, onSendOdoo, sending=false, sent=false, kind="devis" }) {
  const docLabel = kind === "facture" ? "FACTURE" : "DEVIS";
  const MM_TO_PX = 3.7795275591
  const A4_PX = 210 * MM_TO_PX
  const wrapRef = useRef(null)
  const pageRef = useRef(null)
  const [fitScale, setFitScale] = useState(() => {
    if (hidden || typeof window === "undefined") return 1
    const avail = Math.max(240, window.innerWidth - 32)
    return Math.min(1, avail / A4_PX)
  })
  const [userZoom, setUserZoom] = useState(1)
  const scale = hidden ? 1 : fitScale * userZoom
  const [pageH, setPageH] = useState(null)

  useEffect(() => {
    if (hidden || !wrapRef.current) return
    const compute = () => {
      const w = wrapRef.current?.clientWidth || (window.innerWidth - 32)
      setFitScale(Math.min(1, w / A4_PX))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [hidden])

  useEffect(() => {
    if (hidden || !pageRef.current) return
    const measure = () => {
      const h = pageRef.current?.offsetHeight || 0
      setPageH(h * scale)
    }
    measure()
    const id = setTimeout(measure, 50)
    return () => clearTimeout(id)
  }, [scale, d.numero, hidden])

  const firedReadyRef = useRef(false)
  useEffect(() => {
    if (!onPageReady || !pageRef.current || firedReadyRef.current) return
    const id = setTimeout(() => {
      if (pageRef.current && !firedReadyRef.current) {
        firedReadyRef.current = true
        onPageReady(pageRef.current)
      }
    }, 400)
    return () => clearTimeout(id)
  }, [onPageReady])

  const lignes = d.lignes || []
  const ouvrages = lignes.filter(l => l.type_ligne === "ouvrage")
  const rateOf = (l) => Number(l.tva_rate ?? d.tva_rate ?? 20)
  const ht = ouvrages.reduce((s, l) => s + ((l.quantite||0) * (l.prix_unitaire||0)), 0)
  const tvaGroups = ouvrages.reduce((acc, l) => {
    const r = rateOf(l)
    const lineHt = (l.quantite||0) * (l.prix_unitaire||0)
    acc[r] = (acc[r] || 0) + lineHt
    return acc
  }, {})
  const tvaRows = Object.keys(tvaGroups).map(r => Number(r)).sort((a,b) => a-b).map(r => ({
    rate: r, base: tvaGroups[r], montant: tvaGroups[r] * (r/100),
  }))
  const tva = tvaRows.reduce((s, row) => s + row.montant, 0)
  const ttc = ht + tva
  const fontFamily = brand.fontStyle==="elegant"?"Playfair Display":brand.fontStyle==="tech"?"Space Grotesk":"DM Sans"
  const navy = "#1e3a5f"
  const validUntil = new Date(d.date_emission)
  validUntil.setDate(validUntil.getDate() + (brand.validityDays || 30))
  const clientName = cl?.raison_sociale || `${cl?.prenom||""} ${cl?.nom||""}`.trim() || "—"

  const clientLines = [
    cl?.adresse,
    [cl?.code_postal, cl?.ville].filter(Boolean).join(" "),
    cl?.email,
    cl?.telephone && `Tél : ${cl.telephone}`,
  ].filter(Boolean)

  const companyLines = [
    brand.address,
    [brand.postalCode, brand.city].filter(Boolean).join(" ") || brand.city,
    brand.phone && `Tél : ${brand.phone}`,
    brand.email,
    brand.siret && `SIRET : ${brand.siret}`,
  ].filter(Boolean)

  const pageBody = (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,paddingBottom:12,borderBottom:`2px solid ${navy}`}}>
        <div>
          {brand.logo && <img src={brand.logo} alt="" style={{height:44,maxWidth:180,objectFit:"contain",display:"block",marginBottom:6}}/>}
          <div style={{fontWeight:800,fontSize:16,color:navy}}>{brand.companyName||"Votre Entreprise"}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:"#94a3b8",fontSize:10,fontWeight:600,letterSpacing:"2px"}}>{docLabel}</div>
          <div style={{color:navy,fontWeight:800,fontSize:20,marginTop:2}}>{d.numero}</div>
          <div style={{color:"#64748b",fontSize:10,marginTop:6}}>Émis le <strong style={{color:"#1a1a1a"}}>{fmtD(d.date_emission)}</strong></div>
          <div style={{color:"#64748b",fontSize:10}}>Valide jusqu'au <strong style={{color:"#1a1a1a"}}>{fmtD(validUntil.toISOString())}</strong></div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div style={{border:"1px solid #d4d4d8",borderRadius:4,padding:"10px 12px",minHeight:110}}>
          <div style={{fontSize:9,color:"#6b7280",fontWeight:700,letterSpacing:"1px",marginBottom:6}}>ENTREPRISE</div>
          <div style={{fontSize:13,fontWeight:700,color:"#111",marginBottom:4}}>{brand.companyName||"—"}</div>
          {companyLines.map((line,i)=>(<div key={i} style={{fontSize:10,color:"#4b5563",lineHeight:1.6}}>{line}</div>))}
        </div>
        <div style={{border:"1px solid #d4d4d8",borderRadius:4,padding:"10px 12px",minHeight:110}}>
          <div style={{fontSize:9,color:"#6b7280",fontWeight:700,letterSpacing:"1px",marginBottom:6}}>MAÎTRE D'OUVRAGE</div>
          <div style={{fontSize:13,fontWeight:700,color:"#111",marginBottom:4}}>{clientName}</div>
          {clientLines.map((line,i)=>(<div key={i} style={{fontSize:10,color:"#4b5563",lineHeight:1.6}}>{line}</div>))}
        </div>
      </div>

      {(d.ville_chantier||d.objet)&&(
        <div style={{background:"#f8f9fb",border:"1px solid #e5e7eb",borderRadius:4,padding:"8px 12px",marginBottom:14,fontSize:10,color:"#374151"}}>
          {d.objet && <div><strong>Objet :</strong> {d.objet}</div>}
          {d.ville_chantier && <div><strong>Chantier :</strong> {d.ville_chantier}</div>}
        </div>
      )}

      <div style={{fontSize:11,fontWeight:700,color:navy,marginBottom:8}}>DÉTAIL DES PRESTATIONS</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,marginBottom:14}}>
        <thead>
          <tr style={{background:navy,color:"white"}}>
            <th style={{textAlign:"left",padding:"8px 10px",fontWeight:600}}>Description</th>
            <th style={{textAlign:"center",padding:"8px 6px",fontWeight:600,width:50}}>Unité</th>
            <th style={{textAlign:"center",padding:"8px 6px",fontWeight:600,width:45}}>Qté</th>
            <th style={{textAlign:"right",padding:"8px 8px",fontWeight:600,width:70}}>PU HT</th>
            <th style={{textAlign:"center",padding:"8px 6px",fontWeight:600,width:50}}>TVA</th>
            <th style={{textAlign:"right",padding:"8px 10px",fontWeight:600,width:80}}>Total HT</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l,i)=>{
            if(l.type_ligne==="lot") return (
              <tr key={l.id}>
                <td colSpan={6} style={{padding:"8px 10px",fontWeight:700,fontSize:10,color:navy,textTransform:"uppercase",letterSpacing:".5px",borderBottom:`1px solid ${navy}33`,background:"#eef2f7"}}>{l.designation}</td>
              </tr>
            )
            const total = (l.quantite||0)*(l.prix_unitaire||0)
            return (
              <tr key={l.id} style={{background:i%2?"#f8f9fb":"white",borderBottom:"1px solid #e5e7eb"}}>
                <td style={{padding:"7px 10px"}}>{l.designation}</td>
                <td style={{padding:"7px 6px",textAlign:"center",color:"#6b7280"}}>{l.unite||"—"}</td>
                <td style={{padding:"7px 6px",textAlign:"center"}}>{l.quantite}</td>
                <td style={{padding:"7px 8px",textAlign:"right"}}>{fmt(l.prix_unitaire)}</td>
                <td style={{padding:"7px 6px",textAlign:"center",color:"#6b7280"}}>{rateOf(l).toString().replace(".",",")}%</td>
                <td style={{padding:"7px 10px",textAlign:"right",fontWeight:600}}>{fmt(total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
        <table style={{fontSize:10,borderCollapse:"collapse",minWidth:260}}>
          <tbody>
            <tr><td style={{padding:"4px 10px",color:"#4b5563"}}>Total HT</td><td style={{padding:"4px 10px",textAlign:"right",fontWeight:600}}>{fmt(ht)}</td></tr>
            {tvaRows.map(row=>(
              <tr key={row.rate}>
                <td style={{padding:"4px 10px",color:"#4b5563"}}>TVA {row.rate.toString().replace(".",",")}%<span style={{color:"#9ca3af",fontSize:9,marginLeft:4}}>(sur {fmt(row.base)})</span></td>
                <td style={{padding:"4px 10px",textAlign:"right"}}>{fmt(row.montant)}</td>
              </tr>
            ))}
            <tr style={{background:"#eef2f7",borderTop:`2px solid ${navy}`}}>
              <td style={{padding:"8px 10px",fontWeight:800,color:navy,fontSize:11}}>TOTAL TTC</td>
              <td style={{padding:"8px 10px",textAlign:"right",fontWeight:800,color:navy,fontSize:12}}>{fmt(ttc)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {(d.observations||brand.defaultObservations)&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:navy,marginBottom:4}}>OBSERVATIONS</div>
          <div style={{fontSize:10,color:"#374151",lineHeight:1.6}}>{d.observations||brand.defaultObservations}</div>
        </div>
      )}
      {brand.paymentTerms&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:navy,marginBottom:4}}>CONDITIONS</div>
          <div style={{fontSize:10,color:"#374151",lineHeight:1.6}}>{brand.paymentTerms}</div>
        </div>
      )}
      {brand.rib&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:navy,marginBottom:4}}>COORDONNÉES BANCAIRES</div>
          <div style={{fontSize:10,color:"#374151"}}>{brand.rib}</div>
          {brand.iban&&<div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>IBAN : {brand.iban}</div>}
          {brand.bic&&<div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>BIC : {brand.bic}</div>}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:20,paddingTop:14,borderTop:"1px solid #d4d4d8"}}>
        <div>
          <div style={{fontSize:9,color:"#6b7280",fontWeight:700,letterSpacing:"1px",marginBottom:6}}>SIGNATURE CLIENT · Bon pour accord</div>
          <div style={{height:60,borderBottom:"1px solid #9ca3af"}}/>
        </div>
        <div>
          <div style={{fontSize:9,color:"#6b7280",fontWeight:700,letterSpacing:"1px",marginBottom:6}}>DATE</div>
          <div style={{height:60,borderBottom:"1px solid #9ca3af"}}/>
        </div>
      </div>

      <div style={{marginTop:18,paddingTop:10,borderTop:"1px solid #e5e7eb",display:"flex",justifyContent:"space-between",gap:10,fontSize:8,color:"#9ca3af",lineHeight:1.5}}>
        <div style={{flex:1}}>
          {brand.vatRegime === "franchise" && !/(293\s*B|TVA\s+non\s+applicable)/i.test(brand.mentionsLegales || "") && (
            <div style={{fontWeight:600,color:"#6b7280",marginBottom:2}}>TVA non applicable, art. 293 B du CGI</div>
          )}
          {brand.mentionsLegales}
          {brand.siret && <div>SIRET {brand.siret}</div>}
        </div>
        <div style={{textAlign:"right"}}>Généré via Zenbat</div>
      </div>
    </>
  )

  if (hidden) {
    return (
      <div aria-hidden="true" style={{position:"fixed",left:-99999,top:0,pointerEvents:"none",opacity:0}}>
        <div ref={pageRef} className="pdf-page" style={{background:"white",width:"210mm",minHeight:"297mm",padding:"15mm",fontFamily,color:"#1a1a1a",fontSize:11,lineHeight:1.5,boxSizing:"border-box"}}>
          {pageBody}
        </div>
      </div>
    )
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:200,display:"flex",flexDirection:"column"}} className="fu pdf-modal">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          body > *:not(.pdf-modal) { display: none !important; }
          .pdf-modal { position: static !important; background: white !important; }
          .pdf-modal .pdf-toolbar { display: none !important; }
          .pdf-modal .pdf-scroll { overflow: visible !important; padding: 0 !important; background: white !important; }
          .pdf-modal .pdf-page-wrap { width: auto !important; height: auto !important; }
          .pdf-modal .pdf-page { transform: none !important; position: static !important; box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; width: 210mm !important; min-height: 297mm !important; max-width: none !important; }
        }
      `}</style>

      <div className="pdf-toolbar" style={{background:"#0f172a",padding:"calc(12px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right)) 12px calc(18px + env(safe-area-inset-left))",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{color:"#22c55e"}}>{Ix.pdf}</div>
          <span style={{color:"white",fontSize:13,fontWeight:600}}>{d.numero}.pdf</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <div style={{display:"flex",background:"#1e293b",borderRadius:10,overflow:"hidden"}}>
            <button onClick={()=>setUserZoom(z=>Math.max(0.5,+(z-0.25).toFixed(2)))} style={{background:"none",border:"none",color:"#94a3b8",width:30,height:30,fontSize:16,cursor:"pointer",padding:0}} aria-label="Dézoomer">−</button>
            <button onClick={()=>setUserZoom(1)} style={{background:"none",border:"none",color:"#94a3b8",padding:"0 8px",fontSize:11,fontWeight:600,cursor:"pointer",minWidth:44}} aria-label="Réinitialiser zoom">{Math.round(scale*100)}%</button>
            <button onClick={()=>setUserZoom(z=>Math.min(3,+(z+0.25).toFixed(2)))} style={{background:"none",border:"none",color:"#94a3b8",width:30,height:30,fontSize:16,cursor:"pointer",padding:0}} aria-label="Zoomer">+</button>
          </div>
          <button
            onClick={async () => {
              try {
                const { renderElementToPdf } = await import("../lib/pdf.js")
                const { blob } = await renderElementToPdf(pageRef.current, { filename: `${d.numero}.pdf` })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `${d.numero}.pdf`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                setTimeout(() => URL.revokeObjectURL(url), 3000)
              } catch (e) {
                console.error("[pdf download]", e)
                alert("Impossible de générer le PDF : " + (e.message || e))
              }
            }}
            title="Télécharger le PDF"
            style={{background:"#22c55e",color:"white",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>⬇</button>
          <button onClick={onClose} style={{background:"#1e293b",color:"#94a3b8",border:"none",borderRadius:10,padding:"7px 10px",cursor:"pointer"}}>{Ix.x}</button>
        </div>
      </div>

      <div className="pdf-scroll" ref={wrapRef} style={{flex:1,overflow:"auto",padding:"16px 16px calc(20px + env(safe-area-inset-bottom))",background:"#1e293b"}}>
        <div className="pdf-page-wrap" style={{width:`calc(210mm * ${scale})`,height:pageH?`${pageH}px`:"auto",margin:"0 auto",position:"relative"}}>
          <div ref={pageRef} className="pdf-page" style={{background:"white",width:"210mm",minHeight:"297mm",boxShadow:"0 20px 60px rgba(0,0,0,.5)",padding:"15mm",fontFamily,color:"#1a1a1a",fontSize:11,lineHeight:1.5,boxSizing:"border-box",transform:`scale(${scale})`,transformOrigin:"top left",position:"absolute",top:0,left:0}}>
            {pageBody}
          </div>
        </div>
      </div>

      {onSendOdoo && (
        <div style={{flexShrink:0,padding:"12px 18px calc(12px + env(safe-area-inset-bottom))",background:"#0f172a",borderTop:"1px solid #1e293b",display:"flex",gap:10}}>
          <button onClick={onClose} style={{background:"#1e293b",color:"#94a3b8",border:"none",borderRadius:12,padding:"12px 16px",fontSize:13,fontWeight:600,cursor:"pointer",flexShrink:0}}>← Retour</button>
          <button onClick={sent ? undefined : onSendOdoo} disabled={sending||sent}
            style={{flex:1,background:sent?"#166534":sending?"#4b3557":"#714B67",color:"white",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:(sending||sent)?"default":"pointer",transition:"background .4s"}}>
            {sent
              ? <>✓ Envoyé !</>
              : sending
                ? <><span style={{display:"inline-block",width:14,height:14,border:"2px solid white",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite"}}/> Envoi en cours…</>
                : <>{Ix.odoo} Envoyer en signature Odoo Sign</>
            }
          </button>
        </div>
      )}
    </div>
  )
}
