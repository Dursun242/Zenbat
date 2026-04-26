/**
 * Calcule HT, TVA et TTC à partir des lignes d'un devis.
 * Seules les lignes de type "ouvrage" entrent dans le calcul.
 * En régime franchise (auto-entrepreneur art. 293 B CGI), TVA = 0.
 */
export function calcInvoiceTotals(lignes, vatRegime) {
  const ouvrages  = (lignes || []).filter(l => l.type_ligne === "ouvrage");
  const franchise = vatRegime === "franchise";
  const ht  = ouvrages.reduce((s, l) =>
    s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const tva = ouvrages.reduce((s, l) =>
    s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0)
      * (franchise ? 0 : Number(l.tva_rate ?? 20)) / 100, 0);
  return { ht, tva, ttc: ht + tva };
}
