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

// Détecte automatiquement la typologie en cherchant les keywords du pack
// dans l'objet + les désignations du devis.
function detectTypology(devis) {
  const haystack = [
    devis.objet || "",
    ...(devis.lignes || []).map(l => l.designation || l.lot || ""),
  ].join(" ").toLowerCase();

  for (const pack of PACKS) {
    for (const typology of pack.typologies) {
      if ((typology.keywords || []).some(kw => haystack.includes(kw.toLowerCase()))) {
        return { pack, typology };
      }
    }
  }
  return null;
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
