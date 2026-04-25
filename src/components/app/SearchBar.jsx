import { useState, useRef, useEffect, useCallback } from "react";

const ICONS = {
  client:  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  devis:   <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>,
  facture: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  search:  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
};

const LABELS = { client: "Client", devis: "Devis", facture: "Facture" };
const COLORS  = { client: "#3b82f6", devis: "#f59e0b", facture: "#8b5cf6" };

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

  const query = q.trim().toLowerCase();

  const results = query.length < 2 ? [] : [
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
      .map(inv => ({ type: "facture", id: inv.id, label: inv.numero, sub: inv.objet || "" })),
  ];

  const navigate = (r) => {
    if (r.type === "client")  goClient(r.id);
    if (r.type === "devis")   goDevis(r.id);
    if (r.type === "facture") goInvoice(r.id);
    setQ(""); setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", padding: "10px 14px 0" }}>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }}>
          {ICONS.search}
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Rechercher client, devis, facture…"
          style={{
            width: "100%", boxSizing: "border-box",
            paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
            fontSize: 14, borderRadius: 12,
            border: "1px solid #e2e8f0", background: "white",
            outline: "none", color: "#0f172a", fontFamily: "inherit",
            boxShadow: open && query.length >= 2 ? "0 0 0 2px #e2e8f0" : "none",
          }}
        />
        {q && (
          <button onClick={() => { setQ(""); setOpen(false); inputRef.current?.focus(); }}
            style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2 }}>
            ×
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 14, right: 14,
          background: "white", borderRadius: 14, border: "1px solid #e2e8f0",
          boxShadow: "0 8px 32px rgba(0,0,0,.12)", zIndex: 100, overflow: "hidden",
        }}>
          {results.length === 0 ? (
            <div style={{ padding: "14px 16px", fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
              Aucun résultat pour « {q} »
            </div>
          ) : results.map((r, i) => (
            <button key={i} onClick={() => navigate(r)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", background: "none", border: "none",
                borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
                cursor: "pointer", textAlign: "left",
              }}
              onMouseOver={e => e.currentTarget.style.background = "#f8fafc"}
              onMouseOut={e => e.currentTarget.style.background = "none"}
            >
              <span style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: `${COLORS[r.type]}18`,
                color: COLORS[r.type],
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {ICONS[r.type]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.label}
                </div>
                {r.sub && (
                  <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.sub}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 10, color: COLORS[r.type], fontWeight: 600, background: `${COLORS[r.type]}18`, padding: "2px 7px", borderRadius: 6, flexShrink: 0 }}>
                {LABELS[r.type]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
