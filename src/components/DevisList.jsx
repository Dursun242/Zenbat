import { useState } from "react";
import { STATUT } from "../lib/constants.js";
import { fmt } from "../lib/utils.js";
import { I } from "./ui/icons.jsx";
import Badge from "./ui/Badge.jsx";

export default function DevisList({ devis, clients, goDevis, setTab, onDelete }) {
  const [filtre, setFiltre] = useState("tous");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const filtered = filtre === "tous" ? devis : devis.filter(d => d.statut === filtre);

  const handleDelete = async (id) => {
    if (onDelete) {
      await onDelete(id);
    }
    setConfirmDelete(null);
  };

  return (
    <div style={{ padding: 18 }} className="fu">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Devis</h1>
          <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{devis.length} devis</p>
        </div>
        <button onClick={() => setTab("agent")}
          style={{ background: "#22c55e", color: "white", border: "none", borderRadius: 12, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          {I.spark} Via IA
        </button>
      </div>

      {/* Filtres statut */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {["tous", "brouillon", "en_signature", "accepte", "refuse"].map(s => (
          <button key={s} onClick={() => setFiltre(s)}
            style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", background: filtre === s ? "#0f172a" : "white", color: filtre === s ? "white" : "#64748b", boxShadow: filtre === s ? "none" : "0 1px 3px rgba(0,0,0,.06)" }}>
            {s === "tous" ? "Tous" : STATUT[s]?.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        {filtered.length === 0 && (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Aucun devis</div>
        )}
        {filtered.map(d => {
          const cl = clients.find(c => c.id === d.client_id);
          return (
            <div key={d.id}
              style={{ padding: "13px 16px", borderBottom: "1px solid #f8fafc", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onMouseOver={e => e.currentTarget.style.background = "#fafafa"}
              onMouseOut={e => e.currentTarget.style.background = "white"}>
              <div onClick={() => goDevis(d.id)} style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{d.objet}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {cl?.raison_sociale || `${cl?.prenom || ""} ${cl?.nom || ""}`.trim() || "—"}
                </div>
              </div>
              <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{fmt(d.montant_ht)}</div>
                <div style={{ marginTop: 5 }}><Badge s={d.statut}/></div>
              </div>
              {d.statut === "brouillon" && onDelete && (
                <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(d.id); }}
                  style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de confirmation */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setConfirmDelete(null)}>
          <div style={{ background: "white", borderRadius: 12, padding: 20, maxWidth: 340, boxShadow: "0 20px 25px rgba(0,0,0,.15)" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Supprimer ce brouillon ?</h2>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Cette action est irréversible.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", color: "#0f172a", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#dc2626", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
