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

/**
 * @param {object} d        Devis ou facture (forme PDFViewer)
 * @param {object} cl       Client
 * @param {object} brand    Profil entreprise
 * @param {object} [opts]   { kind: "devis"|"facture", filename }
 * @returns {Promise<{ blob: Blob, base64: string, filename: string }>}
 */
export async function generatePdf(d, cl, brand, { kind = "devis", filename } = {}) {
  const fname = filename || `${d.numero || "document"}.pdf`;
  const doc = React.createElement(DevisPDFDocument, { d, cl, brand, kind });
  const blob = await pdf(doc).toBlob();
  const base64 = await blobToBase64(blob);
  return { blob, base64, filename: fname };
}
