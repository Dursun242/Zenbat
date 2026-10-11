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
import { TVA_RATES } from "../../lib/constants.js";
import { ZB, NUM } from "../../lib/theme.js";
import { computeTotals, isNoTva, lineTotal } from "../../lib/invoiceCalc.js";

const fmtQty = q => (q == null ? "—" : String(q).replace(".", ","));
const fmtRate = r => String(r).replace(".", ",");

// Découpe les lignes en sections de lot (les ouvrages avant le 1er lot vont
// dans une section sans titre). Le sous-total est calculé sur TOUTES les
// lignes du lot, pas seulement celles déjà inscrites à l'écran.
// Sans lignes « titre de lot », on regroupe d'après le champ `lot` de chaque
// ouvrage (format que l'IA renvoie aussi).
function sectionsOf(lignes, visibleCount) {
  const sections = [];
  const hasLotRows = lignes.some(l => l.type_ligne === "lot");
  let current = null;
  lignes.forEach((l, idx) => {
    if (l.type_ligne === "lot") {
      current = { lot: l, rows: [], subtotal: 0, at: idx };
      sections.push(current);
      return;
    }
    if (!hasLotRows && l.lot && current?.lot?.designation !== l.lot) {
      current = { lot: { id: `lot-${l.lot}-${idx}`, designation: l.lot }, rows: [], subtotal: 0, at: idx };
      sections.push(current);
    }
    if (!current) { current = { lot: null, rows: [], subtotal: 0, at: idx }; sections.push(current); }
    // Le sous-total du lot monte au fil des lignes inscrites.
    if (idx < visibleCount) current.subtotal += lineTotal(l);
    current.rows.push({ l, idx });
  });
  return sections
    .map(s => ({ ...s, rows: s.rows.filter(r => r.idx < visibleCount) }))
    .filter(s => (s.lot && s.at < visibleCount) || s.rows.length);
}

const ICON = {
  cog: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>,
  arrow: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  book: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/></svg>,
};

const fieldStyle = {
  width: "100%", minHeight: 44, padding: "10px 12px", boxSizing: "border-box",
  border: `1px solid ${ZB.rule}`, borderRadius: 8, background: ZB.sheet,
  fontFamily: "inherit", fontSize: 16, color: ZB.ink, outline: "none",
};
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: ZB.ink2, marginBottom: 6 };

function LineEditor({ l, franchise, onChange, onDelete, onDone }) {
  const [d, setD] = useState({
    designation: l.designation || "",
    quantite: l.quantite ?? "",
    unite: l.unite || "",
    prix_unitaire: l.prix_unitaire ?? "",
  });
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  const commit = () => {
    onChange({
      designation: d.designation.trim() || l.designation,
      quantite: d.quantite === "" ? null : (parseFloat(String(d.quantite).replace(",", ".")) || 0),
      unite: d.unite.trim() || l.unite,
      prix_unitaire: d.prix_unitaire === "" ? null : (parseFloat(String(d.prix_unitaire).replace(",", ".")) || 0),
    });
    onDone();
  };
  const rate = Number(l.tva_rate ?? (franchise ? 0 : 20));
  return (
    <div className="zb-line-editor" style={{ padding: "14px 0 16px", borderBottom: `1px solid ${ZB.rule}`, display: "grid", gap: 12 }}
      onKeyDown={e => { if (e.key === "Escape") onDone(); }}>
      <div>
        <label style={labelStyle} htmlFor={`d-${l.id}`}>Désignation</label>
        <textarea id={`d-${l.id}`} ref={firstRef} rows={2} value={d.designation}
          onChange={e => setD({ ...d, designation: e.target.value })}
          style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.4 }}/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 1.2fr", gap: 8 }}>
        <div>
          <label style={labelStyle} htmlFor={`q-${l.id}`}>Quantité</label>
          <input id={`q-${l.id}`} inputMode="decimal" value={d.quantite}
            onChange={e => setD({ ...d, quantite: e.target.value })}
            style={{ ...fieldStyle, textAlign: "right", ...NUM }}/>
        </div>
        <div>
          <label style={labelStyle} htmlFor={`u-${l.id}`}>Unité</label>
          <input id={`u-${l.id}`} value={d.unite}
            onChange={e => setD({ ...d, unite: e.target.value })}
            style={fieldStyle}/>
        </div>
        <div>
          <label style={labelStyle} htmlFor={`p-${l.id}`}>Prix unitaire HT</label>
          <input id={`p-${l.id}`} inputMode="decimal" value={d.prix_unitaire}
            onChange={e => setD({ ...d, prix_unitaire: e.target.value })}
            style={{ ...fieldStyle, textAlign: "right", ...NUM }}/>
        </div>
      </div>
      <div>
        <span style={labelStyle} id={`t-${l.id}`}>TVA</span>
        {franchise ? (
          <div style={{ fontSize: 14, color: ZB.ink2 }}>Pas de TVA : franchise en base (art. 293 B du CGI).</div>
        ) : (
          <div role="radiogroup" aria-labelledby={`t-${l.id}`} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TVA_RATES.map(r => {
              const on = Number(r) === rate;
              return (
                <button key={r} type="button" role="radio" aria-checked={on}
                  onClick={() => onChange({ tva_rate: r })}
                  style={{ minHeight: 44, minWidth: 56, padding: "0 10px", borderRadius: 8, cursor: "pointer",
                    border: `1px solid ${on ? ZB.accent : ZB.rule}`, background: on ? ZB.accentSoft : ZB.sheet,
                    color: on ? ZB.accent : ZB.ink, fontFamily: "inherit", fontSize: 15, fontWeight: on ? 700 : 500, ...NUM }}>
                  {fmtRate(r)} %
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={onDelete}
          style={{ minHeight: 44, padding: "0 4px", background: "none", border: "none", color: ZB.danger, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          Supprimer la ligne
        </button>
        <button type="button" onClick={commit}
          style={{ minHeight: 44, padding: "0 22px", borderRadius: 8, border: "none", background: ZB.ink, color: ZB.paper, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Terminé
        </button>
      </div>
    </div>
  );
}

function Line({ l, idx, franchise, onOpen }) {
  const total = (l.quantite != null && l.prix_unitaire != null) ? l.quantite * l.prix_unitaire : null;
  const rate = Number(l.tva_rate ?? (franchise ? 0 : 20));
  const incomplete = l.quantite == null || l.prix_unitaire == null;
  return (
    <button type="button" className="zb-line" onClick={onOpen}
      aria-label={`Modifier : ${l.designation}`}
      style={{ "--i": idx, display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 16px", width: "100%", textAlign: "left",
        padding: "12px 0", minHeight: 56, background: "none", border: "none", borderBottom: `1px solid ${ZB.ruleSoft}`,
        cursor: "pointer", fontFamily: "inherit", color: ZB.ink }}>
      <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{l.designation}</span>
      <span style={{ fontSize: 15, fontWeight: 600, textAlign: "right", color: total == null ? ZB.warn : ZB.ink, ...NUM }}>
        {total != null ? fmt(total) : "à chiffrer"}
      </span>
      <span style={{ fontSize: 13, color: incomplete ? ZB.warn : ZB.ink2, ...NUM }}>
        {fmtQty(l.quantite)} {l.unite || ""} × {l.prix_unitaire != null ? fmt(l.prix_unitaire) : "prix à compléter"}
        {!franchise && <span style={{ color: ZB.ink3 }}> · TVA {fmtRate(rate)} %</span>}
      </span>
    </button>
  );
}

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
        .zb-line:focus-visible, .zb-bordereau button:focus-visible, .zb-bordereau input:focus-visible, .zb-bordereau textarea:focus-visible {
          outline: 2px solid ${ZB.accent}; outline-offset: 2px; border-radius: 4px;
        }
        .zb-bordereau input:focus, .zb-bordereau textarea:focus { border-color: ${ZB.accent} !important; }
        .zb-bordereau input::placeholder, .zb-bordereau textarea::placeholder { color: ${ZB.ink3}; opacity: 1; }
        @media (hover: hover) { .zb-line:hover { background: ${ZB.paper} !important; } }
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
        placeholder={empty ? "Objet du devis" : "Ajoute un objet"}
        style={{ display: "block", width: "100%", margin: "16px 0 0", padding: "4px 0", border: "none", resize: "none", overflow: "hidden",
          background: "none", fontFamily: "inherit", fontSize: 21, fontWeight: 700, lineHeight: 1.25, color: ZB.ink, outline: "none" }}/>
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
              {s.lot && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline", padding: "16px 0 6px", borderBottom: `1px solid ${ZB.rule}` }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: ZB.ink }}>{s.lot.designation}</h3>
                  <span style={{ fontSize: 15, fontWeight: 700, color: ZB.ink, ...NUM }}>{fmt(s.subtotal)}</span>
                </div>
              )}
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
      {done && ht > 0 && (
        <div style={{ marginTop: 8, borderTop: `2px solid ${ZB.ink}`, paddingTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 15, ...NUM }}>
            <span>Total HT</span><span style={{ fontWeight: 600 }}>{fmt(ht)}</span>
          </div>
          {tvaRows.map(r => (
            <div key={r.rate} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14, color: ZB.ink2, ...NUM }}>
              <span>{franchise ? "TVA non applicable (art. 293 B)" : `TVA ${fmtRate(r.rate)} % sur ${fmt(r.base)}`}</span>
              <span>{fmt(r.montant)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingBottom: 8, borderBottom: `3px double ${ZB.ink}` }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Total TTC</span>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em", ...NUM }}>{fmt(ttc)}</span>
          </div>
        </div>
      )}

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
