import { useState, useEffect, useMemo, useRef } from "react";
import { useModalGuard } from "../../hooks/useModalGuard.js";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import { ZB } from "../../lib/theme.js";

const CSS = `
  .zb-picker input:focus { border-color: ${ZB.accent} !important; }
  .zb-picker input::placeholder { color: ${ZB.ink3}; opacity: 1; }
  .zb-picker button:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: -2px; }
  @media (hover: hover) { .zb-picker-row:not([aria-current="true"]):hover { background: ${ZB.paper2} !important; } }
`;

const CheckIcon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>;

function clientLabel(c) {
  return c?.raison_sociale || `${c?.prenom || ""} ${c?.nom || ""}`.trim() || "—";
}

export default function ClientPickerModal({ clients = [], current, onSelect, onClose, requireEmail = false }) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 180);
  const inputRef  = useRef(null);

  // Échap géré par useModalGuard (seule la fenêtre la plus haute réagit).
  useModalGuard(true, onClose);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Filtre memoizé sur la valeur debounced : la liste ne se recalcule pas
  // à chaque frappe (visible côté UX comme un lag sur les comptes ayant
  // beaucoup de clients).
  const filtered = useMemo(() => {
    if (debouncedQ.trim().length === 0) return clients;
    const s = debouncedQ.toLowerCase();
    return clients.filter(c =>
      clientLabel(c).toLowerCase().includes(s)
      || (c.email      || "").toLowerCase().includes(s)
      || (c.telephone  || "").toLowerCase().includes(s)
      || (c.ville      || "").toLowerCase().includes(s)
    );
  }, [clients, debouncedQ]);

  const rowStyle = {
    width: "100%", minHeight: 56, padding: "10px 18px", border: "none", borderBottom: `1px solid ${ZB.ruleSoft}`,
    cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit", color: ZB.ink,
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(26,22,18,.55)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: ZB.font, color: ZB.ink }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{CSS}</style>
      <div role="dialog" aria-modal="true" aria-labelledby="client-picker-title" className="zb-picker"
        style={{ background: ZB.paper, borderRadius: "10px 10px 0 0", width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "6px 6px 12px 18px", borderBottom: `1px solid ${ZB.rule}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h2 id="client-picker-title" style={{ margin: 0, fontWeight: 700, fontSize: 19, color: ZB.ink }}>Choisir un client</h2>
            <button type="button" onClick={onClose} aria-label="Fermer"
              style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: "none", color: ZB.ink2, cursor: "pointer" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
          <div style={{ paddingRight: 12 }}>
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Rechercher…"
              aria-label="Rechercher un client"
              style={{ width: "100%", minHeight: 44, boxSizing: "border-box", background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "10px 12px", fontSize: 16, outline: "none", fontFamily: "inherit", color: ZB.ink }}
            />
          </div>
        </div>

        {/* Liste */}
        <div style={{ overflowY: "auto", flex: 1, background: ZB.sheet }}>
          {requireEmail && (
            <div style={{ margin: "12px 14px 4px", background: ZB.paper2, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ZB.ink, marginBottom: 2 }}>Email requis</div>
              <div style={{ fontSize: 14, color: ZB.ink2, lineHeight: 1.4 }}>Choisis un client avec une adresse email pour la signature électronique.</div>
            </div>
          )}
          {/* Option "sans client" */}
          <button
            type="button"
            className="zb-picker-row"
            aria-current={!current ? "true" : undefined}
            onClick={() => { onSelect(null); onClose(); }}
            style={{ ...rowStyle, background: current ? "none" : ZB.accentSoft }}>
            <span style={{ flex: 1, fontSize: 15, color: ZB.ink2, fontStyle: "italic" }}>Sans client</span>
            {!current && <span style={{ color: ZB.accent, display: "flex" }}>{CheckIcon}</span>}
          </button>

          {filtered.length === 0 && debouncedQ.trim() && (
            <div style={{ padding: "20px 18px", fontSize: 15, color: ZB.ink2, textAlign: "center" }}>
              Aucun client trouvé pour « {debouncedQ} »
            </div>
          )}

          {filtered.map(c => {
            const isCurrent  = c.id === current?.id;
            const label      = clientLabel(c);
            const sub        = c.email || c.telephone || c.ville || "";
            const noEmail    = requireEmail && !c.email;
            return (
              <button key={c.id}
                type="button"
                className="zb-picker-row"
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => { onSelect(c); onClose(); }}
                style={{ ...rowStyle, background: isCurrent ? ZB.accentSoft : "none", opacity: noEmail ? 0.65 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: ZB.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
                  {sub && <div style={{ fontSize: 13, color: ZB.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
                  {noEmail && <span style={{ display: "inline-block", fontSize: 12, fontWeight: 600, color: ZB.ink2, border: `1px solid ${ZB.rule}`, borderRadius: 3, padding: "0 5px", marginTop: 4 }}>sans email</span>}
                </div>
                {isCurrent && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: ZB.accent, fontWeight: 700, flexShrink: 0 }}>{CheckIcon}actuel</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
