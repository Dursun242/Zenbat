import { uid } from "../utils.js";

// Extrait le JSON du bloc <DEVIS> même si la balise fermante est absente
// (cas où Claude émet du texte ou une astuce après le JSON sans </DEVIS>).
// Avec balise fermante : trivial. Sans : on équilibre les accolades.
// Mistral entoure souvent le JSON d'un bloc ```json … ``` à l'intérieur des
// balises : on le retire avant l'extraction.
const stripFence = (str) => str.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

export function extractDevisJson(raw) {
  const withClose = raw.match(/<DEVIS>([\s\S]*?)<\/DEVIS>/);
  if (withClose) return stripFence(withClose[1].trim()).trim();

  const openIdx = raw.indexOf("<DEVIS>");
  if (openIdx < 0) return null;

  const after = stripFence(raw.slice(openIdx + 7).trimStart()).trimStart();
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

// JSON « presque valide » produit par un modèle : commentaires, virgules
// finales, retours à la ligne bruts dans les chaînes, NaN / undefined,
// guillemets typographiques autour des clés. Réparation conservatrice,
// caractère par caractère (le contenu des chaînes n'est pas modifié).
export function repairJson(str) {
  // Passe 1 : chaînes (retours à la ligne bruts, guillemets typographiques
  // ouvrants / fermants hors chaîne) et commentaires.
  let pass1 = "", inStr = false, esc = false;
  const src = String(str || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) { esc = false; pass1 += ch; continue; }
      if (ch === "\\") { esc = true; pass1 += ch; continue; }
      if (ch === '"') { inStr = false; pass1 += ch; continue; }
      if (ch === "\n") { pass1 += "\\n"; continue; }
      if (ch === "\r") continue;
      if (ch === "\t") { pass1 += "\\t"; continue; }
      pass1 += ch; continue;
    }
    if (ch === '"' || ch === "\u201C" || ch === "\u201D") { inStr = true; pass1 += '"'; continue; }
    if (ch === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (ch === "/" && src[i + 1] === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i++; continue; }
    pass1 += ch;
  }
  // Passe 2 (hors chaînes) : virgules finales, NaN / undefined / Infinity.
  let out = "";
  inStr = false; esc = false;
  for (let i = 0; i < pass1.length; i++) {
    const ch = pass1[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      out += ch; continue;
    }
    if (ch === '"') { inStr = true; out += ch; continue; }
    if (ch === ",") {
      let j = i + 1;
      while (j < pass1.length && /\s/.test(pass1[j])) j++;
      if (pass1[j] === "}" || pass1[j] === "]") continue;
    }
    const word = /^(NaN|undefined|Infinity)\b/.exec(pass1.slice(i, i + 10));
    if (word && !/[\w$]/.test(pass1[i - 1] || "")) { out += "null"; i += word[1].length - 1; continue; }
    out += ch;
  }
  return out;
}

/** JSON.parse, puis une seconde chance sur la version réparée. null si illisible. */
export function parseDevisJson(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { /* réparation ci-dessous */ }
  try { return JSON.parse(repairJson(str)); } catch { return null; }
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

  const rawParsed = parseDevisJson(devisJsonStr);
  if (!rawParsed) return null;

  const parsed = sanitizeDevisJson(rawParsed);
  if (!parsed) return null;

  const initialLignes = parsed.lignes.map(l => ({ ...l, id: uid() }));
  const vatApplied    = applyVatRegime(initialLignes, brand.vatRegime);
  const finalLignes   = rescaleToTarget(vatApplied, parsed.target_total_ht);

  return { parsed, lignes: finalLignes, objet: parsed.objet || "" };
}
