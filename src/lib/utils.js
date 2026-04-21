export const fmt  = n => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0)
export const fmtD = d => d ? new Date(d).toLocaleDateString("fr-FR") : "—"
export const uid  = () => (typeof crypto !== "undefined" && crypto.randomUUID)
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2)

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
