export const fmt  = n => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0)
export const fmtD = d => d ? new Date(d).toLocaleDateString("fr-FR") : "—"
export const uid  = () => (typeof crypto !== "undefined" && crypto.randomUUID)
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2)

// Validation email — basée sur la spec HTML5 mais on impose au moins un
// TLD (un point après le domaine). HTML5 accepte `user@example` car
// `example` peut être un hostname réseau local, ce qui n'a aucun sens
// pour un email professionnel d'artisan facturant ses clients.
// Couvre aussi le cas typique "Kontelec76@gmail. Com" (autocap iOS).
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

// Sanitize input email : supprime tous les caractères blancs (insécables
// inclus). On ne touche pas à la casse — RFC 5321 garde la partie locale
// sensible à la casse même si en pratique personne ne le respecte.
export const sanitizeEmail = (s) => (s ?? "").replace(/\s+/g, "")

export const isValidEmail = (s) => {
  const v = sanitizeEmail(s)
  return v.length > 0 && v.length <= 254 && EMAIL_RE.test(v)
}

export const displayName = (c) =>
  c?.raison_sociale?.trim() || `${c?.prenom || ""} ${c?.nom || ""}`.trim() || "—"

export const emptyClient = () => ({
  id: uid(),
  type: "particulier",
  raison_sociale: "",
  nom: "", prenom: "",
  email: "", telephone: "", telephone_fixe: "",
  adresse: "", code_postal: "", ville: "",
  siret: "", tva_intra: "",
  activite: "", notes: "",
})
