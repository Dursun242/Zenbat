import { Field } from "./shared.jsx"
import { sanitizeEmail, isValidEmail } from "../../lib/utils.js"

// Étape « Contact » de l'onboarding (step===2).
export default function ContactStep({ local, set, tryNext }) {
  // Sanitize à la frappe : retire les espaces (cas autocorrect iOS qui
  // insère un espace après "@gmail." → on attrape avant que ça pollue
  // brand_data et finisse imprimé sur les PDF des clients).
  const setEmail = (v) => set("email", sanitizeEmail(v))
  const emailFilled = (local.email || "").trim().length > 0
  const emailInvalid = emailFilled && !isValidEmail(local.email)
  const emailMissingOnSubmit = tryNext && !emailFilled
  return (
    <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Field dark required label="Adresse" val={local.address} onChange={v=>set("address",v)} placeholder="12 rue des Artisans"
        hint="Obligatoire pour identifier l'émetteur du devis."/>
      <Field dark required label="Ville / Code postal" val={local.city} onChange={v=>set("city",v)} placeholder="76600 Le Havre"/>
      <Field dark required label="Téléphone" val={local.phone} onChange={v=>set("phone",v)} placeholder="02 35 00 00 00"
        hint="Permet à vos clients de vous joindre depuis le devis."/>
      <Field dark required type="email" label="Email professionnel" val={local.email} onChange={setEmail} placeholder="contact@monentreprise.fr"
        invalid={emailInvalid || emailMissingOnSubmit}
        hint={emailInvalid
          ? "Format invalide. Exemple : contact@monentreprise.fr"
          : emailMissingOnSubmit
            ? "Email obligatoire pour la signature électronique des devis."
            : "Indispensable pour la signature électronique du devis."}/>
      <Field dark label="Site web" val={local.website} onChange={v=>set("website",v)} placeholder="www.monentreprise.fr"/>
    </div>
  )
}
