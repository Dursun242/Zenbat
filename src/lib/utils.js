export const fmt  = n => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0)
export const fmtD = d => d ? new Date(d).toLocaleDateString("fr-FR") : "—"
export const uid  = () => (typeof crypto !== "undefined" && crypto.randomUUID)
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2)
