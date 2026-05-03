import { useState, useEffect, useRef } from "react";

function clientLabel(c) {
  return c?.raison_sociale || `${c?.prenom || ""} ${c?.nom || ""}`.trim() || "—";
}

export default function ClientPickerModal({ clients = [], current, onSelect, onClose, requireEmail = false }) {
  const [q, setQ] = useState("");
  const inputRef  = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = q.trim().length === 0
    ? clients
    : clients.filter(c => {
        const s = q.toLowerCase();
        return clientLabel(c).toLowerCase().includes(s)
          || (c.email      || "").toLowerCase().includes(s)
          || (c.telephone  || "").toLowerCase().includes(s)
          || (c.ville      || "").toLowerCase().includes(s);
      });

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "18px 18px 10px", borderBottom: "1px solid #F0EBE3", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#1A1612" }}>Choisir un client</span>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#9A8E82", cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher…"
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E8E2D8", borderRadius: 10, padding: "8px 12px", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#1A1612" }}
          />
        </div>

        {/* Liste */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {requireEmail && (
            <div style={{ margin: "10px 14px 4px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 15, lineHeight: "1.3", flexShrink: 0 }}>✉️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 2 }}>Email requis</div>
                <div style={{ fontSize: 11, color: "#b45309", lineHeight: "1.4" }}>Choisissez un client avec une adresse email pour la signature électronique.</div>
              </div>
            </div>
          )}
          {/* Option "sans client" */}
          <button
            onClick={() => { onSelect(null); onClose(); }}
            style={{ width: "100%", padding: "12px 18px", background: current ? "none" : "#f0fdf4", border: "none", borderBottom: "1px solid #FAF7F2", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: "#F0EBE3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>—</span>
            <span style={{ fontSize: 13, color: "#6B6358", fontStyle: "italic" }}>Sans client</span>
          </button>

          {filtered.length === 0 && q.trim() && (
            <div style={{ padding: "20px 18px", fontSize: 13, color: "#9A8E82", textAlign: "center" }}>
              Aucun client trouvé pour « {q} »
            </div>
          )}

          {filtered.map(c => {
            const isCurrent  = c.id === current?.id;
            const label      = clientLabel(c);
            const sub        = c.email || c.telephone || c.ville || "";
            const noEmail    = requireEmail && !c.email;
            return (
              <button key={c.id}
                onClick={() => { onSelect(c); onClose(); }}
                style={{ width: "100%", padding: "11px 18px", background: isCurrent ? "#f0fdf4" : "none", border: "none", borderBottom: "1px solid #FAF7F2", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, opacity: noEmail ? 0.65 : 1 }}
                onMouseOver={e => { if (!isCurrent) e.currentTarget.style.background = "#FAF7F2"; }}
                onMouseOut={e  => { if (!isCurrent) e.currentTarget.style.background = "none"; }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, background: isCurrent ? "#dcfce7" : "#F0EBE3", color: isCurrent ? "#16a34a" : "#6B6358", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {label.charAt(0).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
                  {sub && <div style={{ fontSize: 11, color: "#9A8E82", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
                  {noEmail && <span style={{ display: "inline-block", fontSize: 10, fontWeight: 600, color: "#c2410c", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 20, padding: "1px 7px", marginTop: 3 }}>sans email</span>}
                </div>
                {isCurrent && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, flexShrink: 0 }}>✓ actuel</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
