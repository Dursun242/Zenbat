// Bordereau de l'Agent IA : le devis en cours EST l'écran.
//
// - Vierge : en-tête de l'entreprise, page réglée, trois exemples du métier.
// - Rédaction : les lignes s'inscrivent une à une (signature du système
//   « Bordereau »), le sous-total de chaque lot se met à jour dans la marge.
// - Rempli : appui sur une ligne = édition (désignation, quantité, unité,
//   prix, TVA, suppression) avec des champs à la taille du doigt.
//
// Présentationnel : tout l'état vit dans AgentIA.
import { useEffect, useRef, useState } from "react";
import { fmt } from "../../lib/utils.js";
import { ZB, NUM } from "../../lib/theme.js";
import { computeTotals, isNoTva } from "../../lib/invoiceCalc.js";
import { sectionsOf, LineEditor, Line, LotHeading, Totals, BORDEREAU_CSS, ICON as PARTS_ICON } from "../bordereau/parts.jsx";

const ICON = {
  plus: PARTS_ICON.plus,
  cog: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
  arrow: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  book: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/></svg>,
};

const WRITING_STEPS = [
  "Je lis ta demande…",
  "Je cherche dans tes prestations habituelles…",
  "Je calcule les quantités et les prix…",
  "Je mets le devis en forme…",
  "Je vérifie la cohérence des lignes…",
  "Encore quelques secondes…",
];

function WritingRows() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, WRITING_STEPS.length - 1)), 2800);
    return () => clearInterval(t);
  }, []);
  return (
    <div aria-live="polite" style={{ padding: "0 0 4px" }}>
      {/* Lignes vierges du bordereau ; la première reçoit le trait de plume. */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: "flex", alignItems: "flex-end", height: 48, borderBottom: `1px ${i ? "dotted" : "solid"} ${ZB.rule}` }}>
          {i === 0 && <span className="zb-pen-line" aria-hidden="true"/>}
        </div>
      ))}
      <div style={{ fontSize: 14, color: ZB.ink2, paddingTop: 12 }}>{WRITING_STEPS[step]}</div>
    </div>
  );
}

export default function Bordereau({
  brand, objet, onObjetChange, lignes, visibleCount, editingId, setEditingId,
  onLineChange, onLineDelete, onAddLine, ht, tvaRows, ttc, loading,
  quickStarts, onExample, onSave, onClear, onOpenCoherence, historySummary,
}) {
  const franchise = brand?.vatRegime === "franchise";
  const empty = lignes.length === 0;
  const done = !empty && visibleCount >= lignes.length;
  const ouvrages = lignes.filter(l => l.type_ligne === "ouvrage").length;
  const [confirmClear, setConfirmClear] = useState(false);
  // L'objet passe à la ligne au lieu d'être coupé.
  const objetRef = useRef(null);
  useEffect(() => {
    const el = objetRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [objet]);
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmClear]);
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const sections = sectionsOf(lignes, visibleCount);
  // Pendant la rédaction, le total des lignes déjà inscrites reste visible
  // en bas de l'écran (le bloc des totaux n'apparaît qu'à la fin).
  const writing = !empty && (!done || loading);
  const running = writing ? computeTotals(lignes.slice(0, visibleCount), { noTva: isNoTva(brand?.vatRegime) }) : null;
  const shownCount = writing ? lignes.slice(0, visibleCount).filter(l => l.type_ligne === "ouvrage").length : ouvrages;
  const shownHt = writing ? running.ht : ht;

  return (
    <article className="zb-bordereau" aria-label="Devis en cours"
      style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "18px 18px 20px", color: ZB.ink }}>
      <style>{`
        ${BORDEREAU_CSS}
        @keyframes zbInscribe { from { opacity: 0; clip-path: inset(0 100% 0 0); } to { opacity: 1; clip-path: inset(0 0 0 0); } }
        .zb-line { animation: zbInscribe .32s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes zbWrite { 0% { transform: scaleX(.05); } 70%, 100% { transform: scaleX(1); } }
        .zb-pen-line { display: block; width: 58%; height: 2px; margin-bottom: 14px; background: ${ZB.ink3}; transform-origin: left; animation: zbWrite 1.8s cubic-bezier(.2,.7,.2,1) infinite; }
        @media (prefers-reduced-motion: reduce) { .zb-line, .zb-pen-line { animation: none; } }
      `}</style>

      {/* En-tête du document */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          {brand?.logo
            ? <img src={brand.logo} alt={brand.companyName || "Logo"} style={{ display: "block", height: 28, maxWidth: 140, objectFit: "contain" }}/>
            : <div style={{ fontSize: 15, fontWeight: 700 }}>{brand?.companyName || "Ton entreprise"}</div>}
          <div style={{ fontSize: 13, color: ZB.ink2, marginTop: 4 }}>Devis · {today}</div>
        </div>
        <button type="button" onClick={onOpenCoherence} aria-label="Réglages de la vérification des prix"
          style={{ width: 44, height: 44, flexShrink: 0, display: "grid", placeItems: "center", background: "none", border: `1px solid ${ZB.rule}`, borderRadius: 8, color: ZB.ink2, cursor: "pointer" }}>
          {ICON.cog}
        </button>
      </header>

      <label htmlFor="zb-objet" className="zb-sr">Objet du devis</label>
      <textarea id="zb-objet" ref={objetRef} rows={1} value={objet} onChange={e => onObjetChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
        placeholder={empty ? "Objet du devis" : "Ajoute un objet"} className="zb-focus-ring"
        style={{ display: "block", width: "100%", margin: "16px 0 0", padding: "4px 0", border: "none", resize: "none", overflow: "hidden",
          background: "none", fontFamily: "inherit", fontSize: 21, fontWeight: 700, lineHeight: 1.25, color: ZB.ink }}/>
      {!empty && (
        <div style={{ fontSize: 13, color: ZB.ink2, marginTop: 4, ...NUM }}>
          {shownCount} ligne{shownCount > 1 ? "s" : ""}{shownHt > 0 ? ` · ${fmt(shownHt)} HT` : ""}
        </div>
      )}

      {/* Colonnes */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, paddingBottom: 8, borderBottom: `2px solid ${ZB.ink}`, fontSize: 13, fontWeight: 600, color: ZB.ink2 }}>
        <span>Désignation</span><span>Montant HT</span>
      </div>

      {/* Corps */}
      {empty && !loading && (
        <div>
          <p style={{ margin: "16px 0 8px", fontSize: 15, color: ZB.ink2, lineHeight: 1.45 }}>
            Dicte ou écris tes travaux : les lignes s'inscrivent ici, chiffrées, par lot. Pour essayer, touche un exemple :
          </p>
          <div role="list">
            {quickStarts.slice(0, 3).map(ex => (
              <button key={ex} type="button" role="listitem" onClick={() => onExample(ex)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", minHeight: 52,
                  padding: "12px 0", background: "none", border: "none", borderBottom: `1px solid ${ZB.ruleSoft}`, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 16, fontWeight: 500, color: ZB.ink, textAlign: "left" }}>
                <span>{ex}</span><span style={{ color: ZB.accent, flexShrink: 0 }}>{ICON.arrow}</span>
              </button>
            ))}
          </div>
          <div aria-hidden="true" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14,
            paddingTop: 10, paddingBottom: 8, borderTop: `2px solid ${ZB.ink}`, borderBottom: `3px double ${ZB.ink}`, color: ZB.ink3, ...NUM }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Total TTC</span>
            <span style={{ fontSize: 22, fontWeight: 700 }}>0,00 €</span>
          </div>
          {historySummary && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, color: ZB.ink2 }}>
              <span style={{ color: ZB.stamp, display: "inline-flex" }}>{ICON.book}</span>
              {historySummary.total > 1
                ? `Zenbat s'appuie sur tes ${historySummary.total} devis pour proposer tes prix habituels.`
                : "Zenbat s'appuie sur ton premier devis pour proposer tes prix habituels."}
            </div>
          )}
        </div>
      )}

      {empty && loading && <WritingRows/>}

      {!empty && (
        <div>
          {sections.map((s, si) => (
            <section key={s.lot?.id || `s${si}`} aria-label={s.lot?.designation || "Prestations"}>
              {s.lot && <LotHeading lot={s.lot} subtotal={s.subtotal}/>}
              {s.rows.map(({ l, idx }) => editingId === l.id ? (
                <LineEditor key={l.id} l={l} franchise={franchise}
                  onChange={patch => onLineChange(l.id, patch)}
                  onDelete={() => { onLineDelete(l.id); setEditingId(null); }}
                  onDone={() => setEditingId(null)}/>
              ) : (
                <Line key={l.id} l={l} idx={idx} franchise={franchise} onOpen={() => setEditingId(l.id)}/>
              ))}
            </section>
          ))}
          {loading && <WritingRows/>}
          {done && !loading && (
            <button type="button" onClick={onAddLine}
              style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "10px 0", background: "none", border: "none",
                color: ZB.accent, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              {ICON.plus} Ajouter une ligne
            </button>
          )}
        </div>
      )}

      {writing && (
        <div style={{ position: "sticky", bottom: 0, zIndex: 1, margin: "0 -18px", padding: "12px 18px",
          display: "flex", justifyContent: "space-between", alignItems: "baseline", background: ZB.sheet, borderTop: `2px solid ${ZB.ink}` }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{franchise ? "Total" : "Total TTC"} <span style={{ fontWeight: 500, color: ZB.ink2 }}>en cours</span></span>
          <span style={{ fontSize: 22, fontWeight: 700, ...NUM }}>{fmt(running.ttc)}</span>
        </div>
      )}

      {/* Totaux */}
      {done && ht > 0 && <Totals ht={ht} tvaRows={tvaRows} ttc={ttc} franchise={franchise}/>}

      {/* Actions */}
      {done && !loading && (
        <div style={{ marginTop: 18, display: "grid", gap: 6 }}>
          <button type="button" onClick={onSave} className="zb-primary"
            style={{ minHeight: 52, borderRadius: 10, border: "none", background: ZB.accent, color: "#fff", fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Enregistrer le devis
          </button>
          <button type="button"
            onClick={() => { if (confirmClear) { setConfirmClear(false); onClear(); } else setConfirmClear(true); }}
            style={{ minHeight: 44, background: "none", border: "none", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer",
              color: confirmClear ? ZB.danger : ZB.ink2 }}>
            {confirmClear ? "Appuie encore pour tout effacer" : "Tout effacer"}
          </button>
        </div>
      )}
    </article>
  );
}
