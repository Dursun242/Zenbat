import { useState } from "react";
import { TX } from "../lib/constants.js";
import { uid, displayName } from "../lib/utils.js";

export default function ClientPickerModal({ clients, ac, fontFamily, onSaveClient, onPick, onClose }) {
  const [q,        setQ]        = useState("");
  const [creating, setCreating] = useState(false);
  const [newC,     setNewC]     = useState({ nom: "", email: "", telephone: "" });

  const filtered = clients.filter(c => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (c.nom || "").toLowerCase().includes(s)
      || (c.raison_sociale || "").toLowerCase().includes(s)
      || (c.email || "").toLowerCase().includes(s)
      || (c.ville || "").toLowerCase().includes(s);
  });

  const createAndPick = async () => {
    if (!newC.nom.trim()) return;
    const c = {
      id: uid(), nom: newC.nom.trim(), email: newC.email.trim(),
      telephone: newC.telephone.trim(), type: "particulier",
      ville: "", adresse: "", siret: "", notes: "",
    };
    await onSaveClient(c);
    onPick(c.id);
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "fadeUp .2s ease" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 520, background: "white", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: "18px 18px 22px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -8px 30px rgba(0,0,0,.2)" }}>

        <div style={{ width: 36, height: 4, background: "#cbd5e1", borderRadius: 2, margin: "0 auto 14px" }}/>
        <div style={{ fontFamily, fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{TX.pickClientTitle}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>{TX.pickClientHint}</div>

        {!creating ? (
          <>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={TX.searchClient}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, marginBottom: 10, boxSizing: "border-box" }}/>

            <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: 10, marginBottom: 10 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "18px 14px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>{TX.noClientsYet}</div>
              ) : filtered.map(c => (
                <button key={c.id} onClick={() => onPick(c.id)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{displayName(c)}</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{[c.email, c.ville].filter(Boolean).join(" · ") || "—"}</span>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setCreating(true)}
                style={{ flex: 1, minWidth: 140, background: "#f1f5f9", color: "#0f172a", border: "none", borderRadius: 10, padding: 11, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {TX.newClientInline}
              </button>
              <button onClick={() => onPick(null)}
                style={{ flex: 1, minWidth: 140, background: "none", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 10, padding: 11, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                {TX.noClientOpt}
              </button>
            </div>
          </>
        ) : (
          <>
            <input value={newC.nom} onChange={e => setNewC({ ...newC, nom: e.target.value })} placeholder={TX.newClientName} autoFocus
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}/>
            <input value={newC.email} onChange={e => setNewC({ ...newC, email: e.target.value })} placeholder={TX.newClientEmail} type="email"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}/>
            <input value={newC.telephone} onChange={e => setNewC({ ...newC, telephone: e.target.value })} placeholder={TX.newClientPhone} type="tel"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}/>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setCreating(false); setNewC({ nom: "", email: "", telephone: "" }); }}
                style={{ flex: 1, background: "none", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 10, padding: 11, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                {TX.cancel}
              </button>
              <button onClick={createAndPick} disabled={!newC.nom.trim()}
                style={{ flex: 2, background: newC.nom.trim() ? ac : "#cbd5e1", color: "white", border: "none", borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 700, cursor: newC.nom.trim() ? "pointer" : "not-allowed" }}>
                {TX.confirmPick}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
