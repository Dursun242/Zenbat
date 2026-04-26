import { useState } from "react";
import { displayName } from "../lib/utils.js";
import { fmt } from "../lib/utils.js";
import { I } from "./ui/icons.jsx";
import Badge from "./ui/Badge.jsx";
import ContactEditor from "./ContactEditor.jsx";

export default function ClientDetail({ c, clientDevis, onBack, goDevis, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);

  const fields = [
    ["Email",         c.email],
    ["Mobile",        c.telephone],
    ["Fixe",          c.telephone_fixe],
    ["Adresse",       [c.adresse, [c.code_postal, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(" — ")],
    ["SIRET",         c.siret],
    ["TVA intracom.", c.tva_intra],
    ["Activité",      c.activite],
    ["Notes",         c.notes],
  ].filter(([, v]) => v);

  return (
    <div style={{ padding: 18 }} className="fu">
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6B6358", fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
        {I.back} Retour
      </button>

      <div style={{ background: "white", borderRadius: 14, border: "1px solid #F0EBE3", padding: 18, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: c.type === "particulier" ? "#eff6ff" : "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: c.type === "particulier" ? "#1d4ed8" : "#b45309", fontSize: 20 }}>
            {displayName(c).charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1A1612", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(c)}</div>
            <div style={{ fontSize: 11, color: "#9A8E82", marginTop: 2 }}>
              {c.type === "particulier" ? "Particulier" : c.type === "artisan" ? "Artisan" : "Entreprise"}
              {c.ville ? ` · ${c.ville}` : ""}
            </div>
          </div>
          <button onClick={() => setEditing(true)} style={{ background: "#F0EBE3", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 15, color: "#6B6358" }} aria-label="Modifier">✏️</button>
        </div>

        {fields.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid #FAF7F2" }}>
            <span style={{ fontSize: 12, color: "#9A8E82", flexShrink: 0 }}>{k}</span>
            <span style={{ fontSize: 12, color: "#1A1612", fontWeight: 500, textAlign: "right", wordBreak: "break-word" }}>{v}</span>
          </div>
        ))}

        <button onClick={() => { if (window.confirm("Supprimer définitivement ce contact ?")) onDelete(); }}
          style={{ marginTop: 12, width: "100%", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          🗑️ Supprimer le contact
        </button>
      </div>

      {/* Devis du client */}
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #F0EBE3", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #FAF7F2", fontWeight: 600, fontSize: 13, color: "#1A1612" }}>
          Devis ({clientDevis.length})
        </div>
        {clientDevis.length === 0 && (
          <div style={{ padding: "14px 16px", fontSize: 12, color: "#9A8E82" }}>Aucun devis pour ce contact</div>
        )}
        {clientDevis.map(d => (
          <div key={d.id} onClick={() => goDevis(d.id)}
            style={{ padding: "12px 16px", borderBottom: "1px solid #FAF7F2", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            onMouseOver={e => e.currentTarget.style.background = "#fafafa"}
            onMouseOut={e => e.currentTarget.style.background = "white"}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1612" }}>{d.objet}</div>
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "#9A8E82", marginTop: 2 }}>{d.numero}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(d.montant_ht)}</div>
              <div style={{ marginTop: 4 }}><Badge s={d.statut}/></div>
            </div>
          </div>
        ))}
      </div>

      {editing && <ContactEditor c={c} onSave={u => { onUpdate(u); setEditing(false); }} onClose={() => setEditing(false)}/>}
    </div>
  );
}
