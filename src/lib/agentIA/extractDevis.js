import { uid } from "../utils.js";

// Extrait le JSON du bloc <DEVIS> même si la balise fermante est absente
// (cas où Claude émet du texte ou une astuce après le JSON sans </DEVIS>).
// Avec balise fermante : trivial. Sans : on équilibre les accolades.
export function extractDevisJson(raw) {
  const withClose = raw.match(/<DEVIS>([\s\S]*?)<\/DEVIS>/);
  if (withClose) return withClose[1].trim();

  const openIdx = raw.indexOf("<DEVIS>");
  if (openIdx < 0) return null;

  const after = raw.slice(openIdx + 7).trimStart();
  if (!after.startsWith("{")) return null;

  let depth = 0, inStr = false, escape = false;
  for (let i = 0; i < after.length; i++) {
    const ch = after[i];
    if (escape)          { escape = false; continue; }
    if (ch === "\\" && inStr) { escape = true;  continue; }
    if (ch === '"')      { inStr = !inStr;  continue; }
    if (inStr)           continue;
    if (ch === "{")      depth++;
    else if (ch === "}") { depth--; if (depth === 0) return after.slice(0, i + 1); }
  }
  return null;
}

// Force tva_rate = 0 sur les lignes ouvrage si l'utilisateur est en franchise
// en base de TVA (art. 293 B du CGI). Remap immuable — jamais de mutation in-place.
export function applyVatRegime(lignes, vatRegime) {
  if (vatRegime !== "franchise") return lignes;
  return lignes.map(l => l.type_ligne === "ouvrage" ? { ...l, tva_rate: 0 } : l);
}

// Filet de sécurité : si l'IA déclare un montant cible et que la somme
// des lignes ouvrage n'y correspond pas (>0,5%), on rescale les prix unitaires
// proportionnellement, puis on absorbe la dérive d'arrondi sur la dernière ligne.
export function rescaleToTarget(lignes, targetTotalHt) {
  const target = Number(targetTotalHt);
  if (!(target > 0)) return lignes;

  const sum = lignes
    .filter(l => l.type_ligne === "ouvrage")
    .reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  if (sum <= 0 || Math.abs(sum - target) / target <= 0.005) return lignes;

  const ratio = target / sum;
  let rescaled = lignes.map(l => l.type_ligne === "ouvrage"
    ? { ...l, prix_unitaire: Math.round((Number(l.prix_unitaire) || 0) * ratio * 100) / 100 }
    : l);

  const newSum = rescaled
    .filter(l => l.type_ligne === "ouvrage")
    .reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const drift = target - newSum;
  if (Math.abs(drift) <= 0.009) return rescaled;

  let fixed = false;
  return [...rescaled].reverse().map(l => {
    if (!fixed && l.type_ligne === "ouvrage") {
      fixed = true;
      const q  = Number(l.quantite) || 1;
      const pu = (Number(l.prix_unitaire) || 0) + drift / q;
      return { ...l, prix_unitaire: Math.round(pu * 100) / 100 };
    }
    return l;
  }).reverse();
}

// Pipeline complet : raw text → { parsed, lignes, objet } prêts à être affichés.
// Renvoie null si pas de JSON exploitable (l'appelant gère le fallback).
export function processDevisFromRaw(raw, brand) {
  const devisJsonStr = extractDevisJson(raw);
  if (!devisJsonStr) return null;

  let parsed;
  try { parsed = JSON.parse(devisJsonStr); } catch { return null; }

  const initialLignes = (parsed.lignes || []).map(l => ({ ...l, id: uid() }));
  const vatApplied    = applyVatRegime(initialLignes, brand.vatRegime);
  const finalLignes   = rescaleToTarget(vatApplied, parsed.target_total_ht);

  return { parsed, lignes: finalLignes, objet: parsed.objet || "" };
}
