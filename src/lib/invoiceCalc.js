/**
 * Calcule HT, TVA et TTC à partir des lignes d'un devis.
 * Seules les lignes de type "ouvrage" entrent dans le calcul.
 * TVA forcée à 0 si :
 *   • régime franchise (auto-entrepreneur art. 293 B CGI), OU
 *   • autoLiquidation = true (sous-traitance BTP, art. 283-2 nonies CGI).
 */
export function calcInvoiceTotals(lignes, vatRegime, autoLiquidation = false) {
  const ouvrages  = (lignes || []).filter(l => l.type_ligne === "ouvrage");
  const noTva     = vatRegime === "franchise" || autoLiquidation;
  const ht  = ouvrages.reduce((s, l) =>
    s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const tva = ouvrages.reduce((s, l) =>
    s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0)
      * (noTva ? 0 : Number(l.tva_rate ?? 20)) / 100, 0);
  return { ht, tva, ttc: ht + tva };
}
