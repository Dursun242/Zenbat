// Pièces des listes (Devis, Factures, Clients) dans le système « Bordereau » :
// un registre tracé sur une feuille, des filtres en onglets soulignés, un
// menu « ⋯ » par ligne pour les actions rares.
import { useEffect, useState } from "react";
import { ZB, NUM } from "../../lib/theme.js";

export const LIST_CSS = `
  .zb-row:focus-visible, .zb-tab:focus-visible, .zb-list button:focus-visible, .zb-list input:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; }
  @media (hover: hover) { .zb-row:hover { background: ${ZB.paper} !important; } }
  .zb-list input::placeholder { color: ${ZB.ink3}; opacity: 1; }
  .zb-tabs { scrollbar-width: none; } .zb-tabs::-webkit-scrollbar { display: none; }
  @keyframes zbSkel { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  .zb-skel { animation: zbSkel 1.4s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .zb-skel { animation: none; } }
`;

export const btnPrimary = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, padding: "0 18px",
  borderRadius: 10, border: "none", background: ZB.accent, color: ZB.sheet, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer",
};
export const btnSecondary = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, padding: "0 16px",
  borderRadius: 10, border: `1px solid ${ZB.rule}`, background: ZB.sheet, color: ZB.ink, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer",
};

export function ProTag() {
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", padding: "1px 5px", borderRadius: 3, border: "1px solid currentColor" }}>PRO</span>;
}

// En-tête de liste : compteur à gauche, action principale à droite.
export function ListHeader({ count, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
      <p style={{ margin: 0, fontSize: 15, color: ZB.ink2, ...NUM }}>{count}</p>
      {children && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>}
    </div>
  );
}

// Filtres en onglets soulignés (même repère que la barre de navigation).
export function FilterTabs({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="zb-tabs"
      style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 12, borderBottom: `1px solid ${ZB.rule}` }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={on} className="zb-tab" onClick={() => onChange(o.value)}
            style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 10px",
              background: "none", border: "none", borderBottom: `2px solid ${on ? ZB.accent : "transparent"}`, marginBottom: -1,
              fontFamily: "inherit", fontSize: 15, fontWeight: on ? 700 : 500, color: on ? ZB.ink : ZB.ink2, cursor: "pointer", whiteSpace: "nowrap" }}>
            {o.label}
            {o.count > 0 && (
              <span style={{ minWidth: 20, padding: "0 6px", borderRadius: 10, background: ZB.accent, color: ZB.sheet, fontSize: 12, fontWeight: 700, lineHeight: "20px", textAlign: "center", ...NUM }}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// La feuille qui porte les lignes.
export function Sheet({ children }) {
  return <div style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, overflow: "visible" }}>{children}</div>;
}

export function EmptyRow({ children }) {
  return <p style={{ margin: 0, padding: "24px 16px", textAlign: "center", fontSize: 15, color: ZB.ink2, lineHeight: 1.45 }}>{children}</p>;
}

// Chargement de la liste : lignes squelettes discrètes (pas de « 0 devis »
// ni d'état vide tant que les données ne sont pas arrivées).
export function LoadingRows({ label = "Chargement…", rows = 3 }) {
  const bar = (w, h) => <span className="zb-skel" style={{ display: "block", width: w, height: h, borderRadius: 4, background: ZB.paper2 }}/>;
  return (
    <div role="status" aria-live="polite">
      <span className="zb-sr">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px 12px", alignItems: "center", minHeight: 64, padding: "14px 16px",
          borderBottom: i < rows - 1 ? `1px solid ${ZB.ruleSoft}` : "none" }}>
          {bar(`${[62, 48, 55][i % 3]}%`, 14)}
          {bar(72, 14)}
          <span style={{ gridColumn: "1 / -1" }}>{bar(`${[38, 30, 44][i % 3]}%`, 11)}</span>
        </div>
      ))}
    </div>
  );
}

// Échec du chargement : message clair et « Réessayer » (action secondaire,
// la terre cuite reste à l'action principale de l'écran).
export function LoadErrorRow({ message, onRetry }) {
  return (
    <div role="alert" style={{ padding: "20px 16px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: ZB.ink, lineHeight: 1.45 }}>{message}</p>
      <p style={{ margin: "4px 0 14px", fontSize: 14, color: ZB.ink2, lineHeight: 1.45 }}>Vérifie ta connexion, puis réessaie.</p>
      {onRetry && <button type="button" style={btnSecondary} onClick={onRetry}>Réessayer</button>}
    </div>
  );
}

const MoreIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>;

// Menu « ⋯ » d'une ligne. Un item `danger` demande un second appui.
export function RowMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(null);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  const visible = items.filter(Boolean);
  if (!visible.length) return <span style={{ width: 44, flexShrink: 0 }}/>;
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); setArmed(null); }}
        style={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 8, background: open ? ZB.paper2 : "none", border: "none", color: ZB.ink2, cursor: "pointer" }}>
        {MoreIcon}
      </button>
      {open && (
        <>
          <div onClick={e => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 40 }}/>
          <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 41, minWidth: 220, padding: 4,
            background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 10, boxShadow: "0 10px 30px rgba(26,22,18,.16)" }}>
            {visible.map(it => (
              <button key={it.key} type="button" role="menuitem" disabled={it.disabled}
                onClick={e => {
                  e.stopPropagation();
                  if (it.danger && armed !== it.key) { setArmed(it.key); return; }
                  setOpen(false); setArmed(null); it.onClick();
                }}
                style={{ display: "block", width: "100%", minHeight: 44, padding: "10px 12px", textAlign: "left", background: "none", border: "none", borderRadius: 8,
                  fontFamily: "inherit", fontSize: 15, fontWeight: armed === it.key ? 700 : 500, color: it.danger ? ZB.danger : ZB.ink,
                  cursor: it.disabled ? "default" : "pointer", opacity: it.disabled ? 0.5 : 1 }}>
                {armed === it.key ? (it.confirmLabel || "Appuie encore pour confirmer") : it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Ligne du registre : zone principale cliquable + menu à droite.
export function RegisterRow({ onOpen, openLabel, title, sub, amount, status, menu, last, indent = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: last ? "none" : `1px solid ${ZB.ruleSoft}`, paddingRight: 4 }}>
      <button type="button" className="zb-row" onClick={onOpen} aria-label={openLabel}
        style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", alignItems: "baseline",
          minHeight: 64, padding: `12px 8px 12px ${indent ? 36 : 16}px`, background: "none", border: "none", textAlign: "left", fontFamily: "inherit", color: ZB.ink, cursor: "pointer" }}>
        <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflowWrap: "break-word", hyphens: "manual" }}>{title}</span>
        <span style={{ fontSize: 15, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap", ...NUM }}>{amount}</span>
        {(status || sub) && (
          <span style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {status}
            {sub && <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: ZB.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
          </span>
        )}
      </button>
      {menu}
    </div>
  );
}

export const SearchIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>;
export const PlusIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>;
export const CameraIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>;
export const ChevronIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>;
