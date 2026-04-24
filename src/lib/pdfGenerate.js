// Générateur PDF natif (vectoriel) — drop-in pour l'ancien renderElementToPdf.
// Retourne { blob, base64, filename } : même shape que l'ancienne API pour
// que les call-sites existants (Odoo Sign, Factur-X, téléchargement direct)
// continuent de fonctionner sans modification de leur logique métier.
import React from "react";
import { pdf } from "@react-pdf/renderer";
import DevisPDFDocument from "../components/DevisPDFDocument.jsx";

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || "");
      const comma = dataUrl.indexOf(",");
      resolve(comma === -1 ? "" : dataUrl.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

// Le décodeur d'images de @react-pdf/image plante ("out of bounds access")
// sur certains JPEG progressifs, WebP ou PNG avec chunks atypiques. On
// re-encode systématiquement le logo en PNG via canvas : on récupère
// toujours un PNG plat, prévisible, que react-pdf sait lire sans broncher.
async function normalizeLogoForPdf(src) {
  if (!src || typeof src !== "string") return null;
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("logo load failed"));
      i.src = src;
    });
    // Borne raisonnable : un logo > 600px de large est sur-échantillonné.
    const maxW = 600;
    const w = Math.min(img.naturalWidth || img.width || 200, maxW);
    const h = Math.round(((img.naturalHeight || img.height || 100) * w) / (img.naturalWidth || img.width || 200));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("[pdfGenerate] logo non décodable, ignoré :", err);
    return null;
  }
}

/**
 * @param {object} d        Devis ou facture (forme PDFViewer)
 * @param {object} cl       Client
 * @param {object} brand    Profil entreprise
 * @param {object} [opts]   { kind: "devis"|"facture", filename }
 * @returns {Promise<{ blob: Blob, base64: string, filename: string }>}
 */
export async function generatePdf(d, cl, brand, { kind = "devis", filename } = {}) {
  const fname = filename || `${d.numero || "document"}.pdf`;
  const safeLogo = await normalizeLogoForPdf(brand?.logo);
  const safeBrand = { ...brand, logo: safeLogo };
  const doc = React.createElement(DevisPDFDocument, { d, cl, brand: safeBrand, kind });
  const blob = await pdf(doc).toBlob();
  const base64 = await blobToBase64(blob);
  return { blob, base64, filename: fname };
}
