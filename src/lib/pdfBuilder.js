import { jsPDF } from "jspdf";
import { fmt, fmtD } from "./utils.js";
import { notifyAdminPdf } from "./telegramNotify.js";

const A4_W = 210, A4_H = 297, PAD = 10;
const CW = A4_W - 2 * PAD; // 190mm
const X = PAD;
const PAGE_BOTTOM = 283; // leave 14mm footer margin

// RGB color constants — palette chaude Zenbat
const TERRA    = [201, 123, 92];   // #C97B5C terracotta (fallback brand color)
const TERRA_BG = [240, 235, 227];  // #F0EBE3 fond chaud par défaut
const WHITE    = [255, 255, 255];
const BORDER   = [232, 226, 216];  // #E8E2D8 bordure chaude
const BORDER2  = [210, 202, 190];  // légèrement plus soutenu
const DARK     = [26, 22, 18];     // #1A1612 encre chaude
const MID      = [61, 48, 40];     // #3D3028
const LIGHT    = [107, 99, 88];    // #6B6358
const MUTED    = [107, 99, 88];    // #6B6358
const VMUTED   = [154, 142, 130];  // #9A8E82
const BG_LIGHT = [250, 247, 242];  // #FAF7F2 crème
const GREEN    = [22, 163, 74];
const GREEN_DK = [22, 101, 52];
const AMBER    = [146, 64, 14];
const AMBER_BG = [254, 249, 195];

// Convertit "#RRGGBB" ou "#RGB" en [r,g,b]. Retourne null si invalide.
export function hexToRgb(hex) {
  let s = String(hex || "").trim().replace(/^#/, "");
  if (s.length === 3) s = s.split("").map(c => c + c).join("");
  if (s.length !== 6) return null;
  const n = parseInt(s, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// Mélange deux couleurs RGB. weight = part de la première (0..1).
export function mixRgb(a, b, weight) {
  return [
    Math.round(a[0] * weight + b[0] * (1 - weight)),
    Math.round(a[1] * weight + b[1] * (1 - weight)),
    Math.round(a[2] * weight + b[2] * (1 - weight)),
  ];
}

// Luminance relative WCAG pour choisir un texte lisible sur un fond donné.
function luminance([r, g, b]) {
  const v = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

// Texte blanc si le fond est foncé, encre sombre sinon (>0.55 ≈ couleur claire).
export function pickTextColor(bg) {
  return luminance(bg) > 0.55 ? DARK : WHITE;
}

// Table column widths (sum = 190mm)
const CD = 100, CU = 15, CQ = 13, CP = 22, CT = 13, CR = 27;

// Sanitize text for jsPDF — remplace les caractères hors Latin-1/WinAnsi
const s = (v) => String(v ?? '')
  .replace(/ /g, ' ')   // espace fine insécable
  .replace(/ /g, ' ')   // espace insécable
  .replace(/≥/g, '>=')  // ≥
  .replace(/≤/g, '<=')  // ≤
  .replace(/—/g, ' - ') // — tiret em
  .replace(/–/g, ' - ') // – tiret en
  .replace(/²/g, '2')   // ²
  .replace(/³/g, '3')   // ³
  .replace(/→/g, '->')  // →
  .replace(/•/g, '-')   // •
  .replace(/[“”]/g, '"') // ""
  .replace(/[‘’]/g, "'"); // ''

function setFill(pdf, rgb) { pdf.setFillColor(rgb[0], rgb[1], rgb[2]); }
function setDraw(pdf, rgb, w = 0.2) { pdf.setDrawColor(rgb[0], rgb[1], rgb[2]); pdf.setLineWidth(w); }
function setTxt(pdf, rgb) { pdf.setTextColor(rgb[0], rgb[1], rgb[2]); }

function box(pdf, x, y, w, h, fill, stroke) {
  if (fill) setFill(pdf, fill);
  if (stroke) setDraw(pdf, stroke);
  pdf.rect(x, y, w, h, fill && stroke ? "FD" : fill ? "F" : "S");
}

function hline(pdf, x1, x2, y, rgb, w = 0.2) {
  setDraw(pdf, rgb, w);
  pdf.line(x1, y, x2, y);
}

function txt(pdf, text, x, y, { size = 10, bold = false, color = DARK, align = "left" } = {}) {
  pdf.setFontSize(size);
  pdf.setFont("helvetica", bold ? "bold" : "normal");
  setTxt(pdf, color);
  pdf.text(s(text), x, y, { align });
}

function wrap(pdf, text, maxW, size = 8.5) {
  pdf.setFontSize(size);
  return pdf.splitTextToSize(s(text), maxW);
}

function newPage(pdf) { pdf.addPage(); return PAD; }

function need(pdf, y, h) {
  return y + h > PAGE_BOTTOM ? newPage(pdf) : y;
}

// Charge n'importe quelle image (JPEG, PNG, WebP, SVG…) et la retourne
// en PNG via canvas + dimensions naturelles pour respecter les proportions.
async function loadImgAsPng(url) {
  try {
    const blob = await fetch(url, { mode: "cors" }).then(r => r.ok ? r.blob() : null);
    if (!blob) return null;
    const objectUrl = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const w = img.naturalWidth  || img.width  || 180;
          const h = img.naturalHeight || img.height || 60;
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0);
          resolve({ dataUrl: canvas.toDataURL("image/png"), w, h });
        } catch { resolve(null); }
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
      img.src = objectUrl;
    });
  } catch { return null; }
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export async function buildPdf(d, cl, brand, kind = "devis", { filename = "document.pdf" } = {}) {
  const isAvoir   = kind === "facture" && !!d?.avoir_of_invoice_id;
  const isAcompte = kind === "facture" && d?.invoice_type === "acompte";
  const docLabel  = isAvoir ? "FACTURE D'AVOIR" : isAcompte ? "FACTURE D'ACOMPTE" : kind === "facture" ? "FACTURE" : "DEVIS";

  // Couleur d'accent dérivée du profil utilisateur (brand.color), avec
  // fallback TERRA si invalide. Le fond d'accent est un mix 15% accent + 85%
  // blanc — réplique le contraste original TERRA / TERRA_BG. Le texte sur
  // l'accent saturé suit la luminance pour rester lisible.
  const accent    = hexToRgb(brand?.color) || TERRA;
  const accentBg  = mixRgb(accent, WHITE, 0.15);
  const accentTxt = pickTextColor(accent);

  // Compute totals (mirrors PDFViewer.jsx)
  const lignes = d.lignes || [];
  const filteredLignes = lignes.filter((l, i) => {
    if (l.type_ligne !== "lot") return true;
    const rest = lignes.slice(i + 1);
    const nli  = rest.findIndex(x => x.type_ligne === "lot");
    const grp  = nli === -1 ? rest : rest.slice(0, nli);
    return grp.some(x => x.type_ligne === "ouvrage");
  });
  const ouvrages  = filteredLignes.filter(l => l.type_ligne === "ouvrage");
  const rateOf    = (l) => Number(l.tva_rate ?? d.tva_rate ?? 20);
  const ht        = ouvrages.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0);
  const tvaGroups = ouvrages.reduce((acc, l) => {
    const r = rateOf(l);
    acc[r] = (acc[r] || 0) + (l.quantite || 0) * (l.prix_unitaire || 0);
    return acc;
  }, {});
  const tvaRows = Object.keys(tvaGroups).map(Number).sort((a, b) => a - b).map(r => ({
    rate: r, base: tvaGroups[r], montant: tvaGroups[r] * (r / 100),
  }));
  const tva = tvaRows.reduce((s, r) => s + r.montant, 0);
  const ttc = ht + tva;

  const clientName  = cl?.raison_sociale || `${cl?.prenom || ""} ${cl?.nom || ""}`.trim() || "—";
  const clientLines = [
    cl?.adresse,
    [cl?.code_postal, cl?.ville].filter(Boolean).join(" "),
    cl?.email,
    cl?.telephone && `Tél : ${cl.telephone}`,
  ].filter(Boolean);
  const companyLines = [
    brand.address,
    brand.city,
    brand.phone && `Tél : ${brand.phone}`,
    brand.email,
    brand.siret && `SIRET : ${brand.siret}`,
  ].filter(Boolean);

  const baseDate  = d.date_emission ? new Date(d.date_emission) : new Date();
  const validDate = isNaN(baseDate.getTime()) ? new Date() : new Date(baseDate);
  validDate.setDate(validDate.getDate() + (brand.validityDays || 30));

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  let y = PAD;

  // ── Header ────────────────────────────────────────────────────────────────
  // Logo
  if (brand.logo) {
    const img = await loadImgAsPng(brand.logo);
    if (img) {
      // Proportions d'origine préservées, bornes max : 50mm wide × 14mm tall
      const MAX_W = 50, MAX_H = 14;
      const aspect = img.w / img.h;
      let dw = MAX_W, dh = dw / aspect;
      if (dh > MAX_H) { dh = MAX_H; dw = dh * aspect; }
      pdf.addImage(img.dataUrl, "PNG", X, y, dw, dh, undefined, "FAST");
    } else {
      txt(pdf, brand.companyName || "Votre Entreprise", X, y + 5, { size: 13, bold: true, color: accent });
    }
  } else {
    txt(pdf, brand.companyName || "Votre Entreprise", X, y + 5, { size: 13, bold: true, color: accent });
  }

  // Doc info (right-aligned)
  const rx = X + CW;
  txt(pdf, docLabel, rx, y + 4,  { size: 7.5, bold: true, color: MUTED, align: "right" });
  txt(pdf, s(d.numero), rx, y + 10, { size: 14, bold: true, color: accent, align: "right" });
  txt(pdf, `Émis le ${fmtD(d.date_emission)}`, rx, y + 16, { size: 7.5, color: LIGHT, align: "right" });
  if (kind === "facture") {
    if (d.date_echeance)
      txt(pdf, `Échéance ${fmtD(d.date_echeance)}`, rx, y + 20, { size: 7.5, color: LIGHT, align: "right" });
  } else {
    txt(pdf, `Valide jusqu'au ${fmtD(validDate.toISOString())}`, rx, y + 20, { size: 7.5, color: LIGHT, align: "right" });
  }

  y += 23;
  hline(pdf, X, X + CW, y, accent, 0.5);
  y += 5;

  // ── Info grid (Entreprise | Client) ───────────────────────────────────────
  const halfW = (CW - 4) / 2;
  const infoLineH = 4.2;
  const maxLines  = Math.max(companyLines.length, clientLines.length);
  const gridH     = Math.max(24, 5 + 5 + maxLines * infoLineH + 6);

  y = need(pdf, y, gridH + 4);
  box(pdf, X,           y, halfW, gridH, null, BORDER2);
  box(pdf, X + halfW + 4, y, halfW, gridH, null, BORDER2);

  txt(pdf, "ENTREPRISE",       X + 3,           y + 4,  { size: 7, bold: true, color: MUTED });
  txt(pdf, brand.companyName || "—", X + 3,     y + 9,  { size: 10, bold: true, color: DARK });
  companyLines.forEach((ln, i) =>
    txt(pdf, ln, X + 3, y + 14 + i * infoLineH, { size: 8, color: LIGHT })
  );

  const cx2 = X + halfW + 7;
  txt(pdf, "MAÎTRE D'OUVRAGE", cx2,             y + 4,  { size: 7, bold: true, color: MUTED });
  txt(pdf, clientName,         cx2,             y + 9,  { size: 10, bold: true, color: DARK });
  clientLines.forEach((ln, i) =>
    txt(pdf, ln, cx2, y + 14 + i * infoLineH, { size: 8, color: LIGHT })
  );

  y += gridH + 5;

  // ── Objet / Chantier ──────────────────────────────────────────────────────
  if (d.objet || d.ville_chantier || isAcompte) {
    const lines2 = [
      isAcompte && d.devis_numero && `Acompte sur devis : ${d.devis_numero}`,
      d.objet && `Objet : ${d.objet}`,
      d.ville_chantier && `Chantier : ${d.ville_chantier}`,
    ].filter(Boolean);
    const objH   = 6 + lines2.length * 5;
    y = need(pdf, y, objH + 4);
    box(pdf, X, y, CW, objH, BG_LIGHT, BORDER);
    lines2.forEach((ln, i) => txt(pdf, ln, X + 3, y + 5 + i * 5, { size: 8, color: MID }));
    y += objH + 5;
  }

  // ── Table title ───────────────────────────────────────────────────────────
  y = need(pdf, y, 10);
  txt(pdf, "DÉTAIL DES PRESTATIONS", X, y + 4, { size: 8, bold: true, color: accent });
  y += 8;

  // Table header row
  const drawTableHeader = (atY) => {
    box(pdf, X, atY, CW, 8, accent);
    pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); setTxt(pdf, accentTxt);
    let cx = X;
    pdf.text("Description",  cx + 3,                        atY + 4.5);
    pdf.text("Unité",        cx + CD + CU / 2,              atY + 4.5, { align: "center" });
    pdf.text("Qté",          cx + CD + CU + CQ / 2,         atY + 4.5, { align: "center" });
    pdf.text("PU HT",        cx + CD + CU + CQ + CP - 2,   atY + 4.5, { align: "right" });
    pdf.text("TVA",          cx + CD + CU + CQ + CP + CT / 2, atY + 4.5, { align: "center" });
    pdf.text("Total HT",     cx + CW - 2,                   atY + 4.5, { align: "right" });
    return atY + 7;
  };
  y = need(pdf, y, 12);
  y = drawTableHeader(y);

  // Table rows
  filteredLignes.forEach((l, i) => {
    if (l.type_ligne === "lot") {
      y = need(pdf, y, 7);
      if (y === PAD) y = drawTableHeader(y); // repeat header after page break
      box(pdf, X, y, CW, 6, accentBg);
      hline(pdf, X, X + CW, y + 6, BORDER);
      txt(pdf, (l.designation || "").toUpperCase(), X + 3, y + 4, { size: 8, bold: true, color: accent });
      y += 6;
    } else if (l.type_ligne === "ouvrage") {
      pdf.setFontSize(8.5);
      const descLines = pdf.splitTextToSize(s(l.designation || ""), CD - 5);
      const rowH      = Math.max(6, descLines.length * 3.8 + 2.5);

      y = need(pdf, y, rowH);
      if (y === PAD) y = drawTableHeader(y);

      if (i % 2 === 1) box(pdf, X, y, CW, rowH, BG_LIGHT);
      hline(pdf, X, X + CW, y + rowH, BORDER);

      const ty = y + 4;
      pdf.setFont("helvetica", "normal"); setTxt(pdf, DARK);
      pdf.text(descLines, X + 3, ty);

      const total   = (l.quantite || 0) * (l.prix_unitaire || 0);
      const tvaDisp = `${rateOf(l)}%`.replace(".", ",");
      txt(pdf, l.unite || "—",            X + CD + CU / 2,                  ty, { size: 8.5, color: MUTED,  align: "center" });
      txt(pdf, String(l.quantite ?? ""),  X + CD + CU + CQ / 2,             ty, { size: 8.5,                align: "center" });
      txt(pdf, fmt(l.prix_unitaire),      X + CD + CU + CQ + CP - 2,        ty, { size: 8.5,                align: "right"  });
      txt(pdf, tvaDisp,                   X + CD + CU + CQ + CP + CT / 2,   ty, { size: 8.5, color: MUTED,  align: "center" });
      txt(pdf, fmt(total),                X + CW - 2,                        ty, { size: 8.5, bold: true,    align: "right"  });
      y += rowH;
    }
  });

  y += 6;

  // ── Totals ────────────────────────────────────────────────────────────────
  const TW  = 82;
  const TX  = X + CW - TW;
  const TRH = 6;

  const totalRows = 1 + tvaRows.length + 1 + (kind === "facture" && Number(d.retenue_garantie_eur) > 0 ? 2 : 0);
  y = need(pdf, y, totalRows * TRH + 8);

  txt(pdf, "Total HT", TX + 3, y + 4, { size: 8.5, color: LIGHT });
  txt(pdf, fmt(ht),    TX + TW - 2, y + 4, { size: 8.5, bold: true, align: "right" });
  y += TRH;

  tvaRows.forEach(row => {
    txt(pdf, `TVA ${row.rate}%  (sur ${fmt(row.base)})`, TX + 3, y + 4, { size: 8, color: LIGHT });
    txt(pdf, fmt(row.montant), TX + TW - 2, y + 4, { size: 8, align: "right" });
    y += TRH;
  });

  hline(pdf, TX, TX + TW, y, accent, 0.5);
  box(pdf, TX, y, TW, TRH + 2, accentBg);
  txt(pdf, "TOTAL TTC", TX + 3, y + 5, { size: 9, bold: true, color: accent });
  txt(pdf, fmt(ttc),    TX + TW - 2, y + 5, { size: 10, bold: true, color: accent, align: "right" });
  y += TRH + 2;

  if (kind === "facture" && Number(d.retenue_garantie_eur) > 0) {
    const ret = Number(d.retenue_garantie_eur);
    y += 2;
    txt(pdf, `Retenue de garantie ${d.retenue_garantie_pct}%`, TX + 3, y + 4, { size: 8, color: AMBER });
    txt(pdf, `−${fmt(ret)}`,                              TX + TW - 2, y + 4, { size: 8, color: AMBER, align: "right" });
    y += TRH;
    hline(pdf, TX, TX + TW, y, [253, 230, 138], 0.3);
    box(pdf, TX, y, TW, TRH + 2, AMBER_BG);
    txt(pdf, "NET À PAYER",      TX + 3, y + 5, { size: 9, bold: true, color: AMBER });
    txt(pdf, fmt(ttc - ret),     TX + TW - 2, y + 5, { size: 10, bold: true, color: AMBER, align: "right" });
    y += TRH + 2;
  }

  y += 6;

  // ── Observations ──────────────────────────────────────────────────────────
  const obs = d.observations || brand.defaultObservations;
  if (obs) {
    const obsLines = wrap(pdf, obs, CW, 8.5);
    const obsH     = obsLines.length * 4.5 + 8;
    y = need(pdf, y, obsH);
    txt(pdf, "OBSERVATIONS", X, y + 3, { size: 7, bold: true, color: accent });
    y += 7;
    pdf.setFont("helvetica", "normal"); setTxt(pdf, MID);
    pdf.text(obsLines, X, y);
    y += obsH - 8 + 5;
  }

  // ── Conditions + Banque ───────────────────────────────────────────────────
  const hasTerms = !!brand.paymentTerms;
  const hasBank  = !!(brand.rib || brand.iban);
  if (hasTerms || hasBank) {
    const hasBoth = hasTerms && hasBank;
    const colW    = hasBoth ? (CW - 5) / 2 : CW;
    y = need(pdf, y, 28);

    let bx = X;
    if (hasTerms) {
      const termLines = wrap(pdf, brand.paymentTerms, colW - 6, 8.5);
      const bh        = Math.max(22, termLines.length * 4.5 + 12);
      box(pdf, bx, y, colW, bh, BG_LIGHT, BORDER);
      txt(pdf, "CONDITIONS", bx + 3, y + 4, { size: 7, bold: true, color: accent });
      pdf.setFont("helvetica", "normal"); setTxt(pdf, MID); pdf.setFontSize(8.5);
      pdf.text(termLines, bx + 3, y + 10);
      bx += colW + 5;
    }
    if (hasBank) {
      const bkW = hasBoth ? colW : CW;
      box(pdf, bx, y, bkW, 24, BG_LIGHT, BORDER);
      txt(pdf, "COORDONNÉES BANCAIRES", bx + 3, y + 4, { size: 7, bold: true, color: accent });
      let by = y + 10;
      if (brand.rib)  { txt(pdf, brand.rib,              bx + 3, by, { size: 8,   color: MID });   by += 4.5; }
      if (brand.iban) { txt(pdf, `IBAN : ${brand.iban}`, bx + 3, by, { size: 7.5, color: LIGHT }); by += 4;   }
      if (brand.bic)  { txt(pdf, `BIC : ${brand.bic}`,  bx + 3, by, { size: 7.5, color: LIGHT });             }
    }
    y += 28;
  }

  // ── Mentions légales (devis only) ─────────────────────────────────────────
  if (kind !== "facture" && (brand.devisGratuit !== undefined || brand.travelFees)) {
    y = need(pdf, y, 20);
    hline(pdf, X, X + CW, y, BORDER);
    y += 5;
    txt(pdf, "INFORMATIONS LÉGALES", X, y, { size: 7, bold: true, color: VMUTED });
    y += 5;
    const items = [];
    if (brand.devisGratuit !== false) {
      items.push("• Devis gratuit.");
    } else {
      items.push(`• Devis payant${brand.devisTarif ? ` : ${brand.devisTarif}` : ""} (déductible en cas de signature).`);
    }
    if (brand.travelFees)  items.push(`• Frais de déplacement : ${brand.travelFees}`);
    if (brand.validityDays) items.push(`• Validité : ${brand.validityDays} jour${brand.validityDays > 1 ? "s" : ""} à compter de l'émission.`);
    const mLines = wrap(pdf, items.join("   "), CW, 8);
    pdf.setFont("helvetica", "normal"); setTxt(pdf, LIGHT); pdf.setFontSize(8);
    pdf.text(mLines, X, y);
    y += mLines.length * 4 + 4;
  }

  // ── Signatures (devis only) ───────────────────────────────────────────────
  if (kind !== "facture") {
    const isSigned    = d.statut === "accepte" && d.signed_at;
    const signerLabel = d.signed_by || clientName;
    const sigColor    = isSigned ? GREEN : BORDER2;

    y = need(pdf, y, 28);
    hline(pdf, X, X + CW, y, sigColor, 0.5);
    y += 5;

    const sigW  = Math.floor(CW * 2 / 3) - 5;
    const dtX   = X + sigW + 5;
    const dtW   = CW - sigW - 5;
    const lColor = isSigned ? GREEN_DK : MUTED;

    txt(pdf, "SIGNATURE CLIENT · Bon pour accord", X,   y + 3, { size: 7.5, bold: true, color: lColor });
    txt(pdf, "DATE",                               dtX, y + 3, { size: 7.5, bold: true, color: lColor });
    y += 8;

    if (isSigned) {
      txt(pdf, signerLabel,                                X,   y + 5,  { size: 10, bold: true, color: GREEN });
      txt(pdf, "✓ Signé électroniquement via Odoo Sign", X, y + 10, { size: 7, color: GREEN });
      hline(pdf, X, X + sigW, y + 13, GREEN);
      txt(pdf, fmtD(d.signed_at), dtX, y + 5, { size: 10, bold: true, color: GREEN });
      hline(pdf, dtX, dtX + dtW - 5, y + 13, GREEN);
    } else {
      hline(pdf, X, X + sigW, y + 12, MUTED);
      hline(pdf, dtX, dtX + dtW - 5, y + 12, MUTED);
    }
    y += 18;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  y = need(pdf, y, 18);
  hline(pdf, X, X + CW, y, BORDER);
  y += 4;

  const footParts = [];
  if (brand.vatRegime === "franchise" && !/(293\s*B|TVA\s+non\s+applicable)/i.test(brand.mentionsLegales || ""))
    footParts.push("TVA non applicable, art. 293 B du CGI");
  if (brand.mentionsLegales) footParts.push(brand.mentionsLegales);
  const legalId = [
    brand.companyName && brand.legalForm ? `${brand.companyName} — ${brand.legalForm}` : brand.legalForm || "",
    brand.capital ? `au capital de ${brand.capital}` : "",
    brand.siret ? `SIRET ${brand.siret}` : "",
    brand.rcs || "",
    brand.tva && brand.vatRegime !== "franchise" ? `TVA ${brand.tva}` : "",
  ].filter(Boolean).join(" · ");
  if (legalId) footParts.push(legalId);
  if (kind === "facture" && brand.paymentPenalties) footParts.push(brand.paymentPenalties);
  if (kind === "facture" && brand.escompte)         footParts.push(brand.escompte);

  if (footParts.length) {
    const fLines = wrap(pdf, footParts.join("\n"), CW - 36, 7);
    pdf.setFont("helvetica", "normal"); setTxt(pdf, VMUTED); pdf.setFontSize(7);
    pdf.text(fLines, X, y + 3);
  }
  txt(pdf, "Généré via Zenbat", X + CW, y + 3, { size: 7, color: VMUTED, align: "right" });

  // ── Output ────────────────────────────────────────────────────────────────
  const blob    = pdf.output("blob");
  const dataUri = pdf.output("datauristring");

  notifyAdminPdf(
    "pdf_generated",
    { kind, numero: d?.numero, total_ttc: ttc, statut: d?.statut },
    blob,
    filename,
  );

  return { blob, base64: dataUri.split(",")[1] || "", filename };
}
