// Export d'un client Zenbat vers le répertoire du téléphone (vCard .vcf).
// Le format vCard 3.0 est celui que les Contacts iOS et Android importent
// sans friction. La délivrance reprend le pattern openPdfPreview de
// PDFViewer.jsx : navigator.share (share sheet natif → « Ajouter aux
// contacts » sur iOS 15+) avec fallback <a download> pour desktop/Android.

import { displayName } from "./utils.js"

// Échappement RFC 2426 : les valeurs vCard doivent neutraliser \ ; , et
// les retours ligne.
function esc(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

export function buildVCard(c) {
  const company = (c?.raison_sociale || "").trim()
  const last    = (c?.nom || "").trim()
  const first   = (c?.prenom || "").trim()
  const fn      = displayName(c)

  const lines = ["BEGIN:VCARD", "VERSION:3.0"]

  // N: Famille;Prénom;;; — pour une entreprise sans contact nommé, on
  // reporte la raison sociale en nom de famille pour que la fiche se
  // classe correctement dans le répertoire.
  if (last || first) lines.push(`N:${esc(last)};${esc(first)};;;`)
  else if (company)  lines.push(`N:${esc(company)};;;;`)

  lines.push(`FN:${esc(fn)}`)
  if (company)      lines.push(`ORG:${esc(company)}`)
  if (c?.activite)  lines.push(`TITLE:${esc(c.activite)}`)
  if (c?.telephone)      lines.push(`TEL;TYPE=CELL:${esc(c.telephone)}`)
  if (c?.telephone_fixe) lines.push(`TEL;TYPE=WORK,VOICE:${esc(c.telephone_fixe)}`)
  if (c?.email)          lines.push(`EMAIL;TYPE=INTERNET:${esc(c.email)}`)

  if (c?.adresse || c?.ville || c?.code_postal) {
    // ADR: BP;Complément;Rue;Ville;Région;CP;Pays
    lines.push(`ADR;TYPE=WORK:;;${esc(c.adresse || "")};${esc(c.ville || "")};;${esc(c.code_postal || "")};France`)
  }

  // SIRET / TVA / NAF n'ont pas de champ vCard standard → regroupés dans
  // la note, à la suite des notes libres éventuelles.
  const meta = []
  if (c?.siret)     meta.push(`SIRET : ${c.siret}`)
  if (c?.tva_intra) meta.push(`TVA : ${c.tva_intra}`)
  if (c?.naf)       meta.push(`NAF : ${c.naf}`)
  const note = [c?.notes, meta.join(" · ")].filter(Boolean).join("\n")
  if (note) lines.push(`NOTE:${esc(note)}`)

  lines.push("END:VCARD")
  return lines.join("\r\n")
}

export async function saveContactToPhone(c) {
  const vcf  = buildVCard(c)
  const safe = displayName(c).replace(/[/\\:*?"<>|]/g, "").trim() || "contact"
  const filename = `${safe}.vcf`
  const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" })

  try {
    const file = new File([blob], filename, { type: "text/vcard" })
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename })
      return
    }
  } catch (e) {
    if (e?.name === "AbortError") return
  }

  const url = URL.createObjectURL(blob)
  const a   = document.createElement("a")
  a.href     = url
  a.download = filename
  a.rel      = "noopener"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
