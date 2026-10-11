import { useState, useRef, useEffect, useMemo } from "react";
import { CLAUDE_MODEL, TX } from "../lib/constants.js";
import { uid } from "../lib/utils.js";
import { tradesLabels } from "../lib/trades.js";
import { buildDevisHistorySummary } from "../lib/devisHistory.js";
import { supabase } from "../lib/supabase.js";
import { getToken } from "../lib/getToken.js";
import { useAuth } from "../lib/auth.jsx";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition.js";
import { useKeyboardInset } from "../hooks/useKeyboardInset.js";
import { ABOVE_NAV_CSS } from "./app/BottomNav.jsx";
import { buildAgentGreeting, quickStartsFor } from "../lib/agentIA/sectors.js";
import { buildSystemPrompt } from "../lib/agentIA/prompt.js";
import { buildPriceHints } from "../lib/coherence/priceHints.js";
import { processDevisFromRaw } from "../lib/agentIA/extractDevis.js";
import { streamClaude, requestClaude, visibleText, ClaudeApiError, getLastServedModel } from "../lib/agentIA/stream.js";
import { runCoherenceLoop } from "../lib/agentIA/coherenceLoop.js";
import { loadUserCoherenceSettings } from "../lib/coherence/userOverrides.js";
import ClientPickerModal from "./ClientPickerModal.jsx";
import CelebrateModal from "./agent/CelebrateModal.jsx";
import ChatThread from "./agent/ChatThread.jsx";
import Bordereau from "./agent/Bordereau.jsx";
import DictationBar from "./agent/DictationBar.jsx";
import { useModalGuard } from "../hooks/useModalGuard.js";
import { ZB } from "../lib/theme.js";
import { computeTotals, isNoTva } from "../lib/invoiceCalc.js";
import CoherenceSettings from "./CoherenceSettings.jsx";

// Clé localStorage du brouillon IA, scopée par user.id pour éviter qu'un
// brouillon abandonné par l'utilisateur A "fuite" vers l'utilisateur B sur
// un même navigateur (cas démo / poste partagé). Fallback "anon" si user.id
// non encore disponible. La clé legacy non-scopée est lue en migration
// douce à la première lecture et supprimée au premier save.
const LEGACY_IA_DRAFT_KEY = "zenbat_ia_draft";
function iaDraftKey(userId) { return `${LEGACY_IA_DRAFT_KEY}_${userId || "anon"}`; }
function readIaDraft(userId) {
  try {
    const scoped = localStorage.getItem(iaDraftKey(userId));
    if (scoped) return JSON.parse(scoped) || {};
    if (userId) {
      const legacy = localStorage.getItem(LEGACY_IA_DRAFT_KEY);
      if (legacy) return JSON.parse(legacy) || {};
    }
    return {};
  } catch { return {}; }
}

export default function AgentIA({ devis, onCreateDevis, clients, onSaveClient, plan, quotaReached, onPaywall, setTab, onOpenDevisPDF, brand }) {
  const { user } = useAuth();
  const userId = user?.id;
  const draftKey = useMemo(() => iaDraftKey(userId), [userId]);
  // Hauteur en px occupée par le clavier soft. 0 quand fermé. Utilisé
  // pour positionner la barre de saisie en `position: fixed` juste
  // au-dessus du clavier (modèle WhatsApp / Claude / Telegram).
  const keyboardInset = useKeyboardInset();

  const [msgs,         setMsgs]         = useState(() => [{ role: "assistant", content: buildAgentGreeting(brand), greeting: true }]);
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
    const d = readIaDraft(userId);
    return Array.isArray(d.lignes) ? d.lignes : [];
  });
  const [objet, setObjet] = useState(() => {
    const d = readIaDraft(userId);
    return typeof d.objet === "string" ? d.objet : "";
  });
  const [visibleCount, setVisibleCount] = useState(0);
  const [pickingClient, setPickingClient] = useState(false);
  // Suggestions cliquables adaptées au 1er secteur — anti-syndrome page blanche.
  // 4 exemples de devis typiques du métier pour démarrer en 1 clic.
  const [quickStarts] = useState(() => quickStartsFor(brand));
  // Flag one-shot : modale festive au tout premier devis du compte
  const [celebrate,    setCelebrate]    = useState(false);
  const celebrateStartRef = useRef(null);
  const celebrateSecondsRef = useRef(0);
  const [editingId,    setEditingId]    = useState(null);   // ligne ouverte en édition
  const [historyOpen,  setHistoryOpen]  = useState(false);
  useModalGuard(historyOpen, () => setHistoryOpen(false));
  const [coherenceSettingsOpen, setCoherenceSettingsOpen] = useState(false);
  const userSettingsRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef  = useRef(null);
  // Dernier texte saisi / dicté : lu par l'envoi automatique à l'arrêt du micro.
  const latestInputRef  = useRef("");
  const pendingSendRef  = useRef(false);
  // Mesure dynamique de la hauteur de la barre de saisie fixe pour
  // calculer le padding-bottom du ChatThread (= permet de scroller le
  // dernier message au-dessus de la barre).
  const inputAreaRef = useRef(null);
  // Verrou anti-double-clic sur la sauvegarde du devis (finalizeSave).
  const savingDevisRef = useRef(false);
  const [inputAreaHeight, setInputAreaHeight] = useState(140);
  useEffect(() => {
    if (!inputAreaRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setInputAreaHeight(e.contentRect.height);
    });
    ro.observe(inputAreaRef.current);
    return () => ro.disconnect();
  }, []);

  const {
    listening, connecting, micSupported, micError, currentLang,
    langMenu, setLangMenu,
    toggleMic, pickLang, stopAndClear,
    langs,
  } = useSpeechRecognition({ input, setInput });
  const micActive = listening || connecting;

  // Appui sur le micro : démarre la dictée ; second appui = arrêt ET envoi
  // (le dernier fragment transcrit peut arriver juste après l'arrêt).
  const onMicTap = () => {
    if (micActive) { pendingSendRef.current = true; toggleMic(); }
    else toggleMic();
  };
  useEffect(() => { latestInputRef.current = input; }, [input]);
  useEffect(() => {
    if (micActive || !pendingSendRef.current) return;
    const t = setTimeout(() => {
      pendingSendRef.current = false;
      if (latestInputRef.current.trim()) send(latestInputRef.current);
    }, 450);
    return () => clearTimeout(t);
  }, [micActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Résume l'historique pour contextualiser l'IA (recalculé quand devis change)
  const historySummary = useMemo(() => buildDevisHistorySummary(devis), [devis]);

  useEffect(() => {
    loadUserCoherenceSettings().then(s => { userSettingsRef.current = s; });
  }, []);

  // Pendant la rédaction, on suit les lignes qui s'inscrivent.
  useEffect(() => {
    if (!loading && visibleCount === 0) return;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [loading, visibleCount]);

  // Auto-grandit le textarea et suit la fin du texte (utile pendant la dictée)
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    ta.scrollTop = ta.scrollHeight;
    ta.scrollLeft = ta.scrollWidth;
  }, [input]);

  // Re-charge le brouillon quand l'identité change (cas logout → login
  // d'un autre compte sans démontage). Évite que B voie le brouillon de A.
  useEffect(() => {
    const d = readIaDraft(userId);
    setLignes(Array.isArray(d.lignes) ? d.lignes : []);
    setObjet(typeof d.objet === "string" ? d.objet : "");
  }, [userId]);

  useEffect(() => {
    try {
      if (!lignes.length && !objet) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify({ lignes, objet }));
      // Migration douce : on purge la clé legacy non-scopée dès qu'on a un user.id.
      if (userId) localStorage.removeItem(LEGACY_IA_DRAFT_KEY);
    } catch {}
  }, [lignes, objet, draftKey, userId]);

  useEffect(() => {
    if (!lignes.length) return;
    setVisibleCount(0);
    let i = 0;
    const iv = setInterval(() => { i++; setVisibleCount(i); if (i >= lignes.length) clearInterval(iv); }, 110);
    return () => clearInterval(iv);
  }, [lignes]);

  // Calcul commun (lib/invoiceCalc.js) : mêmes montants que le PDF et la facture.
  const { ht, tvaRows, ttc } = computeTotals(lignes, { noTva: isNoTva(brand?.vatRegime) });


  const send = async (overrideText) => {
    // overrideText est optionnel : il peut être une string fournie par la
    // puce « Essayer un exemple », ou ne pas être passé. Quand cette
    // fonction est branchée directement sur onClick={send}, React passe
    // un SyntheticEvent comme 1er argument → on ignore tout ce qui n'est
    // pas une string et on retombe sur la valeur du champ texte.
    const source = typeof overrideText === "string" ? overrideText : input;
    const payload = source.trim();
    if (!payload || loading) return;
    if (quotaReached) { onPaywall(); return; }

    // Chrono pour la modale festive "X secondes"
    celebrateStartRef.current = Date.now();

    const userMsg = { role: "user", content: payload };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);

    // Stoppe la dictée vocale en cours et purge le buffer d'accumulation
    // pour éviter qu'un futur démarrage ne ré-injecte l'ancien texte.
    stopAndClear();

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
      system: buildSystemPrompt({
        brand,
        historySummary,
        priceHints: buildPriceHints(
          newMsgs.filter(m => m.role === "user").map(m => m.content),
          userSettingsRef.current,
        ),
      }),
      messages: newMsgs.slice(-20).map(m => ({ role: m.role, content: m.content })),
    };

    const token = await getToken();
    const authHeaders = token ? { "Authorization": `Bearer ${token}` } : {};

    let raw = "";
    let apiError = null;

    try {
      try {
        raw = await streamClaude({
          body,
          authHeaders,
          onTextDelta: (_delta, accumulated) => {
            const visible = visibleText(accumulated);
            if (visible) updateAssistant(visible);
          },
        });
        if (!raw) throw new Error("stream-empty");
      } catch (streamErr) {
        // Fallback non-streamé uniquement si c'est une erreur réseau/SSE,
        // PAS si Anthropic a renvoyé une vraie erreur API (4xx/5xx).
        if (streamErr instanceof ClaudeApiError) {
          apiError = streamErr.message;
          throw streamErr;
        }
        console.warn("[AgentIA] streaming failed, falling back:", streamErr);
        // Trace admin : un flux coupé (message_stop absent) est le symptôme
        // d'une coupure upstream / Vercel / réseau mobile — on le journalise
        // même si le fallback ci-dessous réussit, pour pouvoir le diagnostiquer.
        if (streamErr?.partialRaw !== undefined) {
          const secs = streamErr.durationMs != null ? ` après ${(streamErr.durationMs / 1000).toFixed(1)}s` : "";
          supabase.from("ia_error_logs").insert({
            error:        `${streamErr.message}${secs} · ${streamErr.partialLen} car. reçus · fallback non-streamé tenté`,
            user_message: userMsg.content?.slice(0, 500) || null,
            history_len:  newMsgs.length,
            stream_tried: true,
          }).then(() => {}, () => {});
        }
        try {
          raw = await requestClaude({ body, authHeaders });
          const visible = visibleText(raw);
          if (visible) updateAssistant(visible);
        } catch (fallbackErr) {
          if (fallbackErr instanceof ClaudeApiError) apiError = fallbackErr.message;
          throw fallbackErr;
        }
      }

      const processed = processDevisFromRaw(raw, brand);
      const hasDevis  = !!processed;
      const txt       = visibleText(raw);

      let residualWarning = "";
      if (processed) {
        const { parsed, lignes: finalLignes } = processed;

        // ─── Moteur de cohérence : validation + boucle de correction ────────
        let resolvedLignes   = finalLignes;
        let resolvedObjet    = parsed.objet || "";
        let validationResult = { overall_status: "pass", checks: [], typology_id: null, iteration_count: 1 };
        try {
          const coherence = await runCoherenceLoop({
            devis:        { ...parsed, lignes: finalLignes },
            apiBody:      body,
            authHeaders,
            msgs:         newMsgs,
            rawResponse:  raw,
            brand,
            userSettings: userSettingsRef.current,
          });
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

        if (validationResult.residual_issues?.length > 0) {
          residualWarning = "\n\n⚠️ Devis vérifié automatiquement : des écarts de marché subsistent. Vous pouvez les ajuster manuellement.";
        }

        const missing = Array.isArray(parsed.champs_a_completer) ? parsed.champs_a_completer.filter(Boolean) : [];
        if (missing.length > 0) {
          residualWarning += "\n\n📋 À compléter :\n" + missing.map(m => `• ${m}`).join("\n");
        }

        const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.filter(Boolean) : [];
        if (suggestions.length > 0) {
          residualWarning += "\n\n💡 À envisager :\n" + suggestions.map(s => `• ${s}`).join("\n");
        }

        // Tout premier devis jamais généré sur ce compte :
        // on déclenche une modale festive si aucun devis n'existe encore en DB.
        if (devis.length === 0 && Array.isArray(resolvedLignes) && resolvedLignes.some(l => l.type_ligne === "ouvrage")) {
          const elapsed = celebrateStartRef.current
            ? Math.max(1, Math.round((Date.now() - celebrateStartRef.current) / 1000))
            : 0;
          celebrateSecondsRef.current = elapsed;
          setCelebrate(true);
        }
      }

      const finalText = (txt || (hasDevis ? TX.linesAdded : "Je n'ai pas compris, pouvez-vous reformuler ?")) + residualWarning;
      updateAssistant(finalText, hasDevis);

      // Détection best-effort des interactions "négatives" pour analyse admin.
      // - Refus IA : pas de <DEVIS> émis + vocabulaire de refus dans la réponse.
      // - Utilisateur mécontent : marqueurs de frustration dans le message.
      // Refus "dur" uniquement (pas les questions polies du flux soft hors-périmètre).
      const refusalRe  = /ne r[ée]alis(ons|e|ent) pas|ne fais(ons|ent)? pas|ne propos(ons|e|ent) pas|ne traitons pas|pas (notre|de) sp[ée]cialit[ée]/i;
      const negUserRe  = /\b(nul|nulle|pourri|pourrie|merdique|d[ée]bile|stupide|inutile|ne sert à rien|marche pas|fonctionne pas|ne comprend[s]? rien|ça bug|bug[ué]|ça beug|arrête de|n'importe quoi|t'es mauvais|mauvaise r[ée]ponse)\b/i;
      const isRefusal     = !hasDevis && refusalRe.test(finalText);
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
        had_devis:    hasDevis,
        trade_names:  tradesLabels(brand?.trades || []).slice(0, 3).join(", ") || null,
        model:        getLastServedModel() || CLAUDE_MODEL,
      }).then(
        ({ error: dbErr }) => { if (dbErr) console.warn("[conv log/db]", dbErr.message); },
        (netErr)           => { console.warn("[conv log/net]", netErr?.message || netErr); },
      );

      // Incrémente le compteur d'usage IA (best-effort, silencieux)
      supabase.rpc("increment_ai_used").then(() => {}, () => {});
    } catch (e) {
      // Enrichit le message avec la durée (timeout vs blip réseau) et le
      // nombre de tentatives — attaché par fetchWithNetworkRetry sur les
      // erreurs TypeError / AbortError.
      const meta = e?.durationMs != null
        ? ` (après ${(e.durationMs / 1000).toFixed(1)}s · ${e.attempts || 1} tentative${(e.attempts || 1) > 1 ? "s" : ""})`
        : "";
      const detail = (apiError || e.message || "unknown") + meta;
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
      } else if (apiError?.includes("journalière")) {
        msg = apiError; // limite quotidienne interne (ex: "Limite journalière atteinte (40 appels/jour)")
      } else if (apiError?.includes("Période d'essai")) {
        msg = apiError;
      } else if (/rate.?limit|tokens per minute|too many requests/i.test(apiError || "") || apiError?.includes("429")) {
        msg = "L'assistant est très sollicité, réessayez dans quelques secondes.";
      } else if (apiError?.includes("55 secondes") || apiError?.includes("504")) {
        msg = "La demande a pris trop de temps. Réessayez avec une description plus courte.";
      } else if (apiError?.includes("529") || apiError?.includes("overloaded") || apiError?.includes("Upstream")) {
        msg = "Les serveurs IA sont surchargés en ce moment. Réessayez dans 30 secondes.";
      } else {
        msg = e instanceof ClaudeApiError ? TX.errApi : TX.errGeneral;
      }
      updateAssistant(msg);
      setMsgs(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], error: true };
        return next;
      });
    }
    setLoading(false);
  };

  const deleteLigne = id => setLignes(l => l.filter(x => x.id !== id));

  const updateLigne = (id, patch) =>
    setLignes(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));

  const addLigne = () => {
    const l = { id: uid(), type_ligne: "ouvrage", designation: "Nouvelle prestation", unite: "u", quantite: 1, prix_unitaire: 0, tva_rate: brand.vatRegime === "franchise" ? 0 : 20 };
    setLignes(prev => [...prev, l]);
    setEditingId(l.id);
  };

  const finalizeSave = async (clientId) => {
    // Garde anti-double-clic : si une sauvegarde est déjà en cours, on
    // ignore le 2e appel — sinon le user qui clique deux fois sur le
    // bouton final de ClientPickerModal pendant la latence réseau crée
    // deux devis et consomme deux slots de son quota freemium.
    if (savingDevisRef.current) return;
    savingDevisRef.current = true;
    try {
    const picked  = clientId ? clients.find(c => c.id === clientId) : null;
    const newId   = uid();
    const ok = await onCreateDevis({
      id: newId,
      numero: `DEV-${new Date().getFullYear()}-${String(devis.length + 1).padStart(4, "0")}`,
      objet: objet || "Devis IA",
      client_id: clientId || null,
      ville_chantier: picked?.ville || "",
      statut: "brouillon",
      montant_ht: ht,
      tva_rate: 20,
      date_emission: new Date().toISOString().split("T")[0],
      lignes,
    });
    setPickingClient(false);
    if (!ok) return;
    try { localStorage.removeItem(draftKey); } catch {}
    setLignes([]); setObjet("");
    setMsgs([{ role: "assistant", content: TX.quoteSaved }]);
    // Ouvre directement la vue PDF du devis fraîchement enregistré.
    // Fallback : redirige rapidement vers la liste (800 ms — le temps que
    // le message de confirmation s'affiche, sans figer l'écran 2.5 s).
    if (onOpenDevisPDF) onOpenDevisPDF(newId);
    else setTimeout(() => setTab("devis"), 800);
    } finally {
      savingDevisRef.current = false;
    }
  };

  // Note de l'IA : sa dernière réponse, sauf le message d'accueil (l'écran
  // vierge du bordereau le remplace).
  const lastMsg = msgs[msgs.length - 1];
  const note = lastMsg?.role === "assistant" && !lastMsg.greeting ? lastMsg : null;
  const noteIdx = msgs.length - 1;
  const onVote = (vote) => {
    if (vote === 1) { setFeedback(prev => ({ ...prev, [noteIdx]: { vote: 1 } })); saveFeedback(noteIdx, 1); }
    else { setFeedback(prev => ({ ...prev, [noteIdx]: { vote: -1, showReason: true } })); setHistoryOpen(true); }
  };
  const clearDevis = () => { try { localStorage.removeItem(draftKey); } catch {} setLignes([]); setObjet(""); setEditingId(null); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: ZB.paper, fontFamily: ZB.font, color: ZB.ink }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: `12px 12px ${inputAreaHeight + keyboardInset + 16}px` }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <Bordereau
            brand={brand}
            objet={objet}
            onObjetChange={setObjet}
            lignes={lignes}
            visibleCount={visibleCount}
            editingId={editingId}
            setEditingId={setEditingId}
            onLineChange={updateLigne}
            onLineDelete={deleteLigne}
            onAddLine={addLigne}
            ht={ht}
            tvaRows={tvaRows}
            ttc={ttc}
            loading={loading}
            quickStarts={quickStarts}
            onExample={send}
            onSave={() => setPickingClient(true)}
            onClear={clearDevis}
            onOpenCoherence={() => setCoherenceSettingsOpen(true)}
            historySummary={historySummary}
          />
        </div>
      </div>

      <DictationBar
        ref={inputAreaRef}
        bottom={keyboardInset > 0 ? `${keyboardInset}px` : ABOVE_NAV_CSS}
        inputRef={inputRef}
        input={input}
        setInput={setInput}
        onSend={() => send()}
        loading={loading}
        micActive={micActive}
        listening={listening}
        connecting={connecting}
        micSupported={micSupported}
        micError={micError}
        onMicTap={onMicTap}
        currentLang={currentLang}
        langs={langs}
        langMenu={langMenu}
        setLangMenu={setLangMenu}
        pickLang={pickLang}
        note={note}
        feedback={feedback[noteIdx]}
        onVote={onVote}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      {historyOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="zb-history-title"
          style={{ position: "fixed", inset: 0, zIndex: 70, background: ZB.paper, display: "flex", flexDirection: "column", fontFamily: ZB.font }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "calc(10px + env(safe-area-inset-top, 0px)) 14px 10px", borderBottom: `1px solid ${ZB.rule}`, background: ZB.sheet }}>
            <h2 id="zb-history-title" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Échanges avec Zenbat</h2>
            <button type="button" onClick={() => setHistoryOpen(false)}
              style={{ minHeight: 44, padding: "0 14px", borderRadius: 8, border: `1px solid ${ZB.rule}`, background: ZB.sheet, color: ZB.ink, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Fermer
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 16px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
              <ChatThread msgs={msgs} feedback={feedback} setFeedback={setFeedback} saveFeedback={saveFeedback} loading={loading}/>
            </div>
          </div>
        </div>
      )}

      {pickingClient && (
        <ClientPickerModal
          clients={clients}
          ac={ZB.accent}
          fontFamily={ZB.font}
          onSaveClient={onSaveClient}
          onPick={finalizeSave}
          onClose={() => setPickingClient(false)}
        />
      )}

      {celebrate && (
        <CelebrateModal
          seconds={celebrateSecondsRef.current}
          fontFamily={ZB.font}
          ac={ZB.accent}
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
