import { checkCompleteness } from "./checkers/completeness.js";
import { checkQuantities }   from "./checkers/quantity.js";
import { checkUnitPrices }   from "./checkers/unitprice.js";
import { checkEnvelope }     from "./checkers/envelope.js";
import btpPack     from "./packs/btp_v1.json";
import conseilPack from "./packs/conseil_v1.json";

const PACKS = [btpPack, conseilPack];

function findTypologyById(id) {
  for (const pack of PACKS) {
    const t = pack.typologies.find(t => t.typology_id === id);
    if (t) return { pack, typology: t };
  }
  return null;
}

// Normalise un texte pour la recherche de mots-clés : minuscules, sans
// accents, œ/æ développés, ponctuation → espaces.
export function foldText(str) {
  return " " + String(str || "").toLowerCase()
    .replace(/œ/g, "oe").replace(/æ/g, "ae")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim() + " ";
}

// Le mot-clé apparaît comme mot(s) entier(s) : « ite » ne doit pas
// reconnaître « site », « conduite » ou « stéatite ».
function hasKeyword(folded, kw) {
  const k = foldText(kw).trim();
  return !!k && folded.includes(` ${k} `);
}

// Meilleure typologie pour un texte : celle dont le mot-clé reconnu est le
// plus long (le plus spécifique). Les typologies dont un mot-clé d'exclusion
// apparaît (`exclude_keywords` : prestation intellectuelle, autre ouvrage…)
// sont écartées.
function bestTypologyForText(text, context = "") {
  const folded = foldText(text);
  if (!folded.trim()) return null;
  const foldedAll = folded + foldText(context);
  let best = null, bestLen = 0;
  for (const pack of PACKS) {
    for (const typology of pack.typologies) {
      if ((typology.exclude_keywords || []).some(kw => hasKeyword(foldedAll, kw))) continue;
      for (const kw of typology.keywords || []) {
        const len = foldText(kw).trim().length;
        if (len > bestLen && hasKeyword(folded, kw)) { best = { pack, typology }; bestLen = len; }
      }
    }
  }
  return best;
}

// Détecte automatiquement la typologie : d'abord sur l'objet du devis (le
// plus fiable), puis seulement s'il ne dit rien, sur les noms de lots (pas
// les désignations d'ouvrages, trop bruyantes et source de faux positifs).
function detectTypology(devis) {
  const fromObjet = bestTypologyForText(devis.objet || "");
  if (fromObjet) return fromObjet;
  const lots = (devis.lignes || []).map(l =>
    l.type_ligne === "lot" ? (l.designation || "") : (l.lot || "")
  ).join(" | ");
  // Les exclusions tiennent compte de l'objet (« Mur de soutènement » avec
  // un lot « Gros œuvre » n'est pas une extension).
  return bestTypologyForText(lots, devis.objet || "");
}

// Applique les surcharges utilisateur sur une typologie (fourchettes custom).
function applyUserOverrides(typology, override) {
  if (!override) return typology;
  return {
    ...typology,
    envelope: override.envelope
      ? { ...typology.envelope, ...override.envelope }
      : typology.envelope,
  };
}

// Point d'entrée principal : prend un devis (format Zenbat) + paramètres utilisateur
// optionnels et retourne un rapport de validation overall_status "pass" | "warn" | "fail".
// Si aucune typologie n'est reconnue, ou si l'utilisateur a désactivé la vérification,
// retourne pass immédiatement.
export function runCoherenceCheck(devis, userSettings = null) {
  if (userSettings?.global_disabled) {
    return { overall_status: "pass", checks: [], typology_id: null };
  }

  let found = devis.typology_id ? findTypologyById(devis.typology_id) : null;
  if (!found) found = detectTypology(devis);
  if (!found) return { overall_status: "pass", checks: [], typology_id: null };

  const { typology } = found;

  // Vérification désactivée pour cette typologie spécifique
  const override = userSettings?.typology_overrides?.[typology.typology_id];
  if (override?.disabled) {
    return { overall_status: "pass", checks: [], typology_id: typology.typology_id };
  }

  const effectiveTypology = applyUserOverrides(typology, override);
  const projectParams = {
    ...(effectiveTypology.default_params || {}),
    ...(devis.project_params  || {}),
  };

  const checks = [
    checkCompleteness(devis, effectiveTypology),
    checkQuantities(devis, effectiveTypology, projectParams),
    checkUnitPrices(devis, effectiveTypology),
    checkEnvelope(devis, effectiveTypology, projectParams),
  ];

  const hasError = checks.some(c => c.status === "fail");
  const hasWarn  = checks.some(c => c.status === "warn");

  return {
    overall_status: hasError ? "fail" : hasWarn ? "warn" : "pass",
    checks,
    typology_id: typology.typology_id,
  };
}

// Détecte la typologie à partir du texte libre de la demande (avant génération),
// avec les mêmes mots-clés que le contrôle post-génération. Applique les
// fourchettes personnalisées de l'utilisateur. Renvoie null si aucune typologie
// n'est reconnue ou si l'utilisateur a désactivé la vérification (globale ou
// pour cette typologie) : ses prix ne suivent alors pas nos fourchettes.
export function findTypologyForText(text, userSettings = null) {
  if (userSettings?.global_disabled) return null;
  const found = bestTypologyForText(text);
  if (!found) return null;
  const override = userSettings?.typology_overrides?.[found.typology.typology_id];
  if (override?.disabled) return null;
  return applyUserOverrides(found.typology, override);
}

// Expose la liste des typologies de tous les packs pour l'UI de configuration.
export function getAllTypologies() {
  return PACKS.flatMap(pack =>
    pack.typologies.map(t => ({
      pack_id:      pack.pack_id,
      pack_name:    pack.pack_name,
      typology_id:  t.typology_id,
      label:        t.label,
      main_dimension: t.main_dimension,
      envelope:     t.envelope,
    }))
  );
}
