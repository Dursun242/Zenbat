// Génère un PDF à partir d'un élément DOM (la page de devis rendue).
// La page PDF a exactement la hauteur du contenu (pas de blanc en bas).
// Retourne { blob, base64 } — base64 sans le préfixe data:.
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_W_MM = 210;
const A4_H_MM = 297;

export async function renderElementToPdf(el, { filename = "document.pdf" } = {}) {
  if (!el) throw new Error("Élément cible introuvable pour le rendu PDF.");

  // Le preview de devis utilise souvent `transform: scale(fitScale)` pour
  // tenir à l'écran (surtout sur mobile). html2canvas gère mal ce transform
  // et capture soit à la mauvaise taille, soit à une résolution dégradée,
  // d'où des PDF pixelisés quand on zoome. On neutralise donc le transform
  // pendant la capture, l'élément est masqué via opacity:0 pour éviter
  // tout flash visuel.
  const saved = {
    transform:  el.style.transform,
    position:   el.style.position,
    opacity:    el.style.opacity,
    pointer:    el.style.pointerEvents,
  };
  el.style.transform = "none";
  el.style.opacity   = "0";
  el.style.pointerEvents = "none";
  if (saved.position !== "absolute" && saved.position !== "fixed") {
    el.style.position = "absolute";
  }
  // force reflow
  // eslint-disable-next-line no-unused-expressions
  el.offsetHeight;

  let canvas;
  try {
    canvas = await html2canvas(el, {
      scale: 3,               // 300dpi-ish en A4, fini le zoom pixelisé
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 15000,
    });
  } finally {
    el.style.transform = saved.transform;
    el.style.position  = saved.position;
    el.style.opacity   = saved.opacity;
    el.style.pointerEvents = saved.pointer;
  }

  const pageW  = A4_W_MM;
  const ratio  = canvas.height / canvas.width;
  const drawH  = pageW * ratio; // hauteur réelle du contenu en mm

  if (drawH <= A4_H_MM * 1.5) {
    // Contenu court ou moyen : 1 page à la hauteur exacte du contenu
    // (jamais de blanc en bas), ou légèrement réduit pour tenir en A4.
    const pageH = Math.min(drawH, A4_H_MM); // hauteur PDF = contenu ou A4 max
    const pdf   = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: "portrait" });
    const img   = canvas.toDataURL("image/jpeg", 0.95);

    if (drawH <= A4_H_MM) {
      // Contenu plus court que A4 : page à la taille exacte du contenu
      pdf.addImage(img, "JPEG", 0, 0, pageW, drawH, undefined, "FAST");
    } else {
      // Contenu entre A4 et 1,5× A4 : réduit proportionnellement pour tenir en A4
      const scale   = A4_H_MM / drawH;
      const scaledW = pageW * scale;
      const marginX = (pageW - scaledW) / 2;
      pdf.addImage(img, "JPEG", marginX, 0, scaledW, A4_H_MM, undefined, "FAST");
    }

    const blob    = pdf.output("blob");
    const dataUri = pdf.output("datauristring");
    return { blob, base64: dataUri.split(",")[1] || "", filename };
  }

  // Très long document (> 445mm) : multi-page A4
  const pdf      = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pagePxH  = Math.floor((A4_H_MM * canvas.width) / pageW);
  const MIN_REM  = Math.round((8 * canvas.width) / pageW); // ≈ 8mm en pixels
  let y = 0;
  while (y < canvas.height) {
    const sliceH = Math.min(pagePxH, canvas.height - y);
    const slice  = document.createElement("canvas");
    slice.width  = canvas.width;
    slice.height = sliceH;
    slice.getContext("2d").drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    const img    = slice.toDataURL("image/jpeg", 0.95);
    const thisH  = (sliceH * pageW) / canvas.width;
    pdf.addImage(img, "JPEG", 0, 0, pageW, thisH, undefined, "FAST");
    y += sliceH;
    if (canvas.height - y > MIN_REM) pdf.addPage();
    else break;
  }

  const blob    = pdf.output("blob");
  const dataUri = pdf.output("datauristring");
  return { blob, base64: dataUri.split(",")[1] || "", filename };
}
