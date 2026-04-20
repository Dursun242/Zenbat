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

  if (drawH <= pageH) {
    const img = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(img, "JPEG", 0, 0, drawW, drawH, undefined, "FAST");
  } else {
    const pagePxH = Math.floor((pageH * canvas.width) / pageW);
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
      if (y < canvas.height) pdf.addPage();
    }
  }

  const blob = pdf.output("blob");
  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.split(",")[1] || "";
  return { blob, base64, filename };
}
