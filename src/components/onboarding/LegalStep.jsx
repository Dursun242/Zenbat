import { Field } from "./shared.jsx"

// Étape « Mentions légales » (step===4) :
// IBAN/BIC, conditions de paiement, mentions légales du pied de devis,
// mentions facture B2B obligatoires (CGI 242 nonies A + C. com. L441-10),
// mentions BTP (décret 2017-1809).
export default function LegalStep({ local, set }) {
  return (
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
  )
}
