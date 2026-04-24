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
  // d'où des PDF pixelisés quand on zoome. Stratégie : on clone le nœud
  // et on l'ajoute hors-champ (sans transform), puis on capture le clone —
  // l'élément visible par l'utilisateur n'est JAMAIS modifié, donc pas de
  // flash, pas de risque de capturer un élément masqué.
  const clone = el.cloneNode(true);
  // Reset des styles susceptibles de gêner la capture
  clone.style.transform    = "none";
  clone.style.position     = "fixed";
  clone.style.top          = "0";
  clone.style.left         = "-99999px";
  clone.style.opacity      = "1";
  clone.style.visibility   = "visible";
  clone.style.pointerEvents= "none";
  clone.style.margin       = "0";
  clone.style.zIndex       = "-1";
  document.body.appendChild(clone);

  // Un tick pour laisser le navigateur recalculer le layout du clone
  await new Promise((r) => requestAnimationFrame(() => r()));

  // Force le téléchargement effectif des 3 Google Fonts utilisées dans les
  // devis / factures AVANT la capture. `document.fonts.ready` seul ne suffit
  // pas : le navigateur ne télécharge une police qu'à la première utilisation
  // effective. Si l'utilisateur arrive sur le PDF sans avoir scrollé l'aperçu,
  // html2canvas rasterise avec la police système fallback (Arial / Helvetica)
  // → rendu "bizarre" par rapport à l'aperçu HTML.
  if (document.fonts?.load) {
    const families = ["DM Sans", "Playfair Display", "Space Grotesk"];
    const weights  = [400, 600, 700, 800];
    try {
      await Promise.all(
        families.flatMap(f => weights.map(w => document.fonts.load(`${w} 16px "${f}"`))),
      );
      if (document.fonts.ready) await document.fonts.ready;
    } catch {}
  }

  // Deuxième tick : laisse le moteur de rendu appliquer les polices
  // fraîchement chargées avant la capture.
  await new Promise((r) => requestAnimationFrame(() => r()));

  // Deux stratégies de rasterisation :
  // 1. foreignObjectRendering (SVG) : le navigateur rend le DOM NATIVEMENT
  //    en SVG, donc polices vectorielles conservées → texte parfaitement fidèle
  //    à l'aperçu HTML. Seul inconvénient : ne marche pas partout (Safari < 15
  //    a des bugs). Si ça échoue, on retombe sur le mode classique.
  // 2. Mode classique : html2canvas re-rasterise lui-même le DOM. Marche partout
  //    mais utilise parfois des polices fallback si elles ne sont pas parfaitement
  //    chargées au moment du rendu.
  let canvas;
  const opts = {
    scale: 3,               // 300dpi-ish en A4, fini le zoom pixelisé
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    imageTimeout: 15000,
  };
  try {
    try {
      canvas = await html2canvas(clone, { ...opts, foreignObjectRendering: true });
      // Safari foreignObject retourne parfois un canvas blanc → détection
      // best-effort : on vérifie que le canvas a un contenu non vide.
      if (!canvas || canvas.width < 10 || canvas.height < 10) throw new Error("empty canvas");
    } catch (svgErr) {
      console.warn("[pdf] foreignObjectRendering failed, fallback:", svgErr?.message || svgErr);
      canvas = await html2canvas(clone, opts);
    }
  } finally {
    if (clone.parentNode) clone.parentNode.removeChild(clone);
  }

  const pageW  = A4_W_MM;
  const ratio  = canvas.height / canvas.width;
  const drawH  = pageW * ratio; // hauteur réelle du contenu en mm

  if (drawH <= A4_H_MM * 1.5) {
    // Contenu court ou moyen : 1 page à la hauteur exacte du contenu
    // (jamais de blanc en bas), ou légèrement réduit pour tenir en A4.
    const pageH = Math.min(drawH, A4_H_MM); // hauteur PDF = contenu ou A4 max
    const pdf   = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: "portrait" });
    // PNG (sans perte) pour le texte — JPEG bave sur les bords des caractères
    // et donne un rendu "flou" typique des PDF rasterisés.
    const img   = canvas.toDataURL("image/png");

    if (drawH <= A4_H_MM) {
      // Contenu plus court que A4 : page à la taille exacte du contenu
      pdf.addImage(img, "PNG", 0, 0, pageW, drawH, undefined, "FAST");
    } else {
      // Contenu entre A4 et 1,5× A4 : réduit proportionnellement pour tenir en A4
      const scale   = A4_H_MM / drawH;
      const scaledW = pageW * scale;
      const marginX = (pageW - scaledW) / 2;
      pdf.addImage(img, "PNG", marginX, 0, scaledW, A4_H_MM, undefined, "FAST");
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
    const img    = slice.toDataURL("image/png");
    const thisH  = (sliceH * pageW) / canvas.width;
    pdf.addImage(img, "PNG", 0, 0, pageW, thisH, undefined, "FAST");
    y += sliceH;
    if (canvas.height - y > MIN_REM) pdf.addPage();
    else break;
  }

  const blob    = pdf.output("blob");
  const dataUri = pdf.output("datauristring");
  return { blob, base64: dataUri.split(",")[1] || "", filename };
}
