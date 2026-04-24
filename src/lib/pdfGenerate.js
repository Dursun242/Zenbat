// Générateur PDF côté serveur via /api/render-pdf (Puppeteer + Chromium).
// Le rendu est strictement aligné sur l'aperçu HTML de PDFViewer.jsx
// puisqu'on imprime via le même moteur Chromium qui rend l'app.
//
// Retourne { blob, base64, filename } : même shape que l'ancienne API
// pour que les call-sites (Odoo Sign, Factur-X, téléchargement direct)
// fonctionnent sans modification.
import { supabase } from "./supabase.js"

function base64ToBlob(base64, mime = "application/pdf") {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * @param {object} d        Devis ou facture (forme PDFViewer)
 * @param {object} cl       Client
 * @param {object} brand    Profil entreprise
 * @param {object} [opts]   { kind: "devis"|"facture", filename }
 * @returns {Promise<{ blob: Blob, base64: string, filename: string }>}
 */
export async function generatePdf(d, cl, brand, { kind = "devis", filename } = {}) {
  const fname = filename || `${d?.numero || "document"}.pdf`

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error("Session expirée — reconnectez-vous")

  const res = await fetch("/api/render-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ d, cl, brand, kind }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || `HTTP ${res.status}`)
  }

  const base64 = data.pdf_base64
  if (!base64) throw new Error("Réponse invalide : pdf_base64 manquant")

  const blob = base64ToBlob(base64)
  return { blob, base64, filename: fname }
}
