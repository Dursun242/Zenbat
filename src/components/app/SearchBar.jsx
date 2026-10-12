import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";

import { ZB } from "../../lib/theme.js";

const svg = { width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", "aria-hidden": true };
const ICONS = {
  client:  <svg {...svg}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  devis:   <svg {...svg}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>,
  facture: <svg {...svg}><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/></svg>,
  search:  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>,
  clear:   <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>,
};

const LABELS = { client: "Client", devis: "Devis", facture: "Facture" };

const CSS = `
  .zb-search input:focus { border-color: ${ZB.accent} !important; }
  .zb-search input::placeholder { color: ${ZB.ink3}; opacity: 1; }
  .zb-search button:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; }
  @media (hover: hover) { .zb-search-row:hover { background: ${ZB.paper2} !important; } }
`;

function clientName(c) {
  return (c?.raison_sociale || `${c?.prenom || ""} ${c?.nom || ""}`.trim() || "—");
}

export default function SearchBar({ devis = [], clients = [], invoices = [], goDevis, goClient, goInvoice }) {
  const [q, setQ]       = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  const onKey = useCallback((e) => {
    if (e.key === "Escape") { setOpen(false); setQ(""); }
  }, []);

  // Debounce + memo : le filtre tournait sur 3 listes à chaque frappe.
  // Sur une grosse base (1000+ devis, 500+ clients, 200+ factures), c'est
  // du CPU visible comme du lag. L'input reste réactif (q changeant à
  // chaque frappe) mais la recherche n'est exécutée qu'après 180 ms sans
  // frappe.
  const debouncedQ = useDebouncedValue(q, 180);
  const query = debouncedQ.trim().toLowerCase();

  const results = useMemo(() => {
    if (query.length < 2) return [];
    return [
      ...clients
        .filter(c => clientName(c).toLowerCase().includes(query) || (c.email || "").toLowerCase().includes(query))
        .slice(0, 3)
        .map(c => ({ type: "client", id: c.id, label: clientName(c), sub: c.email || c.telephone || "" })),

      ...devis
        .filter(d => {
          const cl = clients.find(c => c.id === d.client_id);
          return (d.numero || "").toLowerCase().includes(query)
            || (d.objet  || "").toLowerCase().includes(query)
            || clientName(cl).toLowerCase().includes(query);
        })
        .slice(0, 4)
        .map(d => {
          const cl = clients.find(c => c.id === d.client_id);
          return { type: "devis", id: d.id, label: d.numero, sub: d.objet || clientName(cl) };
        }),

      ...invoices
        .filter(inv => (inv.numero || "").toLowerCase().includes(query) || (inv.objet || "").toLowerCase().includes(query))
        .slice(0, 3)
        .map(inv => ({ type: "facture", id: inv.id, label: inv.numero || "Facture brouillon", sub: inv.objet || "" })),
    ];
  }, [query, clients, devis, invoices]);

  const navigate = (r) => {
    if (r.type === "client")  goClient(r.id);
    if (r.type === "devis")   goDevis(r.id);
    if (r.type === "facture") goInvoice(r.id);
    setQ(""); setOpen(false);
  };

  return (
    <div ref={wrapRef} className="zb-search" style={{ position: "relative", padding: "10px 14px 0", fontFamily: ZB.font }}>
      <style>{CSS}</style>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: ZB.ink2, pointerEvents: "none", display: "flex" }}>
          {ICONS.search}
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Rechercher client, devis, facture…"
          aria-label="Rechercher un client, un devis ou une facture"
          style={{
            width: "100%", boxSizing: "border-box", minHeight: 44,
            paddingLeft: 38, paddingRight: q ? 48 : 12, paddingTop: 10, paddingBottom: 10,
            fontSize: 16, borderRadius: 8,
            border: `1px solid ${ZB.field}`, background: ZB.sheet,
            outline: "none", color: ZB.ink, fontFamily: "inherit",
          }}
        />
        {q && (
          <button type="button" aria-label="Effacer la recherche" onClick={() => { setQ(""); setOpen(false); inputRef.current?.focus(); }}
            style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: "none", color: ZB.ink2, cursor: "pointer", padding: 0 }}>
            {ICONS.clear}
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 14, right: 14,
          background: ZB.sheet, borderRadius: 10, border: `1px solid ${ZB.rule}`,
          boxShadow: "0 10px 30px rgba(26,22,18,.16)", zIndex: 100, overflow: "hidden",
        }}>
          {results.length === 0 ? (
            <div style={{ padding: "14px 16px", fontSize: 15, color: ZB.ink2, textAlign: "center" }}>
              Aucun résultat pour « {q} »
            </div>
          ) : results.map((r, i) => (
            <button key={i} type="button" className="zb-search-row" onClick={() => navigate(r)}
              style={{
                width: "100%", minHeight: 52, display: "flex", alignItems: "center", gap: 12,
                padding: "8px 14px", background: "none", border: "none",
                borderTop: i > 0 ? `1px solid ${ZB.ruleSoft}` : "none",
                cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: ZB.ink,
              }}
            >
              <span style={{ width: 22, height: 22, flexShrink: 0, color: ZB.ink2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {ICONS[r.type]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: ZB.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.label}
                </div>
                {r.sub && (
                  <div style={{ fontSize: 13, color: ZB.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.sub}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 13, color: ZB.ink2, fontWeight: 600, flexShrink: 0 }}>
                {LABELS[r.type]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
