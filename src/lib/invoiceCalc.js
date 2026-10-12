/**
 * Calcul des montants d'un devis ou d'une facture — source unique.
 *
 * Utilisé par l'écran facture, l'aperçu et le PDF (PDFViewer, pdfBuilder),
 * la création des factures (acompte, solde, depuis un devis) et le XML
 * Factur-X côté serveur (api/facturx.js). Toute règle de TVA vit ici.
 *
 * Règles :
 *   • seules les lignes « ouvrage » comptent ;
 *   • chaque total de ligne est arrondi au centime (BT-131), le HT est leur
 *     somme (BT-106) ;
 *   • la TVA est calculée et arrondie par taux (BT-117), puis sommée (BT-110) ;
 *   • TVA à 0 si régime franchise (art. 293 B CGI) ou autoliquidation BTP
 *     (art. 283-2 nonies CGI).
 *
 * Fichier pur (pas de React, pas de navigateur) : importable par l'API.
 */

// Arrondi commercial au centime (demi-centime vers le haut, en valeur
// absolue). toFixed(8) efface l'erreur binaire du ×100 : 1,265 × 100 vaut
// 126,49999999999999 en flottant et donnait 1,26 au lieu de 1,27.
export const round2 = (n) => {
  const x = Number(n) || 0;
  const sign = x < 0 ? -1 : 1;
  return sign * Math.round(Number((Math.abs(x) * 100).toFixed(8))) / 100 + 0;
};

const ouvragesOf = (lignes) => (lignes || []).filter(l => l?.type_ligne === "ouvrage");

/** Total HT d'une ligne, arrondi au centime. */
export const lineTotal = (l) => round2((Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0));

/** Taux d'une ligne : le sien, sinon celui du document, sinon 20 %. */
export const lineRate = (l, docRate) => Number(l.tva_rate ?? docRate ?? 20);

/** true si aucune TVA n'est facturée (franchise ou autoliquidation). */
export const isNoTva = (vatRegime, autoLiquidation) =>
  vatRegime === "franchise" || !!autoLiquidation;

/**
 * Totaux complets.
 * @returns {{ ht:number, tva:number, ttc:number, tvaRows:{rate:number, base:number, montant:number}[] }}
 */
export function computeTotals(lignes, { noTva = false, docRate } = {}) {
  const groups = new Map();
  let ht = 0;
  for (const l of ouvragesOf(lignes)) {
    const base = lineTotal(l);
    const rate = noTva ? 0 : lineRate(l, docRate);
    ht += base;
    groups.set(rate, (groups.get(rate) || 0) + base);
  }
  const tvaRows = [...groups.keys()].sort((a, b) => a - b).map(rate => {
    const base = round2(groups.get(rate));
    return { rate, base, montant: round2(base * rate / 100) };
  });
  ht = round2(ht);
  const tva = round2(tvaRows.reduce((s, r) => s + r.montant, 0));
  return { ht, tva, ttc: round2(ht + tva), tvaRows };
}

/**
 * Compatibilité : HT, TVA, TTC (+ ventilation) à partir des lignes.
 * docRate = taux par défaut du document (devis.tva_rate) pour les lignes sans taux.
 */
export function calcInvoiceTotals(lignes, vatRegime, autoLiquidation = false, docRate) {
  return computeTotals(lignes, { noTva: isNoTva(vatRegime, autoLiquidation), docRate });
}

/** Montants `montant_ht / montant_tva / montant_ttc` à enregistrer en base. */
export function invoiceAmounts(lignes, vatRegime, autoLiquidation = false, docRate) {
  const { ht, tva, ttc } = calcInvoiceTotals(lignes, vatRegime, autoLiquidation, docRate);
  return { montant_ht: ht, montant_tva: tva, montant_ttc: ttc };
}

/**
 * Répartit un montant HT entre les taux de TVA d'un devis, au prorata du HT
 * de chaque taux. Arrondi au centime ; l'écart d'arrondi va au taux le plus
 * lourd pour que la somme tombe juste.
 * @returns {{rate:number, ht:number}[]} trié par taux croissant
 */
export function splitByRate(amountHT, lignes, docRate) {
  const amount = round2(amountHT);
  const { tvaRows } = computeTotals(lignes, { docRate });
  const total = tvaRows.reduce((s, r) => s + r.base, 0);
  if (!tvaRows.length || total <= 0) return [{ rate: Number(docRate ?? 20), ht: amount }];
  const parts = tvaRows.map(r => ({ rate: r.rate, ht: round2(amount * r.base / total), base: r.base }));
  const diff = round2(amount - parts.reduce((s, p) => s + p.ht, 0));
  if (diff) {
    const heaviest = parts.reduce((a, b) => (b.base > a.base ? b : a));
    heaviest.ht = round2(heaviest.ht + diff);
  }
  return parts.filter(p => p.ht !== 0).map(({ rate, ht }) => ({ rate, ht }));
}

/**
 * Lignes d'une facture d'acompte ou de solde : le montant HT est ventilé sur
 * les taux de TVA du devis (une ligne par taux). Une seule ligne à 0 % en
 * franchise ou autoliquidation.
 */
export function ventilatedLines(amountHT, devisLignes, { noTva = false, docRate, designation = "" } = {}) {
  const parts = noTva ? [{ rate: 0, ht: round2(amountHT) }] : splitByRate(amountHT, devisLignes, docRate);
  return parts.map(p => ({
    type_ligne:    "ouvrage",
    designation:   parts.length > 1 ? `${designation} — part TVA ${String(p.rate).replace(".", ",")} %` : designation,
    unite:         "forfait",
    quantite:      1,
    prix_unitaire: p.ht,
    tva_rate:      p.rate,
  }));
}
