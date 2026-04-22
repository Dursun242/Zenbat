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
  const drawH = pageW * ratio; // hauteur réelle du contenu en mm

  if (drawH <= pageH) {
    // Contenu plus court que A4 : centré verticalement (pas d'étirement)
    const img = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(img, "JPEG", 0, 0, pageW, drawH, undefined, "FAST");
  } else if (drawH <= pageH * 1.5) {
    // Contenu jusqu'à 1,5× A4 (~445mm) : on scale proportionnellement
    // pour tout tenir sur une page. Maximum ~33% de réduction verticale.
    const scale = pageH / drawH;           // ex: 0.85 pour un doc de 350mm
    const scaledW = pageW * scale;
    const marginX = (pageW - scaledW) / 2; // centré horizontalement
    const img = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(img, "JPEG", marginX, 0, scaledW, pageH, undefined, "FAST");
  } else {
    // Très long document (> 445mm) : multi-page propre
    const pagePxH = Math.floor((pageH * canvas.width) / pageW);
    const MIN_REMAINING_PX = Math.round((8 * canvas.width) / pageW); // ≈ 8mm
    let y = 0;
    while (y < canvas.height) {
      const remaining = canvas.height - y;
      // Si le reste est trop petit pour une page entière mais pas negligeable,
      // on réduit la tranche précédente pour laisser plus de place au dernier bloc.
      const sliceH = Math.min(pagePxH, remaining);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d");
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const img = slice.toDataURL("image/jpeg", 0.92);
      const thisH = (sliceH * pageW) / canvas.width;
      pdf.addImage(img, "JPEG", 0, 0, pageW, thisH, undefined, "FAST");
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
