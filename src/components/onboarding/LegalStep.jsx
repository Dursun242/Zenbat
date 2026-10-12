import { Field, Section, labelStyle, inputStyle, textareaStyle, hintStyle, choiceStyle } from "./shared.jsx"
import { ZB } from "../../lib/theme.js"

// Étape « Mentions légales » (step===4) :
// IBAN/BIC, conditions de paiement, mentions légales du pied de devis,
// mentions facture B2B obligatoires (CGI 242 nonies A + C. com. L441-10),
// mentions BTP (décret 2017-1809).
export default function LegalStep({ local, set }) {
  return (
    <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Field label="RIB / Nom de la banque" val={local.rib} onChange={v=>set("rib",v)} placeholder="Crédit Mutuel — Agence Le Havre"/>
      <Field required label="IBAN" val={local.iban} onChange={v=>set("iban",v)} placeholder="FR76 1234 5678 9012 3456 7890 123"
        hint="Sans IBAN, tes clients ne peuvent pas régler par virement."/>
      <Field label="BIC / SWIFT" val={local.bic} onChange={v=>set("bic",v)} placeholder="CMCIFRPP"/>
      <label style={{display:"block"}}>
        <span style={labelStyle}>Conditions de paiement</span>
        <textarea value={local.paymentTerms} onChange={e=>set("paymentTerms",e.target.value)} rows={3}
          style={textareaStyle}/>
      </label>
      <label style={{display:"block"}}>
        <span style={labelStyle}>
          Mentions légales (pied de devis)<span aria-hidden="true" style={{color:ZB.ink2,marginLeft:2}}>*</span>
        </span>
        <textarea value={local.mentionsLegales} onChange={e=>set("mentionsLegales",e.target.value)} rows={4}
          placeholder="Ex : Assurance RC pro n°... — TVA non applicable art. 293B..." aria-required="true"
          style={textareaStyle}/>
        <span style={{...hintStyle,display:"block"}}>À inclure obligatoirement : n° de RC pro (responsabilité civile professionnelle) + n° de décennale si BTP (loi Spinetta 1978) + mention du régime TVA. Exemple : « Assurance RC pro MAAF n°12345 — Décennale AXA n°67890 ».</span>
      </label>
      <label style={{display:"block"}}>
        <span style={labelStyle}>Validité du devis (jours)</span>
        <input type="number" inputMode="numeric" value={local.validityDays} onChange={e=>set("validityDays",parseInt(e.target.value)||30)}
          style={{...inputStyle,maxWidth:160}}/>
      </label>

      {/* Mentions facture obligatoires (CGI 242 nonies A + C. com. L441-10) */}
      <Section title="Mentions facture" sub="Obligatoires sur toute facture B2B (art. 242 nonies A du CGI).">
        <Field label="Forme juridique" val={local.legalForm} onChange={v=>set("legalForm",v)} placeholder="SAS, SARL, EI, auto-entrepreneur…"/>
        <Field label="RCS (si commerçant)" val={local.rcs} onChange={v=>set("rcs",v)} placeholder="RCS Le Havre 123 456 789"
          hint="Numéro d'inscription au Registre du Commerce et des Sociétés + ville du greffe."/>
        <Field label="Capital social (sociétés uniquement)" val={local.capital} onChange={v=>set("capital",v)} placeholder="Ex : 10 000 €"/>
        <label style={{display:"block"}}>
          <span style={labelStyle}>Pénalités de retard</span>
          <textarea value={local.paymentPenalties||""} onChange={e=>set("paymentPenalties",e.target.value)} rows={2}
            style={textareaStyle}/>
          <span style={{...hintStyle,display:"block"}}>Mention obligatoire (L441-10 C. com.) — taux + indemnité forfaitaire 40 €.</span>
        </label>
        <label style={{display:"block"}}>
          <span style={labelStyle}>Escompte pour paiement anticipé</span>
          <textarea value={local.escompte||""} onChange={e=>set("escompte",e.target.value)} rows={2}
            style={textareaStyle}/>
        </label>
      </Section>

      {/* Mentions BTP obligatoires (décret 2017-1809) */}
      <Section title="Mentions BTP obligatoires" sub="Pour tout devis de travaux > 150 € TTC (décret n°2017-1809).">
        {/* Caractère gratuit / payant */}
        <div>
          <span style={labelStyle} id="onb-devis-prix">Le devis est</span>
          <div role="radiogroup" aria-labelledby="onb-devis-prix" style={{display:"flex",gap:8}}>
            <button
              type="button" role="radio" aria-checked={local.devisGratuit!==false}
              onClick={()=>set("devisGratuit",true)}
              style={{...choiceStyle(local.devisGratuit!==false),flex:1,padding:"0 10px",fontSize:15,fontWeight:local.devisGratuit!==false?700:500}}>
              Gratuit
            </button>
            <button
              type="button" role="radio" aria-checked={local.devisGratuit===false}
              onClick={()=>set("devisGratuit",false)}
              style={{...choiceStyle(local.devisGratuit===false),flex:1,padding:"0 10px",fontSize:15,fontWeight:local.devisGratuit===false?700:500}}>
              Payant
            </button>
          </div>
          {local.devisGratuit===false && (
            <input
              value={local.devisTarif||""}
              onChange={e=>set("devisTarif",e.target.value)}
              placeholder="Tarif du devis (ex : 50 € TTC)"
              aria-label="Tarif du devis"
              style={{...inputStyle,marginTop:8}}/>
          )}
        </div>

        {/* Frais de déplacement */}
        <label style={{display:"block"}}>
          <span style={labelStyle}>Frais de déplacement</span>
          <input
            value={local.travelFees||""}
            onChange={e=>set("travelFees",e.target.value)}
            placeholder="Ex : Gratuits dans un rayon de 30 km autour du Havre"
            style={inputStyle}/>
          <span style={{...hintStyle,display:"block"}}>Laisse vide s'ils sont déjà intégrés aux lignes du devis.</span>
        </label>
      </Section>
    </div>
  )
}
