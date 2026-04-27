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

// Point d'entrée principal : prend un devis (format Zenbat) et retourne un
// rapport de validation avec overall_status "pass" | "warn" | "fail".
// Si aucune typologie n'est reconnue, retourne pass immédiatement.
export function runCoherenceCheck(devis) {
  let found = devis.typology_id ? findTypologyById(devis.typology_id) : null;
  if (!found) found = detectTypology(devis);
  if (!found) return { overall_status: "pass", checks: [], typology_id: null };

  const { typology } = found;
  const projectParams = {
    ...(typology.default_params || {}),
    ...(devis.project_params  || {}),
  };

  const checks = [
    checkCompleteness(devis, typology),
    checkQuantities(devis, typology, projectParams),
    checkUnitPrices(devis, typology),
    checkEnvelope(devis, typology, projectParams),
  ];

  const hasError = checks.some(c => c.status === "fail");
  const hasWarn  = checks.some(c => c.status === "warn");

  return {
    overall_status: hasError ? "fail" : hasWarn ? "warn" : "pass",
    checks,
    typology_id: typology.typology_id,
  };
}
