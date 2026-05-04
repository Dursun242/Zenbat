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

const VALID_TVA    = new Set([0, 2.1, 5.5, 8.5, 10, 20]);
const VALID_TYPES  = new Set(["lot", "ouvrage"]);
const MAX_STR      = 500;
const MAX_LIGNES   = 200;

function safeStr(v, max = MAX_STR) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

// Valide et nettoie le JSON Claude avant toute sauvegarde.
// Tolère les champs manquants (defaults), rejette les structures malformées.
export function sanitizeDevisJson(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const rawLignes = Array.isArray(parsed.lignes) ? parsed.lignes : [];
  const lignes = rawLignes
    .slice(0, MAX_LIGNES)
    .filter(l => l && VALID_TYPES.has(l.type_ligne))
    .map(l => {
      if (l.type_ligne === "lot") {
        return { type_ligne: "lot", designation: safeStr(l.designation) || "—" };
      }
      const pu  = Number(l.prix_unitaire);
      const qty = l.quantite === null ? null : Number(l.quantite);
      const tva = VALID_TVA.has(Number(l.tva_rate)) ? Number(l.tva_rate) : 20;
      return {
        type_ligne:    "ouvrage",
        lot:           safeStr(l.lot),
        designation:   safeStr(l.designation) || "—",
        unite:         safeStr(l.unite, 30) || "forfait",
        quantite:      qty === null || isNaN(qty) || qty < 0 ? null : qty,
        prix_unitaire: isFinite(pu) && pu > 0 ? pu : null,
        tva_rate:      tva,
      };
    });

  const strArray = (v) =>
    Array.isArray(v) ? v.filter(s => typeof s === "string").map(s => s.slice(0, 300)) : [];

  return {
    objet:              safeStr(parsed.objet, 200),
    lignes,
    champs_a_completer: strArray(parsed.champs_a_completer),
    suggestions:        strArray(parsed.suggestions),
    target_total_ht:    parsed.target_total_ht ?? undefined,
    project_params:     (parsed.project_params && typeof parsed.project_params === "object") ? parsed.project_params : {},
  };
}

// Pipeline complet : raw text → { parsed, lignes, objet } prêts à être affichés.
// Renvoie null si pas de JSON exploitable (l'appelant gère le fallback).
export function processDevisFromRaw(raw, brand) {
  const devisJsonStr = extractDevisJson(raw);
  if (!devisJsonStr) return null;

  let rawParsed;
  try { rawParsed = JSON.parse(devisJsonStr); } catch { return null; }

  const parsed = sanitizeDevisJson(rawParsed);
  if (!parsed) return null;

  const initialLignes = parsed.lignes.map(l => ({ ...l, id: uid() }));
  const vatApplied    = applyVatRegime(initialLignes, brand.vatRegime);
  const finalLignes   = rescaleToTarget(vatApplied, parsed.target_total_ht);

  return { parsed, lignes: finalLignes, objet: parsed.objet || "" };
}
