import { useState, useRef, useEffect, useMemo } from "react";
import { CLAUDE_MODEL, TX } from "../lib/constants.js";
import { fmt, uid } from "../lib/utils.js";
import { tradesLabels } from "../lib/trades.js";
import { buildDevisHistorySummary } from "../lib/devisHistory.js";
import { supabase } from "../lib/supabase.js";
import { getToken } from "../lib/getToken.js";
import { SR_LANGS, MIC_LANG_KEY, pickInitialLang } from "../lib/agentIA/speech.js";
import { buildAgentGreeting, quickStartsFor } from "../lib/agentIA/sectors.js";
import { buildSystemPrompt } from "../lib/agentIA/prompt.js";
import { runCoherenceCheck } from "../lib/coherence/engine.js";
import { buildCorrectionPrompt } from "../lib/coherence/formatIssues.js";
import { loadUserCoherenceSettings } from "../lib/coherence/userOverrides.js";
import { I } from "./ui/icons.jsx";
import ClientPickerModal from "./ClientPickerModal.jsx";
import CelebrateModal from "./agent/CelebrateModal.jsx";
import CoherenceSettings from "./CoherenceSettings.jsx";

// Extrait le JSON du bloc <DEVIS> même si la balise fermante est absente
// (cas où Claude émet du texte ou une astuce après le JSON sans </DEVIS>).
// Avec balise fermante : trivial. Sans : on équilibre les accolades.
function extractDevisJson(raw) {
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

// ─── Boucle de cohérence : valide + corrige jusqu'à COHERENCE_MAX_RETRIES fois ──
const COHERENCE_MAX_RETRIES = 1;

async function runCoherenceLoop(devis, apiBody, authHeaders, msgs, rawResponse, brand, userSettings = null) {
  let currentDevis = devis;
  let currentRaw   = rawResponse;
  let iterationCount = 1;

  let result = runCoherenceCheck(currentDevis, userSettings);
  if (result.overall_status !== "fail") {
    return { resolvedLignes: currentDevis.lignes, resolvedObjet: currentDevis.objet, validationResult: { ...result, iteration_count: 1 } };
  }

  for (let i = 0; i < COHERENCE_MAX_RETRIES; i++) {
    iterationCount = i + 2;
    const correctionPrompt = buildCorrectionPrompt(result);

    let correctedRaw = "";
    try {
      const correctionMessages = [
        ...msgs.slice(-6),
        { role: "assistant", content: currentRaw },
        { role: "user",      content: correctionPrompt },
      ];
      const res = await fetch("/api/claude", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body:    JSON.stringify({ ...apiBody, messages: correctionMessages, stream: false }),
      });
      if (!res.ok) break;
      const data = await res.json().catch(() => null);
      correctedRaw = data?.content?.[0]?.text || "";
    } catch { break; }

    const corrJsonStr = extractDevisJson(correctedRaw);
    if (!corrJsonStr) break;

    let correctedParsed;
    try { correctedParsed = JSON.parse(corrJsonStr); } catch { break; }

    let correctedLignes = (correctedParsed.lignes || []).map(l => ({ ...l, id: uid() }));
    if (brand.vatRegime === "franchise") {
      correctedLignes = correctedLignes.map(l =>
        l.type_ligne === "ouvrage" ? { ...l, tva_rate: 0 } : l
      );
    }

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

  // Après COHERENCE_MAX_RETRIES sans succès : retourne le meilleur état avec avertissement
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

export default function AgentIA({ devis, onCreateDevis, clients, onSaveClient, plan, trialExpired, onPaywall, setTab, onOpenDevisPDF, brand }) {
  const [msgs,         setMsgs]         = useState(() => [{ role: "assistant", content: buildAgentGreeting(brand) }]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [feedback,     setFeedback]     = useState({});

  const saveFeedback = async (msgIdx, vote, reason = null) => {
    const prevMsg = msgs[msgIdx - 1];
    await supabase.from("ia_feedback").insert({
      vote,
      reason: reason || null,
      user_message: prevMsg?.content?.slice(0, 500) || null,
      lignes_count: lignes.filter(l => l.type_ligne === "ouvrage").length,
      trades: brand.trades?.length ? brand.trades : null,
    }).then(() => {}, () => {});
    setFeedback(prev => ({ ...prev, [msgIdx]: { ...prev[msgIdx], saved: true } }));
  };
  const [lignes, setLignes] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem("zenbat_ia_draft") || "{}"); return Array.isArray(d.lignes) ? d.lignes : []; } catch { return []; }
  });
  const [objet, setObjet] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem("zenbat_ia_draft") || "{}"); return typeof d.objet === "string" ? d.objet : ""; } catch { return ""; }
  });
  const [visibleCount, setVisibleCount] = useState(0);
  const [pickingClient, setPickingClient] = useState(false);
  const [listening,    setListening]    = useState(false);
  const [micLang,      setMicLang]      = useState(() => pickInitialLang());
  const [langMenu,     setLangMenu]     = useState(false);
  // Suggestions cliquables adaptées au 1er secteur — anti-syndrome page blanche.
  // 4 exemples de devis typiques du métier pour démarrer en 1 clic.
  const [quickStarts] = useState(() => quickStartsFor(brand));
  // Flag one-shot : modale festive au tout premier devis du compte
  const [celebrate,    setCelebrate]    = useState(false);
  const celebrateStartRef = useRef(null);
  const celebrateSecondsRef = useRef(0);
  const [micError,     setMicError]     = useState(null);
  const [editing,      setEditing]      = useState(null);   // { id, field }
  const [editingObjet, setEditingObjet] = useState(false);
  const [coherenceSettingsOpen, setCoherenceSettingsOpen] = useState(false);
  const userSettingsRef = useRef(null);
  const chatRef  = useRef(null);
  const inputRef = useRef(null);
  const recRef   = useRef(null);
  const accumRef = useRef("");

  const ac         = brand.color || "#22c55e";
  const fontFamily = brand.fontStyle === "elegant" ? "Playfair Display" : brand.fontStyle === "tech" ? "Space Grotesk" : "DM Sans";

  // Résume l'historique pour contextualiser l'IA (recalculé quand devis change)
  const historySummary = useMemo(() => buildDevisHistorySummary(devis), [devis]);

  useEffect(() => {
    loadUserCoherenceSettings().then(s => { userSettingsRef.current = s; });
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  // Auto-grandit le textarea et suit la fin du texte (utile pendant la dictée)
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    ta.scrollTop = ta.scrollHeight;
    ta.scrollLeft = ta.scrollWidth;
  }, [input]);

  useEffect(() => {
    try {
      if (!lignes.length && !objet) localStorage.removeItem("zenbat_ia_draft");
      else localStorage.setItem("zenbat_ia_draft", JSON.stringify({ lignes, objet }));
    } catch {}
  }, [lignes, objet]);

  useEffect(() => {
    if (!lignes.length) return;
    setVisibleCount(0);
    let i = 0;
    const iv = setInterval(() => { i++; setVisibleCount(i); if (i >= lignes.length) clearInterval(iv); }, 110);
    return () => clearInterval(iv);
  }, [lignes]);

  const ht = lignes.filter(l => l.type_ligne === "ouvrage")
    .reduce((s, l) => s + l.quantite * (l.prix_unitaire || 0), 0);

  const tvaGroups = lignes.filter(l => l.type_ligne === "ouvrage").reduce((a, l) => {
    const r = Number(l.tva_rate ?? 20);
    a[r] = (a[r] || 0) + (l.quantite || 0) * (l.prix_unitaire || 0);
    return a;
  }, {});
  const tvaRows = Object.keys(tvaGroups).map(Number).sort((a, b) => a - b)
    .map(r => ({ rate: r, base: tvaGroups[r], montant: tvaGroups[r] * (r / 100) }));
  const tvaTotal = tvaRows.reduce((s, r) => s + r.montant, 0);
  const ttc = ht + tvaTotal;


  const send = async (overrideText) => {
    // overrideText est optionnel : il peut être une string fournie par la
    // puce « Essayer un exemple », ou ne pas être passé. Quand cette
    // fonction est branchée directement sur onClick={send}, React passe
    // un SyntheticEvent comme 1er argument → on ignore tout ce qui n'est
    // pas une string et on retombe sur la valeur du champ texte.
    const source = typeof overrideText === "string" ? overrideText : input;
    const payload = source.trim();
    if (!payload || loading) return;
    if (trialExpired) { onPaywall(); return; }

    // Chrono pour la modale festive "X secondes"
    celebrateStartRef.current = Date.now();

    const userMsg = { role: "user", content: payload };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);

    // Stoppe la dictée vocale en cours et purge le buffer d'accumulation —
    // sinon le prochain résultat SpeechRecognition ré-injecte l'ancien texte
    // dans le champ et on risque les doublons d'envoi. On détache aussi
    // onresult pour ignorer un éventuel tick final en vol après stop().
    try {
      const rec = recRef.current;
      if (rec) { rec.onresult = null; rec.stop(); }
    } catch {}
    setListening(false);
    accumRef.current = "";

    setInput(""); setLoading(true);

    let assistantAdded = false;
    const updateAssistant = (visibleText, hasDevis = false) => {
      setMsgs(prev => {
        if (!assistantAdded) {
          assistantAdded = true;
          return [...prev, { role: "assistant", content: visibleText, hasDevis }];
        }
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: visibleText, hasDevis };
        return next;
      });
    };

    const body = {
      model: CLAUDE_MODEL,
      max_tokens:  6000,
      // Température basse = adhésion forte aux règles "pas de question avant <DEVIS>"
      // et prix plus stables pour une même demande (audit recommandation).
      temperature: 0.2,
      system: buildSystemPrompt({ brand, historySummary }),
      messages: newMsgs.slice(-20).map(m => ({ role: m.role, content: m.content })),
    };

    const token = await getToken();
    const authHeaders = token ? { "Authorization": `Bearer ${token}` } : {};

    let raw = "";
    let apiError = null;
    const fetchStartTime = Date.now();
    let firstChunkTime = null;

    const streamResponse = async () => {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ ...body, stream: true }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        apiError = detail?.error || `HTTP ${res.status}`;
        throw new Error("api");
      }
      if (!res.body) throw new Error("api");
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const event = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          for (const line of event.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            let msg;
            try { msg = JSON.parse(payload); } catch { continue; }
            if (msg.type === "content_block_delta" && msg.delta?.type === "text_delta") {
              if (!firstChunkTime) {
                firstChunkTime = Date.now() - fetchStartTime;
              }
              raw += msg.delta.text || "";
              const cut     = raw.indexOf("<DEVIS>");
              const visible = (cut >= 0 ? raw.slice(0, cut) : raw).trim();
              if (visible) updateAssistant(visible);
            } else if (msg.type === "error") {
              apiError = msg.error?.message || "Erreur Anthropic";
              throw new Error("api");
            }
          }
        }
      }
    };

    const nonStreamResponse = async () => {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        apiError = data?.error || `HTTP ${res.status}`;
        throw new Error("api");
      }
      raw = (data?.content?.[0]?.text || "").toString();
      const cut     = raw.indexOf("<DEVIS>");
      const visible = (cut >= 0 ? raw.slice(0, cut) : raw).trim();
      if (visible) updateAssistant(visible);
    };

    try {
      try {
        await streamResponse();
        if (!raw) throw new Error("stream-empty");
      } catch (streamErr) {
        // Fallback non-streamé uniquement si c'est une erreur réseau/SSE,
        // PAS si Anthropic a renvoyé une vraie erreur API (4xx/5xx).
        if (streamErr.message === "api") throw streamErr;
        console.warn("[AgentIA] streaming failed, falling back:", streamErr);
        raw = "";
        await nonStreamResponse();
      }

      const devisJsonStr = extractDevisJson(raw);
      const txt          = raw.replace(/<DEVIS>[\s\S]*/g, "").trim();

      let residualWarning = "";
      if (devisJsonStr) {
        try {
          const parsed    = JSON.parse(devisJsonStr);
          const newLignes = (parsed.lignes || []).map(l => ({ ...l, id: uid() }));

          // Franchise en base de TVA : force tva_rate = 0 sur toutes les lignes
          // (remap immuable — jamais de mutation in-place).
          let finalLignes = brand.vatRegime === "franchise"
            ? newLignes.map(l => l.type_ligne === "ouvrage" ? { ...l, tva_rate: 0 } : l)
            : newLignes;

          // Filet de sécurité : si l'IA déclare un montant cible et que la somme
          // des lignes ouvrage n'y correspond pas, on rescale les prix unitaires.
          const target = Number(parsed.target_total_ht);
          if (target > 0) {
            const sum = finalLignes
              .filter(l => l.type_ligne === "ouvrage")
              .reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
            if (sum > 0 && Math.abs(sum - target) / target > 0.005) {
              const ratio = target / sum;
              // 1ère passe : rescale proportionnel sur chaque ligne ouvrage
              finalLignes = finalLignes.map(l => l.type_ligne === "ouvrage"
                ? { ...l, prix_unitaire: Math.round((Number(l.prix_unitaire) || 0) * ratio * 100) / 100 }
                : l);
              // 2ème passe : absorbe la dérive d'arrondi sur la dernière ligne ouvrage
              const rescaled = finalLignes
                .filter(l => l.type_ligne === "ouvrage")
                .reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
              const drift = target - rescaled;
              if (Math.abs(drift) > 0.009) {
                let fixed = false;
                finalLignes = [...finalLignes].reverse().map(l => {
                  if (!fixed && l.type_ligne === "ouvrage") {
                    fixed = true;
                    const q  = Number(l.quantite) || 1;
                    const pu = (Number(l.prix_unitaire) || 0) + drift / q;
                    return { ...l, prix_unitaire: Math.round(pu * 100) / 100 };
                  }
                  return l;
                }).reverse();
              }
            }
          }

          // ─── Moteur de cohérence : validation + boucle de correction ────────
          let resolvedLignes   = finalLignes;
          let resolvedObjet    = parsed.objet || "";
          let validationResult = { overall_status: "pass", checks: [], typology_id: null, iteration_count: 1 };
          try {
            const coherence = await runCoherenceLoop(
              { ...parsed, lignes: finalLignes },
              body, authHeaders, newMsgs, raw, brand, userSettingsRef.current,
            );
            resolvedLignes   = coherence.resolvedLignes;
            resolvedObjet    = coherence.resolvedObjet || parsed.objet || "";
            validationResult = coherence.validationResult;
          } catch { /* coherence loop failed — on conserve les lignes originales */ }

          // Log de validation (best-effort, table créée par migration 0024)
          if (validationResult.typology_id) {
            supabase.from("coherence_validations").insert({
              typology_id:     validationResult.typology_id,
              overall_status:  validationResult.overall_status,
              checks:          validationResult.checks,
              iteration_count: validationResult.iteration_count ?? 1,
            }).then(() => {}, () => {});
          }

          if (resolvedObjet) setObjet(resolvedObjet);
          setLignes(resolvedLignes);

          // Avertissement résiduel si le moteur n'a pas pu tout corriger en 3 essais
          if (validationResult.residual_issues?.length > 0) {
            residualWarning = "\n\n⚠️ Devis vérifié automatiquement : des écarts de marché subsistent. Vous pouvez les ajuster manuellement.";
          }

          // Champs manquants signalés par l'IA (quantités / prix non dictés)
          const missing = Array.isArray(parsed.champs_a_completer) ? parsed.champs_a_completer.filter(Boolean) : [];
          if (missing.length > 0) {
            residualWarning += "\n\n📋 À compléter :\n" + missing.map(m => `• ${m}`).join("\n");
          }

          // Suggestions (prestations non demandées à envisager)
          const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.filter(Boolean) : [];
          if (suggestions.length > 0) {
            residualWarning += "\n\n💡 À envisager :\n" + suggestions.map(s => `• ${s}`).join("\n");
          }

          // Tout premier devis jamais généré sur ce compte :
          // on déclenche une modale festive si aucun devis n'existe encore en DB.
          if (devis.length === 0 && resolvedLignes.some(l => l.type_ligne === "ouvrage")) {
            const elapsed = celebrateStartRef.current
              ? Math.max(1, Math.round((Date.now() - celebrateStartRef.current) / 1000))
              : 0;
            celebrateSecondsRef.current = elapsed;
            setCelebrate(true);
          }
        } catch { /* JSON mal formé — on ignore */ }
      }

      const finalText = (txt || (devisJsonStr ? TX.linesAdded : "Je n'ai pas compris, pouvez-vous reformuler ?")) + residualWarning;
      updateAssistant(finalText, !!devisJsonStr);

      // Détection best-effort des interactions "négatives" pour analyse admin.
      // - Refus IA : pas de <DEVIS> émis + vocabulaire de refus dans la réponse.
      // - Utilisateur mécontent : marqueurs de frustration dans le message.
      // Refus "dur" uniquement (pas les questions polies du flux soft hors-périmètre).
      const refusalRe  = /ne r[ée]alis(ons|e|ent) pas|ne fais(ons|ent)? pas|ne propos(ons|e|ent) pas|ne traitons pas|pas (notre|de) sp[ée]cialit[ée]/i;
      const negUserRe  = /\b(nul|nulle|pourri|pourrie|merdique|d[ée]bile|stupide|inutile|ne sert à rien|marche pas|fonctionne pas|ne comprend[s]? rien|ça bug|bug[ué]|ça beug|arrête de|n'importe quoi|t'es mauvais|mauvaise r[ée]ponse)\b/i;
      const isRefusal     = !devisJsonStr && refusalRe.test(finalText);
      const isUserNegative= negUserRe.test(userMsg.content || "");
      if (isRefusal || isUserNegative) {
        supabase.from("ia_negative_logs").insert({
          kind:         isRefusal ? "ai_refusal" : "user_negative",
          user_message: userMsg.content?.slice(0, 500) || null,
          ai_response:  isRefusal ? (finalText?.slice(0, 500) || null) : null,
        }).then(
          ({ error: dbErr }) => { if (dbErr) console.warn("[negative log/db]", dbErr.message); },
          (netErr)           => { console.warn("[negative log/net]", netErr?.message || netErr); },
        );
      }

      // Journal complet (user + IA) pour consultation admin compte-par-compte.
      // Best-effort, silencieux. On ne stocke QUE le texte visible (pas le JSON
      // <DEVIS>) + le flag had_devis pour l'analyse.
      supabase.from("ia_conversations").insert({
        user_message: userMsg.content?.slice(0, 2000) || null,
        ai_response:  finalText?.slice(0, 2000) || null,
        had_devis:    !!devisJsonStr,
        trade_names:  tradesLabels(brand?.trades || []).slice(0, 3).join(", ") || null,
        model:        CLAUDE_MODEL,
      }).then(
        ({ error: dbErr }) => { if (dbErr) console.warn("[conv log/db]", dbErr.message); },
        (netErr)           => { console.warn("[conv log/net]", netErr?.message || netErr); },
      );

      // Incrémente le compteur d'usage IA (best-effort, silencieux)
      supabase.rpc("increment_ai_used").then(() => {}, () => {});
    } catch (e) {
      const detail = apiError || e.message || "unknown";
      console.error("[AgentIA] send failed:", e, apiError);
      // Log côté serveur pour consultation admin (best-effort, silencieux).
      // Supabase ne rejette jamais .then() → on gère l'error dans onFulfilled
      // et les vraies erreurs réseau dans onRejected.
      supabase.from("ia_error_logs").insert({
        error:         detail,
        user_message:  userMsg.content?.slice(0, 500) || null,
        history_len:   newMsgs.length,
        stream_tried:  true,
      }).then(
        ({ error: dbErr }) => { if (dbErr) console.warn("[log insert/db]", dbErr.message); },
        (netErr)           => { console.warn("[log insert/net]", netErr?.message || netErr); },
      );
      let msg;
      if (!navigator.onLine) {
        msg = TX.errNetwork;
      } else if (apiError?.includes("journalière") || apiError?.includes("429")) {
        msg = apiError; // affiche le message précis (ex: "Limite journalière atteinte (40 appels/jour)")
      } else if (apiError?.includes("Période d'essai")) {
        msg = apiError;
      } else if (apiError?.includes("28 secondes") || apiError?.includes("504")) {
        msg = "La demande a pris trop de temps. Réessayez avec une description plus courte.";
      } else if (apiError?.includes("529") || apiError?.includes("overloaded") || apiError?.includes("Upstream")) {
        msg = "Les serveurs IA sont surchargés en ce moment. Réessayez dans 30 secondes.";
      } else {
        msg = e.message === "api" ? TX.errApi : TX.errGeneral;
      }
      updateAssistant("❌ " + msg);
    }
    setLoading(false);
  };

  // ── Reconnaissance vocale (Web Speech API) ─────────────────
  const SRClass = typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const micSupported = !!SRClass;

  useEffect(() => () => {
    const rec = recRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onend    = null;
      rec.onerror  = null;
      try { rec.stop(); } catch {}
    }
  }, []);

  const stopListening = () => {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  };

  const startListening = () => {
    if (!SRClass) { setMicError("La reconnaissance vocale n'est pas disponible sur ce navigateur."); return; }
    setMicError(null);
    accumRef.current = input && !input.endsWith(" ") ? input + " " : input;
    const rec = new SRClass();
    rec.lang = micLang;
    rec.continuous     = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + " ";
        else interim += t;
      }
      if (final) accumRef.current += final;
      setInput(accumRef.current + interim);
    };
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setMicError("Microphone refusé. Autorisez-le dans les réglages du navigateur.");
      } else if (ev.error === "no-speech") {
        setMicError(null);
      } else {
        setMicError("Problème de reconnaissance vocale. Réessayez.");
      }
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const toggleMic = () => (listening ? stopListening() : startListening());

  const pickLang = (code) => {
    setMicLang(code);
    try { localStorage.setItem(MIC_LANG_KEY, code); } catch {}
    setLangMenu(false);
    if (listening) { stopListening(); setTimeout(startListening, 120); }
  };

  const currentLang = SR_LANGS.find(l => l.code === micLang) || SR_LANGS[0];

  const deleteLigne = id => setLignes(l => l.filter(x => x.id !== id));

  const updateLigne = (id, field, val) =>
    setLignes(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));

  const addLigne = () => {
    const l = { id: uid(), type_ligne: "ouvrage", designation: "Nouvelle prestation", unite: "u", quantite: 1, prix_unitaire: 0, tva_rate: brand.vatRegime === "franchise" ? 0 : 20 };
    setLignes(prev => [...prev, l]);
    setEditing({ id: l.id, field: "designation" });
  };

  const finalizeSave = (clientId) => {
    const ht2     = lignes.filter(l => l.type_ligne === "ouvrage").reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0);
    const picked  = clientId ? clients.find(c => c.id === clientId) : null;
    const newId   = uid();
    onCreateDevis({
      id: newId,
      numero: `DEV-${new Date().getFullYear()}-${String(devis.length + 1).padStart(4, "0")}`,
      objet: objet || "Devis IA",
      client_id: clientId || null,
      ville_chantier: picked?.ville || "",
      statut: "brouillon",
      montant_ht: ht2,
      tva_rate: 20,
      date_emission: new Date().toISOString().split("T")[0],
      lignes,
      odoo_sign_url: null,
    });
    setPickingClient(false);
    try { localStorage.removeItem("zenbat_ia_draft"); } catch {}
    setLignes([]); setObjet("");
    setMsgs([{ role: "assistant", content: TX.quoteSaved }]);
    // Ouvre directement la vue PDF du devis fraîchement enregistré
    if (onOpenDevisPDF) onOpenDevisPDF(newId);
    else setTimeout(() => setTab("devis"), 2500);
  };

  const visibleLignes = lignes.slice(0, visibleCount);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#FAF7F2" }}>
      <style>{`
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-14px) scale(.97)}to{opacity:1;transform:translateX(0) scale(1)}}
        @keyframes rowPop{0%{opacity:0;transform:translateY(6px) scaleY(.85)}100%{opacity:1;transform:translateY(0) scaleY(1)}}
        @keyframes totalCount{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
      `}</style>

      {/* ═══ HAUT : aperçu devis en cours ═══════════════════ */}
      <div style={{ flexShrink: 0, background: "white", borderBottom: "2px solid #F0EBE3", minHeight: 110, maxHeight: "45%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* En-tête branding */}
        <div style={{ background: ac, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {brand.logo
              ? <img src={brand.logo} alt="" style={{ height: 32, maxWidth: 100, objectFit: "contain" }}/>
              : <span style={{ fontFamily, fontWeight: 800, fontSize: 15, color: "white" }}>{brand.companyName || "Votre entreprise"}</span>
            }
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily, color: "rgba(255,255,255,.6)", fontSize: 9, letterSpacing: "1.5px", fontWeight: 600 }}>{TX.quoteInProgress.toUpperCase()}</div>
              <div style={{ fontFamily, color: "white", fontWeight: 800, fontSize: 18, marginTop: 2, animation: "totalCount .3s ease both" }}>
                {fmt(ht)} <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(255,255,255,.7)", marginLeft: 4 }}>HT</span>
              </div>
            </div>
            <button onClick={() => setCoherenceSettingsOpen(true)} title="Paramètres de vérification"
              style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: "white", lineHeight: 0, flexShrink: 0 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
        </div>

        {/* Objet du devis */}
        {objet && (
          <div style={{ background: "#1A1612", padding: "6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {editingObjet
              ? <input autoFocus defaultValue={objet}
                  onBlur={e => { setObjet(e.target.value.trim() || objet); setEditingObjet(false); }}
                  onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingObjet(false); }}
                  style={{ flex: 1, fontFamily, fontSize: 12, fontWeight: 600, color: "#1A1612", background: "white", border: "none", outline: "none", borderRadius: 4, padding: "2px 6px" }} />
              : <span onClick={() => setEditingObjet(true)} title="Cliquer pour modifier"
                  style={{ fontFamily, color: "rgba(255,255,255,.9)", fontSize: 12, fontWeight: 600, cursor: "text", flex: 1 }}>{objet}</span>
            }
            <span style={{ color: "#6B6358", fontSize: 10, marginLeft: 8, flexShrink: 0 }}>{lignes.filter(l => l.type_ligne === "ouvrage").length} ligne{lignes.filter(l => l.type_ligne === "ouvrage").length > 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Tableau des lignes */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {visibleLignes.length === 0 ? (
            <div style={{ padding: "20px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 12, color: "#9A8E82", fontWeight: 500 }}>Les lignes du devis apparaîtront ici</div>
              <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>Décrivez votre besoin ci-dessous</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "white", zIndex: 1 }}>
                <tr style={{ borderBottom: "1px solid #F0EBE3" }}>
                  <th style={{ textAlign: "left",  padding: "6px 14px", fontSize: 9, fontWeight: 600, color: "#9A8E82", letterSpacing: "1px" }}>DÉSIGNATION</th>
                  <th style={{ textAlign: "right", padding: "6px 8px",  fontSize: 9, fontWeight: 600, color: "#9A8E82", width: 50 }}>QTÉ</th>
                  <th style={{ textAlign: "right", padding: "6px 8px",  fontSize: 9, fontWeight: 600, color: "#9A8E82", width: 65 }}>P.U. HT</th>
                  <th style={{ textAlign: "right", padding: "6px 14px", fontSize: 9, fontWeight: 600, color: "#9A8E82", width: 75 }}>TOTAL HT</th>
                  <th style={{ width: 28 }}/>
                </tr>
              </thead>
              <tbody>
                {visibleLignes.map((l, idx) => {
                  if (l.type_ligne === "lot") return (
                    <tr key={l.id} style={{ animation: "slideIn .25s ease both", animationDelay: `${idx * 0.05}s` }}>
                      <td colSpan={5} style={{ background: ac + "18", padding: "7px 14px", borderBottom: "1px solid " + ac + "22" }}>
                        <span style={{ fontFamily, fontSize: 10, fontWeight: 700, color: ac, textTransform: "uppercase", letterSpacing: "1px" }}>{l.designation}</span>
                      </td>
                    </tr>
                  );
                  const total = (l.quantite != null && l.prix_unitaire != null)
                    ? l.quantite * l.prix_unitaire
                    : null;
                  return (
                    <tr key={l.id} style={{ borderBottom: "1px solid #FAF7F2", animation: "rowPop .3s cubic-bezier(.34,1.3,.64,1) both", animationDelay: `${idx * 0.06}s` }}>
                      <td style={{ padding: "8px 14px" }}>
                        {editing?.id === l.id && editing?.field === "designation"
                          ? <input autoFocus defaultValue={l.designation}
                              onBlur={e => { updateLigne(l.id, "designation", e.target.value.trim() || l.designation); setEditing(null); }}
                              onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditing(null); }}
                              style={{ fontSize: 12, fontWeight: 500, color: "#2A231C", width: "100%", border: "none", outline: `2px solid ${ac}`, borderRadius: 4, padding: "2px 4px", background: "#f0fdf4", fontFamily }} />
                          : <div onClick={() => setEditing({ id: l.id, field: "designation" })} title="Cliquer pour modifier"
                              style={{ fontSize: 12, fontWeight: 500, color: "#2A231C", fontFamily, cursor: "text" }}>{l.designation}</div>
                        }
                        <div style={{ fontSize: 10, color: "#9A8E82", marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{l.unite}</span>
                          <button
                            onClick={() => {
                              if (brand.vatRegime === "franchise") return;
                              const cycle = [20, 10, 5.5];
                              const cur   = Number(l.tva_rate ?? 20);
                              const next  = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
                              setLignes(prev => prev.map(x => x.id === l.id ? { ...x, tva_rate: next } : x));
                            }}
                            disabled={brand.vatRegime === "franchise"}
                            title={brand.vatRegime === "franchise" ? "Franchise en base (art. 293 B du CGI)" : "Cliquer pour changer le taux de TVA"}
                            style={{ background: "#F0EBE3", color: "#6B6358", border: "none", borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 600, cursor: brand.vatRegime === "franchise" ? "default" : "pointer" }}>
                            TVA {(l.tva_rate ?? (brand.vatRegime === "franchise" ? 0 : 20)).toString().replace(".", ",")}%
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: "8px", textAlign: "right", fontSize: 12, color: "#3D3028", fontWeight: 600 }}>
                        {editing?.id === l.id && editing?.field === "quantite"
                          ? <input autoFocus type="number" defaultValue={l.quantite} min="0"
                              onBlur={e => { updateLigne(l.id, "quantite", parseFloat(e.target.value) || 0); setEditing(null); }}
                              onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditing(null); }}
                              style={{ width: 50, textAlign: "right", border: "none", outline: `2px solid ${ac}`, borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#3D3028", background: "#f0fdf4", padding: "2px 4px" }} />
                          : <span onClick={() => setEditing({ id: l.id, field: "quantite" })} title="Cliquer pour modifier" style={{ cursor: "text", color: l.quantite == null ? "#f59e0b" : undefined }}>{l.quantite ?? "—"}</span>
                        }
                      </td>
                      <td style={{ padding: "8px", textAlign: "right", fontSize: 11, color: "#6B6358" }}>
                        {editing?.id === l.id && editing?.field === "prix"
                          ? <input autoFocus type="number" defaultValue={l.prix_unitaire} min="0" step="0.01"
                              onBlur={e => { updateLigne(l.id, "prix_unitaire", parseFloat(e.target.value) || 0); setEditing(null); }}
                              onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditing(null); }}
                              style={{ width: 65, textAlign: "right", border: "none", outline: `2px solid ${ac}`, borderRadius: 4, fontSize: 11, color: "#6B6358", background: "#f0fdf4", padding: "2px 4px" }} />
                          : <span onClick={() => setEditing({ id: l.id, field: "prix" })} title="Cliquer pour modifier" style={{ cursor: "text", color: l.prix_unitaire == null ? "#f59e0b" : undefined }}>{l.prix_unitaire != null ? fmt(l.prix_unitaire) : "—"}</span>
                        }
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: total == null ? "#f59e0b" : "#1A1612" }}>{total != null ? fmt(total) : "—"}</td>
                      <td style={{ padding: "4px" }}>
                        <button onClick={() => deleteLigne(l.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#E8E2D8", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}
                          onMouseOver={e => e.target.style.color = "#ef4444"}
                          onMouseOut={e => e.target.style.color = "#E8E2D8"}>×</button>
                      </td>
                    </tr>
                  );
                })}

                {/* Bouton ajouter une ligne manuelle */}
                {visibleCount >= lignes.length && lignes.length > 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "4px 14px 8px" }}>
                      <button onClick={addLigne}
                        style={{ background: "none", border: `1px dashed ${ac}44`, borderRadius: 8, padding: "5px 14px", fontSize: 11, color: ac, cursor: "pointer", width: "100%", fontWeight: 600 }}>
                        + Ajouter une ligne
                      </button>
                    </td>
                  </tr>
                )}

                {/* Indicateur d'ajout en cours */}
                {visibleCount < lignes.length && (
                  <tr><td colSpan={5} style={{ padding: "8px 14px" }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: ac, animation: `bounce .8s ease ${i * 150}ms infinite` }}/>
                      ))}
                      <span style={{ fontSize: 10, color: "#9A8E82", marginLeft: 4 }}>Ajout en cours…</span>
                    </div>
                  </td></tr>
                )}
              </tbody>

              {/* Totaux */}
              {ht > 0 && visibleCount >= lignes.length && (
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${ac}` }}>
                    <td colSpan={3} style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#1A1612", fontFamily }}>Total HT</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 14, fontWeight: 800, color: ac, fontFamily, animation: "totalCount .4s ease both" }}>{fmt(ht)}</td>
                    <td/>
                  </tr>
                  {tvaRows.map(row => (
                    <tr key={row.rate} style={{ background: "#FAF7F2" }}>
                      <td colSpan={3} style={{ padding: "4px 14px", fontSize: 11, color: "#6B6358" }}>
                        TVA {row.rate.toString().replace(".", ",")}% <span style={{ color: "#cbd5e1", fontSize: 10 }}>(sur {fmt(row.base)})</span>
                      </td>
                      <td style={{ padding: "4px 14px", textAlign: "right", fontSize: 11, color: "#6B6358" }}>{fmt(row.montant)}</td>
                      <td/>
                    </tr>
                  ))}
                  <tr style={{ background: ac }}>
                    <td colSpan={3} style={{ padding: "8px 14px", fontSize: 13, fontWeight: 800, color: "white", fontFamily }}>Total TTC</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 15, fontWeight: 800, color: "white", fontFamily }}>{fmt(ttc)}</td>
                    <td/>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Boutons Enregistrer / Effacer */}
        {lignes.length > 0 && visibleCount >= lignes.length && (
          <div style={{ padding: "10px 14px", borderTop: "1px solid #F0EBE3", display: "flex", gap: 8, flexShrink: 0, animation: "fadeUp .3s ease both" }}>
            <button onClick={() => { try { localStorage.removeItem("zenbat_ia_draft"); } catch {} setLignes([]); setObjet(""); }}
              style={{ flex: 1, background: "none", border: "1px solid #E8E2D8", borderRadius: 10, padding: 9, fontSize: 12, color: "#6B6358", cursor: "pointer", fontWeight: 500 }}>
              {TX.clearQuote}
            </button>
            <button onClick={() => setPickingClient(true)}
              style={{ flex: 2, background: ac, color: "white", border: "none", borderRadius: 10, padding: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 3px 10px ${ac}55` }}>
              {TX.saveQuote}
            </button>
          </div>
        )}
      </div>

      {/* ═══ BAS : chat ══════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

        {/* Messages */}
        <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {historySummary && (
            <div title="L'IA utilise vos devis passés pour proposer des tarifs cohérents avec votre historique"
              style={{ alignSelf: "center", display: "flex", alignItems: "center", gap: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "4px 11px", fontSize: 10, fontWeight: 600, color: "#15803d", marginBottom: 4 }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Mémoire active · {historySummary.total} devis · {historySummary.topOuvrages.length} ouvrages référencés
            </div>
          )}
          {msgs.map((m, i) => {
            const fb = feedback[i] || {};
            const REASON_TAGS = ["Trop de questions", "Mauvais métier", "Prix incorrects", "Trop générique", "Hors sujet"];
            return (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
                  {m.role === "assistant" && (
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: ac + "22", border: `1px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: ac, fontSize: 12 }}>✦</div>
                  )}
                  <div style={{
                    maxWidth: "82%",
                    borderRadius: m.role === "user" ? "16px 16px 3px 16px" : "16px 16px 16px 3px",
                    padding: "9px 13px", fontSize: 12, lineHeight: 1.55,
                    background: m.role === "user" ? "#1A1612" : "white",
                    color: m.role === "user" ? "white" : "#2A231C",
                    boxShadow: m.role === "assistant" ? "0 1px 4px rgba(0,0,0,.07)" : "none",
                    border: m.role === "assistant" ? "1px solid #F0EBE3" : "none",
                  }}>
                    {m.content.split("\n").map((line, j, arr) => (
                      <span key={j}>{line.replace(/\*([^*]+)\*/g, "$1")}{j < arr.length - 1 && <br/>}</span>
                    ))}
                  </div>
                </div>

                {/* Barre de vote — uniquement sur les messages IA avec devis, hors chargement */}
                {m.hasDevis && !loading && (
                  <div style={{ paddingLeft: 30, marginTop: 4 }}>
                    {fb.saved ? (
                      <span style={{ fontSize: 11, color: fb.vote === 1 ? "#16a34a" : "#9A8E82" }}>
                        {fb.vote === 1 ? "✓ Merci !" : "✓ Noté"}
                      </span>
                    ) : fb.showReason ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 300 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {REASON_TAGS.map(tag => (
                            <button key={tag}
                              onClick={() => setFeedback(prev => ({ ...prev, [i]: { ...prev[i], reason: prev[i]?.reason === tag ? "" : tag } }))}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, border: `1px solid ${fb.reason === tag ? ac : "#e5e7eb"}`, background: fb.reason === tag ? ac + "18" : "white", color: fb.reason === tag ? ac : "#6B6358", cursor: "pointer", fontWeight: fb.reason === tag ? 700 : 400 }}>
                              {tag}
                            </button>
                          ))}
                        </div>
                        <input
                          placeholder="Autre raison… (optionnel)"
                          value={fb.customReason || ""}
                          onChange={e => setFeedback(prev => ({ ...prev, [i]: { ...prev[i], customReason: e.target.value } }))}
                          style={{ fontSize: 11, padding: "5px 8px", borderRadius: 8, border: "1px solid #e5e7eb", outline: "none" }}
                        />
                        <button
                          onClick={() => saveFeedback(i, -1, fb.customReason || fb.reason || null)}
                          style={{ alignSelf: "flex-start", fontSize: 11, padding: "4px 12px", borderRadius: 8, border: "none", background: "#ef4444", color: "white", cursor: "pointer", fontWeight: 600 }}>
                          Envoyer
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "#9A8E82" }}>Cette réponse était utile ?</span>
                        <button
                          onClick={() => { setFeedback(prev => ({ ...prev, [i]: { vote: 1 } })); saveFeedback(i, 1); }}
                          style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "2px 8px", fontSize: 13, cursor: "pointer" }}>
                          👍
                        </button>
                        <button
                          onClick={() => setFeedback(prev => ({ ...prev, [i]: { vote: -1, showReason: true } }))}
                          style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "2px 8px", fontSize: 13, cursor: "pointer" }}>
                          👎
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Puces de démarrage rapide — visibles uniquement sur le chat vierge.
              4 exemples typiques du métier, 1 clic = devis généré. Anti-page blanche
              pour les utilisateurs non-tech. */}
          {msgs.length === 1 && lignes.length === 0 && !loading && quickStarts.length > 0 && (
            <div style={{ alignSelf: "flex-start", marginLeft: 30, marginTop: 4, maxWidth: "88%", animation: "fadeUp .25s ease both" }}>
              <div style={{ fontSize: 11, color: ac, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 13 }}>✨</span>
                <span>Démarrage rapide — cliquez pour essayer</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {quickStarts.map((q) => (
                  <button key={q} onClick={() => send(q)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: `linear-gradient(135deg, ${ac}18, ${ac}08)`,
                      border: `1px solid ${ac}44`,
                      color: "#1A1612",
                      borderRadius: 12,
                      padding: "11px 14px",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      textAlign: "left",
                      lineHeight: 1.35,
                      width: "100%",
                      transition: "background .15s, transform .1s",
                    }}
                    onMouseOver={e => e.currentTarget.style.background = `linear-gradient(135deg, ${ac}28, ${ac}12)`}
                    onMouseOut={e => e.currentTarget.style.background = `linear-gradient(135deg, ${ac}18, ${ac}08)`}>
                    <div style={{ flex: 1, color: "#2A231C" }}>{q}</div>
                    <span style={{ color: ac, fontSize: 16, flexShrink: 0, fontWeight: 700 }}>→</span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#9A8E82", marginTop: 8, marginLeft: 4 }}>
                Ou décrivez votre besoin ci-dessous (écrit ou vocal).
              </div>
            </div>
          )}

          {loading && msgs[msgs.length - 1]?.role !== "assistant" && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: ac + "22", border: `1px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", color: ac, fontSize: 12 }}>✦</div>
              <div style={{ background: "white", border: "1px solid #F0EBE3", borderRadius: "16px 16px 16px 3px", padding: "10px 14px", display: "flex", gap: 4, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
                {[0, 140, 280].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: ac, animation: `bounce 1s ease ${d}ms infinite` }}/>)}
              </div>
            </div>
          )}
        </div>

        {/* Zone de saisie */}
        <div style={{ padding: "10px 14px 12px", background: "white", borderTop: "1px solid #F0EBE3", flexShrink: 0, position: "relative" }}>
          <style>{`
            @keyframes micPulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.55),0 6px 18px rgba(239,68,68,.45)}70%{box-shadow:0 0 0 16px rgba(239,68,68,0),0 6px 18px rgba(239,68,68,.45)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0),0 6px 18px rgba(239,68,68,.45)}}
            @keyframes micWave{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}
          `}</style>

          {/* Champ texte + envoyer */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "#FAF7F2", borderRadius: 14, border: `1.5px solid ${listening ? "#ef4444" : (input.trim() ? ac : "#E8E2D8")}`, padding: "8px 10px", transition: "border-color .2s" }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={listening ? "Écoute en cours…" : TX.inputPlaceholder}
              rows={1} style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 16, color: "#2A231C", resize: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}/>
            <button onClick={send} disabled={!input.trim() || loading}
              style={{ width: 34, height: 34, borderRadius: 10, background: input.trim() && !loading ? ac : "#d1fae5", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}>
              {I.send}
            </button>
          </div>

          {/* Sélecteur langue + bouton micro — layout compact horizontal */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8, position: "relative" }}>
            <button
              onClick={() => setLangMenu(v => !v)}
              style={{ background: "#F0EBE3", border: "1px solid #E8E2D8", borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 600, color: "#3D3028", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span>{currentLang.flag}</span>
              <span>{currentLang.label}</span>
              <span style={{ fontSize: 9, color: "#9A8E82" }}>▾</span>
            </button>

            <span style={{ fontSize: 11, color: listening ? "#ef4444" : "#6B6358", fontWeight: 500 }}>
              {listening ? "Parlez, je transcris…" : (micSupported ? "Appuyez pour dicter" : "Vocal indisponible")}
            </span>

            <button
              onClick={toggleMic}
              disabled={!micSupported}
              title={micSupported ? (listening ? "Appuyez pour arrêter" : "Appuyez pour parler") : "Non supporté par ce navigateur"}
              style={{
                width: 44, height: 44, borderRadius: "50%",
                background: listening ? "#ef4444" : (micSupported ? ac : "#cbd5e1"),
                border: "none", cursor: micSupported ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white",
                boxShadow: listening
                  ? "0 0 0 0 rgba(239,68,68,.55), 0 4px 12px rgba(239,68,68,.4)"
                  : `0 4px 12px ${ac}55`,
                transition: "background .2s, transform .15s",
                animation: listening ? "micPulse 1.4s ease-out infinite" : "none",
                flexShrink: 0,
              }}>
              {listening ? (
                <div style={{ display: "flex", gap: 2, alignItems: "center", height: 16 }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{ width: 2.5, height: 14, borderRadius: 2, background: "white", animation: `micWave .9s ease-in-out ${i * 0.12}s infinite` }}/>
                  ))}
                </div>
              ) : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z"/><path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z"/></svg>}
            </button>

            {langMenu && (
              <>
                <div onClick={() => setLangMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }}/>
                <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, background: "white", border: "1px solid #E8E2D8", borderRadius: 12, boxShadow: "0 10px 28px rgba(15,23,42,.18)", padding: 4, zIndex: 41, maxHeight: 260, overflowY: "auto", minWidth: 180 }}>
                  {SR_LANGS.map(l => (
                    <button key={l.code} onClick={() => pickLang(l.code)}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: l.code === micLang ? "#f0fdf4" : "none", border: "none", padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#1A1612", textAlign: "left" }}>
                      <span style={{ fontSize: 14 }}>{l.flag}</span>
                      <span style={{ fontWeight: l.code === micLang ? 700 : 500, flex: 1 }}>{l.label}</span>
                      {l.code === micLang && <span style={{ color: ac, fontSize: 12 }}>✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {micError && (
            <div style={{ fontSize: 11, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", padding: "5px 10px", borderRadius: 8, marginTop: 6, textAlign: "center" }}>
              {micError}
            </div>
          )}
        </div>
      </div>

      {pickingClient && (
        <ClientPickerModal
          clients={clients}
          ac={ac}
          fontFamily={fontFamily}
          onSaveClient={onSaveClient}
          onPick={finalizeSave}
          onClose={() => setPickingClient(false)}
        />
      )}

      {celebrate && (
        <CelebrateModal
          seconds={celebrateSecondsRef.current}
          fontFamily={fontFamily}
          ac={ac}
          onClose={() => setCelebrate(false)}
          onSave={() => { setCelebrate(false); setPickingClient(true); }}
        />
      )}

      {coherenceSettingsOpen && (
        <CoherenceSettings
          onClose={() => setCoherenceSettingsOpen(false)}
          onSave={s => { userSettingsRef.current = s; }}
        />
      )}
    </div>
  );
}
