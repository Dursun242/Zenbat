// Pièces communes du « bordereau » (système de design Bordereau, cf. DESIGN.md) :
// utilisées par l'écran Agent IA (agent/Bordereau.jsx) et la fiche devis
// (DevisDetail.jsx) pour qu'un devis ait partout la même allure.
//
// - sectionsOf : découpe les lignes en sections de lot (sous-total en marge)
// - Line       : une ligne lisible, appui = édition
// - LineEditor : édition d'une ligne avec des champs à la taille du doigt
// - LotEditor  : renommer / déplacer / supprimer un titre de lot
// - Totals     : Total HT, TVA ventilée, Total TTC souligné d'un double trait
import { useEffect, useRef, useState } from "react";
import { fmt } from "../../lib/utils.js";
import { TVA_RATES, UNITES } from "../../lib/constants.js";
import { ZB, NUM } from "../../lib/theme.js";
import { lineTotal } from "../../lib/invoiceCalc.js";

export const fmtQty = q => (q == null ? "—" : String(q).replace(".", ","));
export const fmtRate = r => String(r).replace(".", ",");

// Les ouvrages avant le 1er lot vont dans une section sans titre. Sans
// lignes « titre de lot », on regroupe d'après le champ `lot` de chaque
// ouvrage (format que l'IA renvoie aussi). Seules les lignes déjà inscrites
// (idx < visibleCount) comptent dans le sous-total.
export function sectionsOf(lignes, visibleCount = Infinity) {
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
      current = { lot: { id: `lot-${l.lot}-${idx}`, designation: l.lot, virtual: true }, rows: [], subtotal: 0, at: idx };
      sections.push(current);
    }
    if (!current) { current = { lot: null, rows: [], subtotal: 0, at: idx }; sections.push(current); }
    if (idx < visibleCount) current.subtotal += lineTotal(l);
    current.rows.push({ l, idx });
  });
  return sections
    .map(s => ({ ...s, rows: s.rows.filter(r => r.idx < visibleCount) }))
    .filter(s => (s.lot && s.at < visibleCount) || s.rows.length);
}

export const ICON = {
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>,
  up: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>,
  down: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>,
};

export const fieldStyle = {
  width: "100%", minHeight: 44, padding: "10px 12px", boxSizing: "border-box",
  border: `1px solid ${ZB.rule}`, borderRadius: 8, background: ZB.sheet,
  fontFamily: "inherit", fontSize: 16, color: ZB.ink, outline: "none",
};
export const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: ZB.ink2, marginBottom: 6 };

const smallBtn = {
  minWidth: 44, minHeight: 44, display: "inline-grid", placeItems: "center", padding: "0 8px",
  borderRadius: 8, border: `1px solid ${ZB.rule}`, background: ZB.sheet, color: ZB.ink,
  fontFamily: "inherit", fontSize: 15, cursor: "pointer",
};

const toNum = v => (v === "" || v == null ? null : (parseFloat(String(v).replace(",", ".")) || 0));

// Calculateur « pourcentage d'un montant » (honoraires = X % du marché) :
// remplit la ligne en forfait au bon total.
function PercentHelper({ onApply }) {
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState("");
  const [pct, setPct] = useState("");
  const result = Math.round((toNum(base) || 0) * (toNum(pct) || 0)) / 100;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{ justifySelf: "start", minHeight: 44, padding: 0, background: "none", border: "none", color: ZB.accent, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
        Calculer un pourcentage d'un montant
      </button>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 88px", gap: 8, padding: 12, background: ZB.paper, border: `1px solid ${ZB.rule}`, borderRadius: 8 }}>
      <div>
        <label style={labelStyle}>Montant de référence (€)
          <input inputMode="decimal" value={base} onChange={e => setBase(e.target.value)} placeholder="400 000"
            style={{ ...fieldStyle, marginTop: 6, textAlign: "right", ...NUM }}/>
        </label>
      </div>
      <div>
        <label style={labelStyle}>%
          <input inputMode="decimal" value={pct} onChange={e => setPct(e.target.value)} placeholder="1"
            style={{ ...fieldStyle, marginTop: 6, textAlign: "right", ...NUM }}/>
        </label>
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <button type="button" onClick={() => setOpen(false)}
          style={{ minHeight: 44, padding: 0, background: "none", border: "none", color: ZB.ink2, fontFamily: "inherit", fontSize: 15, cursor: "pointer" }}>
          Fermer
        </button>
        <button type="button" disabled={!result} onClick={() => { onApply(result); setOpen(false); setBase(""); setPct(""); }}
          style={{ ...smallBtn, padding: "0 14px", fontWeight: 700, opacity: result ? 1 : 0.5, cursor: result ? "pointer" : "default", ...NUM }}>
          Appliquer {fmt(result)} en forfait
        </button>
      </div>
    </div>
  );
}

// Édition d'une ligne. Les champs texte sont validés par « Terminé » ;
// la TVA s'applique tout de suite.
// Options : withLot (champ lot, pour les devis sans titres de lot),
// withPercent (calculateur %), onMove (monter / descendre).
export function LineEditor({ l, franchise, onChange, onDelete, onDone, withLot = false, withPercent = false, onMove, canUp, canDown }) {
  const [d, setD] = useState({
    designation: l.designation || "",
    quantite: l.quantite ?? "",
    unite: l.unite || "",
    prix_unitaire: l.prix_unitaire ?? "",
    lot: l.lot || "",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);
  const patch = () => ({
    designation: d.designation.trim() || l.designation || "",
    quantite: toNum(d.quantite),
    unite: d.unite.trim() || l.unite || "u",
    prix_unitaire: toNum(d.prix_unitaire),
    ...(withLot ? { lot: d.lot.trim() } : {}),
  });
  const commit = () => { onChange(patch()); onDone(); };
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
      {withLot && (
        <div>
          <label style={labelStyle} htmlFor={`l-${l.id}`}>Lot</label>
          <input id={`l-${l.id}`} value={d.lot} placeholder="Par exemple : Plomberie"
            onChange={e => setD({ ...d, lot: e.target.value })} style={fieldStyle}/>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 1.2fr", gap: 8 }}>
        <div>
          <label style={labelStyle} htmlFor={`q-${l.id}`}>Quantité</label>
          <input id={`q-${l.id}`} inputMode="decimal" value={d.quantite}
            onChange={e => setD({ ...d, quantite: e.target.value })}
            style={{ ...fieldStyle, textAlign: "right", ...NUM }}/>
        </div>
        <div>
          <label style={labelStyle} htmlFor={`u-${l.id}`}>Unité</label>
          <input id={`u-${l.id}`} value={d.unite} list="zb-unites"
            onChange={e => setD({ ...d, unite: e.target.value })}
            style={fieldStyle}/>
          <datalist id="zb-unites">{UNITES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</datalist>
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
      {withPercent && (
        <PercentHelper onApply={amount => { onChange({ ...patch(), quantite: 1, unite: "forfait", prix_unitaire: amount }); setD({ ...d, quantite: 1, unite: "forfait", prix_unitaire: amount }); }}/>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          style={{ minHeight: 44, padding: "0 4px", background: "none", border: "none", color: ZB.danger, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          {confirmDelete ? "Appuie encore pour supprimer" : "Supprimer la ligne"}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {onMove && (
            <>
              <button type="button" aria-label="Monter la ligne" disabled={!canUp} onClick={() => { onChange(patch()); onMove(-1); }}
                style={{ ...smallBtn, opacity: canUp ? 1 : 0.4, cursor: canUp ? "pointer" : "default" }}>{ICON.up}</button>
              <button type="button" aria-label="Descendre la ligne" disabled={!canDown} onClick={() => { onChange(patch()); onMove(1); }}
                style={{ ...smallBtn, opacity: canDown ? 1 : 0.4, cursor: canDown ? "pointer" : "default" }}>{ICON.down}</button>
            </>
          )}
          <button type="button" onClick={commit}
            style={{ minHeight: 44, padding: "0 22px", borderRadius: 8, border: "none", background: ZB.ink, color: ZB.paper, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Terminé
          </button>
        </div>
      </div>
    </div>
  );
}

// Titre de lot : renommer, déplacer, supprimer (les lignes du lot restent).
export function LotEditor({ lot, onChange, onDelete, onDone, onMove, canUp, canDown }) {
  const [name, setName] = useState(lot.designation || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const commit = () => { onChange({ designation: name.trim().toUpperCase() || lot.designation }); onDone(); };
  return (
    <div style={{ padding: "12px 0 14px", borderBottom: `1px solid ${ZB.rule}`, display: "grid", gap: 12 }}
      onKeyDown={e => { if (e.key === "Escape") onDone(); if (e.key === "Enter") commit(); }}>
      <div>
        <label style={labelStyle} htmlFor={`lot-${lot.id}`}>Nom du lot</label>
        <input id={`lot-${lot.id}`} autoFocus value={name} onChange={e => setName(e.target.value)}
          style={{ ...fieldStyle, textTransform: "uppercase", fontWeight: 700, letterSpacing: ".04em" }}/>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          style={{ minHeight: 44, padding: "0 4px", background: "none", border: "none", color: ZB.danger, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          {confirmDelete ? "Appuie encore : les lignes restent" : "Supprimer le titre"}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" aria-label="Monter le lot" disabled={!canUp} onClick={() => onMove(-1)}
            style={{ ...smallBtn, opacity: canUp ? 1 : 0.4 }}>{ICON.up}</button>
          <button type="button" aria-label="Descendre le lot" disabled={!canDown} onClick={() => onMove(1)}
            style={{ ...smallBtn, opacity: canDown ? 1 : 0.4 }}>{ICON.down}</button>
          <button type="button" onClick={commit}
            style={{ minHeight: 44, padding: "0 22px", borderRadius: 8, border: "none", background: ZB.ink, color: ZB.paper, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Terminé
          </button>
        </div>
      </div>
    </div>
  );
}

// Une ligne du bordereau. Sans onOpen, elle est en lecture seule.
export function Line({ l, idx, franchise, onOpen }) {
  const incomplete = l.quantite == null || l.prix_unitaire == null;
  const total = incomplete ? null : lineTotal(l);
  const rate = Number(l.tva_rate ?? (franchise ? 0 : 20));
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag type={onOpen ? "button" : undefined} className={onOpen ? "zb-line" : undefined} onClick={onOpen}
      aria-label={onOpen ? `Modifier : ${l.designation}` : undefined}
      style={{ "--i": idx, display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 16px", width: "100%", textAlign: "left",
        padding: "12px 0", minHeight: 56, boxSizing: "border-box", background: "none", border: "none", borderBottom: `1px solid ${ZB.ruleSoft}`,
        cursor: onOpen ? "pointer" : "default", fontFamily: "inherit", color: ZB.ink }}>
      <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35, overflowWrap: "anywhere" }}>{l.designation || <span style={{ color: ZB.ink3 }}>Sans désignation</span>}</span>
      <span style={{ fontSize: 15, fontWeight: 600, textAlign: "right", color: total == null ? ZB.warn : ZB.ink, ...NUM }}>
        {total != null ? fmt(total) : "à chiffrer"}
      </span>
      <span style={{ fontSize: 13, color: incomplete ? ZB.warn : ZB.ink2, ...NUM }}>
        {fmtQty(l.quantite)} {l.unite || ""} × {l.prix_unitaire != null ? fmt(l.prix_unitaire) : "prix à compléter"}
        {!franchise && <span style={{ color: ZB.ink3 }}> · TVA {fmtRate(rate)} %</span>}
      </span>
    </Tag>
  );
}

// Titre de lot avec son sous-total dans la marge. Avec onOpen, le nom se
// modifie d'un appui (bouton dans le titre, pour garder un vrai titre).
export function LotHeading({ lot, subtotal, onOpen }) {
  const text = { fontSize: 14, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: ZB.ink };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline", padding: onOpen ? "6px 0 0" : "16px 0 6px", borderBottom: `1px solid ${ZB.rule}` }}>
      <h3 style={{ margin: 0, flex: 1, minWidth: 0, ...text }}>
        {onOpen ? (
          <button type="button" className="zb-line" onClick={onOpen} aria-label={`Modifier le lot ${lot.designation}`}
            style={{ display: "block", width: "100%", minHeight: 44, padding: "10px 0 6px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", ...text }}>
            {lot.designation}
          </button>
        ) : lot.designation}
      </h3>
      <span style={{ fontSize: 15, fontWeight: 700, color: ZB.ink, ...NUM }}>{fmt(subtotal)}</span>
    </div>
  );
}

export function Totals({ ht, tvaRows, ttc, franchise, autoLiquidation = false }) {
  return (
    <div style={{ marginTop: 8, borderTop: `2px solid ${ZB.ink}`, paddingTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 15, ...NUM }}>
        <span>Total HT</span><span style={{ fontWeight: 600 }}>{fmt(ht)}</span>
      </div>
      {tvaRows.map(r => (
        <div key={r.rate} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14, color: ZB.ink2, ...NUM }}>
          <span>{franchise ? "TVA non applicable (art. 293 B)" : autoLiquidation ? "Autoliquidation : TVA due par le preneur" : `TVA ${fmtRate(r.rate)} % sur ${fmt(r.base)}`}</span>
          <span>{fmt(r.montant)}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingBottom: 8, borderBottom: `3px double ${ZB.ink}` }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Total TTC</span>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em", ...NUM }}>{fmt(ttc)}</span>
      </div>
    </div>
  );
}

// Styles partagés (focus, survol, inscription des lignes).
export const BORDEREAU_CSS = `
  .zb-line:focus-visible, .zb-bordereau button:focus-visible, .zb-bordereau input:focus-visible, .zb-bordereau textarea:focus-visible {
    outline: 2px solid ${ZB.accent}; outline-offset: 2px; border-radius: 4px;
  }
  .zb-bordereau input:focus, .zb-bordereau textarea:focus { border-color: ${ZB.accent} !important; }
  .zb-bordereau input::placeholder, .zb-bordereau textarea::placeholder { color: ${ZB.ink3}; opacity: 1; }
  @media (hover: hover) { .zb-line:hover { background: ${ZB.paper} !important; } }
`;
