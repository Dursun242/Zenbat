import { Field } from "./shared.jsx"

// Étape « Contact » de l'onboarding (step===2).
export default function ContactStep({ local, set }) {
  return (
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
  )
}
