import { useState, useRef, useEffect, useMemo } from "react";
import { CLAUDE_MODEL, TX } from "../lib/constants.js";
import { fmt, uid } from "../lib/utils.js";
import { tradesLabels } from "../lib/trades.js";
import { buildDevisHistorySummary, formatHistoryPrompt } from "../lib/devisHistory.js";
import { I } from "./ui/icons.jsx";
import ClientPickerModal from "./ClientPickerModal.jsx";

export default function AgentIA({ devis, onCreateDevis, clients, onSaveClient, plan, trialExpired, onPaywall, setTab, brand }) {
  const [msgs,         setMsgs]         = useState([{ role: "assistant", content: TX.agentGreeting }]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [lignes,       setLignes]       = useState([]);
  const [objet,        setObjet]        = useState("");
  const [visibleCount, setVisibleCount] = useState(0);
  const [pickingClient, setPickingClient] = useState(false);
  const chatRef  = useRef(null);
  const inputRef = useRef(null);

  const ac         = brand.color || "#22c55e";
  const fontFamily = brand.fontStyle === "elegant" ? "Playfair Display" : brand.fontStyle === "tech" ? "Space Grotesk" : "DM Sans";

  // Résume l'historique pour contextualiser l'IA (recalculé quand devis change)
  const historySummary = useMemo(() => buildDevisHistorySummary(devis), [devis]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

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

  const buildSystemPrompt = () => {
    const tradeNames = tradesLabels(brand.trades);
    const tradesBlock = tradeNames.length
      ? `\n\nSPÉCIALISATION DE L'ENTREPRISE — RÈGLE ABSOLUE :
L'entreprise est spécialisée UNIQUEMENT dans les métiers suivants : ${tradeNames.join(", ")}.
- Tu génères UNIQUEMENT des devis pour ces métiers.
- Si la demande sort de ce périmètre, tu REFUSES poliment et tu ne renvoies AUCUNE balise <DEVIS>. Tu réponds : "Désolé, ${brand.companyName || "l'entreprise"} ne réalise pas ce type de travaux. Nous sommes spécialisés en : ${tradeNames.join(", ")}."
- Pour les demandes mixtes, tu génères uniquement les lignes qui correspondent à tes métiers et tu signales en une phrase ce qui n'a pas été inclus.`
      : "";

    const historyBlock = formatHistoryPrompt(historySummary);

    return `Tu es un assistant expert BTP France intégré dans l'application Zenbat.${tradesBlock}

LANGUE — RÈGLE ABSOLUE :
1. Tu comprends TOUTES les langues : français, arabe littéraire, darija marocaine, kabyle, espagnol, portugais, anglais, roumain, polonais, turc, wolof, bambara, tamoul, ourdou, hindi, chinois, russe, ukrainien, italien, allemand, etc.
2. Tu réponds TOUJOURS en français professionnel, 100% du temps, SANS EXCEPTION.
3. Tu TRADUIS systématiquement en français toutes les prestations décrites, quel que soit la langue d'entrée.
4. Le JSON (objet, lots, désignations, unités) est TOUJOURS rédigé en français normé du bâtiment.

TÂCHE : L'utilisateur décrit des travaux à devisser. TOUJOURS répondre avec un JSON entre <DEVIS></DEVIS> même si c'est une seule ligne.
Si l'utilisateur donne un prix unitaire explicite, utilise-le EXACTEMENT.

Format strict : {"objet":"titre court en français","lignes":[
  {"type_ligne":"lot","designation":"NOM DU LOT EN FRANÇAIS"},
  {"type_ligne":"ouvrage","lot":"nom lot","designation":"description en français","unite":"m2|ml|u|m3|fg|ens","quantite":10,"prix_unitaire":25,"tva_rate":20}
]}

TVA : applique le taux correct par ouvrage selon la réglementation française :
- 5.5% : travaux d'amélioration de la qualité énergétique (isolation thermique, pompe à chaleur, fenêtres isolantes dans logement >2 ans).
- 10% : travaux d'entretien/rénovation/amélioration dans logement d'habitation achevé depuis plus de 2 ans.
- 20% : neuf, gros œuvre, démolition/évacuation, locaux professionnels, fournitures sans pose.

Règles : prix réalistes BTP France 2025, groupe par lots, désignations professionnelles en français.
Si besoin de précision, pose UNE seule question courte EN FRANÇAIS, et génère quand même un JSON partiel.${historyBlock}`;
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    if (trialExpired) { onPaywall(); return; }

    const userMsg = { role: "user", content: input };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs); setInput(""); setLoading(true);

    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 4000,
          system: buildSystemPrompt(),
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error("api");

      const data = await res.json();
      const raw  = data.content?.[0]?.text || "";
      const match = raw.match(/<DEVIS>([\s\S]*?)<\/DEVIS>/) || raw.match(/<DEVIS>([\s\S]+)/);
      const txt   = raw.replace(/<DEVIS>[\s\S]*/g, "").trim();

      if (match) {
        try {
          const parsed    = JSON.parse(match[1].trim());
          const newLignes = (parsed.lignes || []).map(l => ({ ...l, id: uid() }));
          if (parsed.objet && !objet) setObjet(parsed.objet);
          setLignes(prev => {
            const existingDesigs = new Set(prev.map(l => l.designation));
            return [...prev, ...newLignes.filter(l => !existingDesigs.has(l.designation))];
          });
        } catch { /* JSON mal formé — on ignore */ }
      }
      setMsgs(m => [...m, { role: "assistant", content: txt || (match ? TX.linesAdded : "Je n'ai pas compris, pouvez-vous reformuler ?") }]);
    } catch (e) {
      const msg = !navigator.onLine ? TX.errNetwork : e.message === "api" ? TX.errApi : TX.errGeneral;
      setMsgs(m => [...m, { role: "assistant", content: "❌ " + msg }]);
    }
    setLoading(false);
  };

  const deleteLigne = id => setLignes(l => l.filter(x => x.id !== id));

  const finalizeSave = (clientId) => {
    const ht2    = lignes.filter(l => l.type_ligne === "ouvrage").reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0);
    const picked = clientId ? clients.find(c => c.id === clientId) : null;
    onCreateDevis({
      id: uid(),
      numero: `DEV-2026-${String(devis.length + 1).padStart(4, "0")}`,
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
    setLignes([]); setObjet("");
    setMsgs([{ role: "assistant", content: TX.quoteSaved }]);
    setTimeout(() => setTab("devis"), 2500);
  };

  const visibleLignes = lignes.slice(0, visibleCount);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
      <style>{`
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-14px) scale(.97)}to{opacity:1;transform:translateX(0) scale(1)}}
        @keyframes rowPop{0%{opacity:0;transform:translateY(6px) scaleY(.85)}100%{opacity:1;transform:translateY(0) scaleY(1)}}
        @keyframes totalCount{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
      `}</style>

      {/* ═══ HAUT : aperçu devis en cours ═══════════════════ */}
      <div style={{ flexShrink: 0, background: "white", borderBottom: "2px solid #f1f5f9", minHeight: 110, maxHeight: "45%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* En-tête branding */}
        <div style={{ background: ac, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {brand.logo
              ? <img src={brand.logo} alt="" style={{ height: 32, maxWidth: 100, objectFit: "contain" }}/>
              : <span style={{ fontFamily, fontWeight: 800, fontSize: 15, color: "white" }}>{brand.companyName || "Votre entreprise"}</span>
            }
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily, color: "rgba(255,255,255,.6)", fontSize: 9, letterSpacing: "1.5px", fontWeight: 600 }}>{TX.quoteInProgress.toUpperCase()}</div>
            <div style={{ fontFamily, color: "white", fontWeight: 800, fontSize: 18, marginTop: 2, animation: "totalCount .3s ease both" }}>
              {fmt(ht)} <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(255,255,255,.7)", marginLeft: 4 }}>HT</span>
            </div>
          </div>
        </div>

        {/* Objet du devis */}
        {objet && (
          <div style={{ background: "#0f172a", padding: "6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily, color: "rgba(255,255,255,.9)", fontSize: 12, fontWeight: 600 }}>{objet}</span>
            <span style={{ color: "#64748b", fontSize: 10 }}>{lignes.filter(l => l.type_ligne === "ouvrage").length} ligne{lignes.filter(l => l.type_ligne === "ouvrage").length > 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Tableau des lignes */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {visibleLignes.length === 0 ? (
            <div style={{ padding: "20px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Les lignes du devis apparaîtront ici</div>
              <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>Décrivez les travaux ci-dessous</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "white", zIndex: 1 }}>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <th style={{ textAlign: "left",  padding: "6px 14px", fontSize: 9, fontWeight: 600, color: "#94a3b8", letterSpacing: "1px" }}>DÉSIGNATION</th>
                  <th style={{ textAlign: "right", padding: "6px 8px",  fontSize: 9, fontWeight: 600, color: "#94a3b8", width: 50 }}>QTÉ</th>
                  <th style={{ textAlign: "right", padding: "6px 8px",  fontSize: 9, fontWeight: 600, color: "#94a3b8", width: 65 }}>P.U. HT</th>
                  <th style={{ textAlign: "right", padding: "6px 14px", fontSize: 9, fontWeight: 600, color: "#94a3b8", width: 75 }}>TOTAL HT</th>
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
                  const total = (l.quantite || 0) * (l.prix_unitaire || 0);
                  return (
                    <tr key={l.id} style={{ borderBottom: "1px solid #f8fafc", animation: "rowPop .3s cubic-bezier(.34,1.3,.64,1) both", animationDelay: `${idx * 0.06}s` }}>
                      <td style={{ padding: "8px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", fontFamily }}>{l.designation}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{l.unite}</span>
                          <button
                            onClick={() => {
                              const cycle = [20, 10, 5.5];
                              const cur   = Number(l.tva_rate ?? 20);
                              const next  = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
                              setLignes(prev => prev.map(x => x.id === l.id ? { ...x, tva_rate: next } : x));
                            }}
                            title="Cliquer pour changer le taux de TVA"
                            style={{ background: "#eef2f7", color: "#475569", border: "none", borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 600, cursor: "pointer" }}>
                            TVA {(l.tva_rate ?? 20).toString().replace(".", ",")}%
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: "8px", textAlign: "right", fontSize: 12, color: "#374151", fontWeight: 600 }}>{l.quantite}</td>
                      <td style={{ padding: "8px", textAlign: "right", fontSize: 11, color: "#64748b" }}>{fmt(l.prix_unitaire)}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{fmt(total)}</td>
                      <td style={{ padding: "4px" }}>
                        <button onClick={() => deleteLigne(l.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#e2e8f0", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}
                          onMouseOver={e => e.target.style.color = "#ef4444"}
                          onMouseOut={e => e.target.style.color = "#e2e8f0"}>×</button>
                      </td>
                    </tr>
                  );
                })}

                {/* Indicateur d'ajout en cours */}
                {visibleCount < lignes.length && (
                  <tr><td colSpan={5} style={{ padding: "8px 14px" }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: ac, animation: `bounce .8s ease ${i * 150}ms infinite` }}/>
                      ))}
                      <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 4 }}>Ajout en cours…</span>
                    </div>
                  </td></tr>
                )}
              </tbody>

              {/* Totaux */}
              {ht > 0 && visibleCount >= lignes.length && (
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${ac}` }}>
                    <td colSpan={3} style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#0f172a", fontFamily }}>Total HT</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 14, fontWeight: 800, color: ac, fontFamily, animation: "totalCount .4s ease both" }}>{fmt(ht)}</td>
                    <td/>
                  </tr>
                  {tvaRows.map(row => (
                    <tr key={row.rate} style={{ background: "#f8fafc" }}>
                      <td colSpan={3} style={{ padding: "4px 14px", fontSize: 11, color: "#64748b" }}>
                        TVA {row.rate.toString().replace(".", ",")}% <span style={{ color: "#cbd5e1", fontSize: 10 }}>(sur {fmt(row.base)})</span>
                      </td>
                      <td style={{ padding: "4px 14px", textAlign: "right", fontSize: 11, color: "#64748b" }}>{fmt(row.montant)}</td>
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
          <div style={{ padding: "10px 14px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 8, flexShrink: 0, animation: "fadeUp .3s ease both" }}>
            <button onClick={() => { setLignes([]); setObjet(""); }}
              style={{ flex: 1, background: "none", border: "1px solid #e2e8f0", borderRadius: 10, padding: 9, fontSize: 12, color: "#64748b", cursor: "pointer", fontWeight: 500 }}>
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
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
              {m.role === "assistant" && (
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: ac + "22", border: `1px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: ac, fontSize: 12 }}>✦</div>
              )}
              <div style={{
                maxWidth: "82%",
                borderRadius: m.role === "user" ? "16px 16px 3px 16px" : "16px 16px 16px 3px",
                padding: "9px 13px", fontSize: 12, lineHeight: 1.55,
                background: m.role === "user" ? "#0f172a" : "white",
                color: m.role === "user" ? "white" : "#1e293b",
                boxShadow: m.role === "assistant" ? "0 1px 4px rgba(0,0,0,.07)" : "none",
                border: m.role === "assistant" ? "1px solid #f1f5f9" : "none",
              }}>
                {m.content.split("\n").map((line, j, arr) => (
                  <span key={j}>{line.replace(/\*([^*]+)\*/g, "$1")}{j < arr.length - 1 && <br/>}</span>
                ))}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: ac + "22", border: `1px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", color: ac, fontSize: 12 }}>✦</div>
              <div style={{ background: "white", border: "1px solid #f1f5f9", borderRadius: "16px 16px 16px 3px", padding: "10px 14px", display: "flex", gap: 4, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
                {[0, 140, 280].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: ac, animation: `bounce 1s ease ${d}ms infinite` }}/>)}
              </div>
            </div>
          )}
        </div>

        {/* Zone de saisie */}
        <div style={{ padding: "10px 14px 12px", background: "white", borderTop: "1px solid #f1f5f9", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "#f8fafc", borderRadius: 14, border: `1.5px solid ${input.trim() ? ac : "#e2e8f0"}`, padding: "8px 10px", transition: "border-color .2s" }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={TX.inputPlaceholder}
              rows={1} style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 16, color: "#1e293b", resize: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 80, overflow: "auto" }}/>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button title="Micro" style={{ width: 30, height: 30, borderRadius: 9, background: "#f1f5f9", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>🎙</button>
              <button onClick={send} disabled={!input.trim() || loading}
                style={{ width: 30, height: 30, borderRadius: 9, background: input.trim() && !loading ? ac : "#d1fae5", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: "pointer", transition: "background .2s" }}>
                {I.send}
              </button>
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 9, color: "#cbd5e1", marginTop: 6 }}>{TX.inputHint}</div>
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
    </div>
  );
}
