import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock du moteur de cohérence et de stream pour contrôler les retours.
// vi.mock doit être en haut, hoisté avant les imports.
vi.mock("../coherence/engine.js", () => ({
  runCoherenceCheck: vi.fn(),
}));
vi.mock("../coherence/formatIssues.js", () => ({
  buildCorrectionPrompt: vi.fn(() => "Corrige les écarts."),
}));
vi.mock("./stream.js", async () => {
  const actual = await vi.importActual("./stream.js");
  return { ...actual, requestClaude: vi.fn() };
});

import { runCoherenceLoop } from "./coherenceLoop.js";
import { runCoherenceCheck } from "../coherence/engine.js";
import { requestClaude } from "./stream.js";
import { ClaudeApiError } from "./stream.js";

const baseDevis = {
  objet: "Travaux salle de bain",
  lignes: [
    { id: "a", type_ligne: "ouvrage", designation: "Faïence", quantite: 10, prix_unitaire: 80, tva_rate: 20 },
  ],
};

const baseArgs = {
  apiBody:     { model: "x", messages: [] },
  authHeaders: { Authorization: "Bearer t" },
  msgs:        [{ role: "user", content: "demande" }],
  rawResponse: "<DEVIS>{}</DEVIS>",
  brand:       { vatRegime: "normal" },
  userSettings: null,
};

describe("runCoherenceLoop", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(()  => { vi.restoreAllMocks(); });

  it("retourne le devis tel quel si la validation passe du premier coup", async () => {
    runCoherenceCheck.mockReturnValueOnce({ overall_status: "pass", checks: [], typology_id: "btp:bath" });
    const out = await runCoherenceLoop({ ...baseArgs, devis: baseDevis });
    expect(out.resolvedLignes).toBe(baseDevis.lignes);
    expect(out.resolvedObjet).toBe(baseDevis.objet);
    expect(out.validationResult.iteration_count).toBe(1);
    expect(requestClaude).not.toHaveBeenCalled();
  });

  it("traite 'warn' comme un succès (pas de retry)", async () => {
    runCoherenceCheck.mockReturnValueOnce({ overall_status: "warn", checks: [] });
    const out = await runCoherenceLoop({ ...baseArgs, devis: baseDevis });
    expect(out.validationResult.iteration_count).toBe(1);
    expect(requestClaude).not.toHaveBeenCalled();
  });

  it("appelle Claude pour correction quand la validation échoue, et accepte la correction", async () => {
    runCoherenceCheck
      .mockReturnValueOnce({ overall_status: "fail", checks: [{ issues: [{ code: "X" }] }] })
      .mockReturnValueOnce({ overall_status: "pass", checks: [] });

    const corrected = '<DEVIS>{"objet":"Corrigé","lignes":[{"type_ligne":"ouvrage","quantite":2,"prix_unitaire":150,"tva_rate":20}]}</DEVIS>';
    requestClaude.mockResolvedValueOnce(corrected);

    const out = await runCoherenceLoop({ ...baseArgs, devis: baseDevis });
    expect(requestClaude).toHaveBeenCalledTimes(1);
    expect(out.resolvedObjet).toBe("Corrigé");
    expect(out.resolvedLignes).toHaveLength(1);
    expect(out.resolvedLignes[0].id).toBeDefined();
    expect(out.validationResult.iteration_count).toBe(2);
  });

  it("force tva_rate=0 sur les lignes corrigées en franchise", async () => {
    runCoherenceCheck
      .mockReturnValueOnce({ overall_status: "fail", checks: [] })
      .mockReturnValueOnce({ overall_status: "pass", checks: [] });

    requestClaude.mockResolvedValueOnce(
      '<DEVIS>{"lignes":[{"type_ligne":"ouvrage","quantite":1,"prix_unitaire":100,"tva_rate":20}]}</DEVIS>'
    );

    const out = await runCoherenceLoop({
      ...baseArgs,
      devis: baseDevis,
      brand: { vatRegime: "franchise" },
    });
    expect(out.resolvedLignes[0].tva_rate).toBe(0);
  });

  it("retourne residual_issues si le retry échoue toujours", async () => {
    runCoherenceCheck
      .mockReturnValueOnce({ overall_status: "fail", checks: [{ issues: [{ code: "A" }] }] })
      .mockReturnValueOnce({ overall_status: "fail", checks: [{ issues: [{ code: "B" }] }] });

    requestClaude.mockResolvedValueOnce(
      '<DEVIS>{"lignes":[{"type_ligne":"ouvrage","quantite":1,"prix_unitaire":50,"tva_rate":20}]}</DEVIS>'
    );

    const out = await runCoherenceLoop({ ...baseArgs, devis: baseDevis });
    expect(out.validationResult.residual_issues).toEqual([{ code: "B" }]);
    expect(out.validationResult.iteration_count).toBe(2);
  });

  it("interrompt la boucle proprement sur erreur API et renvoie l'état initial", async () => {
    runCoherenceCheck.mockReturnValueOnce({ overall_status: "fail", checks: [{ issues: [{ code: "X" }] }] });
    requestClaude.mockRejectedValueOnce(new ClaudeApiError("Limite journalière"));

    const out = await runCoherenceLoop({ ...baseArgs, devis: baseDevis });
    expect(out.resolvedLignes).toBe(baseDevis.lignes);
    expect(out.validationResult.residual_issues).toEqual([{ code: "X" }]);
  });

  it("interrompt la boucle si la correction n'est pas un JSON exploitable", async () => {
    runCoherenceCheck.mockReturnValueOnce({ overall_status: "fail", checks: [] });
    requestClaude.mockResolvedValueOnce("Désolé, je n'ai pas compris."); // pas de <DEVIS>

    const out = await runCoherenceLoop({ ...baseArgs, devis: baseDevis });
    expect(out.resolvedLignes).toBe(baseDevis.lignes);
  });

  it("interrompt la boucle si le JSON corrigé est mal formé", async () => {
    runCoherenceCheck.mockReturnValueOnce({ overall_status: "fail", checks: [] });
    requestClaude.mockResolvedValueOnce('<DEVIS>{"lignes":[</DEVIS>');

    const out = await runCoherenceLoop({ ...baseArgs, devis: baseDevis });
    expect(out.resolvedLignes).toBe(baseDevis.lignes);
  });
});
