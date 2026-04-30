import { runCoherenceCheck } from "../coherence/engine.js";
import { buildCorrectionPrompt } from "../coherence/formatIssues.js";
import { extractDevisJson, applyVatRegime } from "./extractDevis.js";
import { requestClaude, ClaudeApiError } from "./stream.js";
import { uid } from "../utils.js";

// 2 retries — quand l'IA est très loin du marché (ex : 975 € pour une rénovation
// plomberie 90 m² qui devrait être ~10 k), une seule passe ne suffit pas pour
// quintupler le total. La 2e passe pousse réellement l'IA dans la fourchette.
const COHERENCE_MAX_RETRIES = 2;

// Valide le devis avec le moteur de cohérence puis, en cas d'échec, demande
// une correction à Claude (jusqu'à COHERENCE_MAX_RETRIES). Retourne toujours
// le meilleur état atteint, avec un éventuel residual_issues si non résolu.
export async function runCoherenceLoop({ devis, apiBody, authHeaders, msgs, rawResponse, brand, userSettings = null }) {
  let currentDevis = devis;
  let currentRaw   = rawResponse;
  let iterationCount = 1;

  let result = runCoherenceCheck(currentDevis, userSettings);
  if (result.overall_status !== "fail") {
    return {
      resolvedLignes:   currentDevis.lignes,
      resolvedObjet:    currentDevis.objet,
      validationResult: { ...result, iteration_count: 1 },
    };
  }

  for (let i = 0; i < COHERENCE_MAX_RETRIES; i++) {
    iterationCount = i + 2;
    const correctionPrompt = buildCorrectionPrompt(result);

    let correctedRaw;
    try {
      correctedRaw = await requestClaude({
        body: {
          ...apiBody,
          messages: [
            ...msgs.slice(-6),
            { role: "assistant", content: currentRaw },
            { role: "user",      content: correctionPrompt },
          ],
          stream: false,
        },
        authHeaders,
      });
    } catch (err) {
      // Erreur API ou réseau : on sort de la boucle et renvoie l'état courant.
      if (err instanceof ClaudeApiError) break;
      break;
    }

    const corrJsonStr = extractDevisJson(correctedRaw);
    if (!corrJsonStr) break;

    let correctedParsed;
    try { correctedParsed = JSON.parse(corrJsonStr); } catch { break; }

    const correctedLignes = applyVatRegime(
      (correctedParsed.lignes || []).map(l => ({ ...l, id: uid() })),
      brand.vatRegime,
    );

    currentDevis = { ...correctedParsed, lignes: correctedLignes };
    currentRaw   = correctedRaw;
    result       = runCoherenceCheck(currentDevis, userSettings);

    if (result.overall_status !== "fail") {
      return {
        resolvedLignes:   currentDevis.lignes,
        resolvedObjet:    currentDevis.objet,
        validationResult: { ...result, iteration_count: iterationCount },
      };
    }
  }

  return {
    resolvedLignes:   currentDevis.lignes,
    resolvedObjet:    currentDevis.objet,
    validationResult: {
      ...result,
      iteration_count: iterationCount,
      residual_issues: (result.checks || []).flatMap(c => c.issues || []),
    },
  };
}
