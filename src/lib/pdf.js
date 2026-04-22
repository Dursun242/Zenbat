// Génère un PDF A4 à partir d'un élément DOM (la page de devis rendue).
// Retourne { blob, base64 } — base64 sans le préfixe data:.
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_W_MM = 210;
const A4_H_MM = 297;

export async function renderElementToPdf(el, { filename = "document.pdf" } = {}) {
  if (!el) throw new Error("Élément cible introuvable pour le rendu PDF.");
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = A4_W_MM;
  const pageH = A4_H_MM;
  const ratio = canvas.height / canvas.width;
  const drawW = pageW;
  const drawH = pageW * ratio;

  // Tolérance : si la hauteur dépasse d'un poil (rendu CSS, arrondi html2canvas),
  // on encaisse sur une seule page plutôt que de créer une 2e page quasi vide.
  const SINGLE_PAGE_TOLERANCE_MM = 15;

  if (drawH <= pageH + SINGLE_PAGE_TOLERANCE_MM) {
    const img = canvas.toDataURL("image/jpeg", 0.92);
    // Si on déborde légèrement, on squeeze pour rester sur 1 page.
    const h = Math.min(drawH, pageH);
    pdf.addImage(img, "JPEG", 0, 0, drawW, h, undefined, "FAST");
  } else {
    const pagePxH = Math.floor((pageH * canvas.width) / pageW);
    // Seuil en pixels canvas en dessous duquel on ne crée PAS de nouvelle page
    // (évite les pages blanches ou presque quand le dernier slice est minuscule).
    const MIN_REMAINING_PX = Math.round((5 * canvas.width) / pageW); // ≈ 5 mm
    let y = 0;
    while (y < canvas.height) {
      const sliceH = Math.min(pagePxH, canvas.height - y);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d");
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const img = slice.toDataURL("image/jpeg", 0.92);
      const thisH = (sliceH * pageW) / canvas.width;
      pdf.addImage(img, "JPEG", 0, 0, drawW, thisH, undefined, "FAST");
      y += sliceH;
      if (canvas.height - y > MIN_REMAINING_PX) pdf.addPage();
      else break;
    }
  }

  const blob = pdf.output("blob");
  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.split(",")[1] || "";
  return { blob, base64, filename };
}
