import { useState, useRef } from "react";
import { STATUT_FACTURE } from "../lib/constants.js";
import { fmt } from "../lib/utils.js";
import Badge from "./ui/Badge.jsx";

export default function InvoicesList({ invoices, clients, goInvoice, onCreateEmpty, onDelete }) {
  const [filtre, setFiltre] = useState("tous");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const popoverRef = useRef(null);
  const filtered = filtre === "tous" ? invoices : invoices.filter(i => i.statut === filtre);

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
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#0f172a", fontFamily: "'Syne', sans-serif", letterSpacing: '-0.3px' }}>Factures</h1>
          <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
            {invoices.length} facture{invoices.length > 1 ? "s" : ""} · Facturation électronique 2026
          </p>
        </div>
        <button onClick={onCreateEmpty}
          style={{ background: "#0f172a", color: "white", border: "none", borderRadius: 12, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          + Nouvelle
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {["tous", "brouillon", "envoyee", "payee", "rejetee"].map(s => (
          <button key={s} onClick={() => setFiltre(s)}
            style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", background: filtre === s ? "#0f172a" : "white", color: filtre === s ? "white" : "#64748b", boxShadow: filtre === s ? "none" : "0 1px 3px rgba(0,0,0,.06)" }}>
            {s === "tous" ? "Toutes" : STATUT_FACTURE[s]?.label}
          </button>
        ))}
      </div>

      <div style={{ background: "white", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        {filtered.length === 0 && (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
            Aucune facture. Convertissez un devis accepté ou créez-en une depuis zéro.
          </div>
        )}
        {filtered.map(i => {
          const cl = clients.find(c => c.id === i.client_id);
          return (
            <div key={i.id} style={{ position: "relative" }}>
              <div
                style={{ padding: "13px 16px", borderBottom: "1px solid #f8fafc", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                onMouseOver={e => e.currentTarget.style.background = "#fafafa"}
                onMouseOut={e => e.currentTarget.style.background = "white"}>
                <div onClick={() => goInvoice(i.id)} style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{i.numero}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cl?.raison_sociale || `${cl?.prenom || ""} ${cl?.nom || ""}`.trim() || "—"}
                    {i.objet && ` · ${i.objet}`}
                  </div>
                </div>
                <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{fmt(i.montant_ttc)}</div>
                  <div style={{ marginTop: 5, display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center" }}>
                    {i.invoice_type === "acompte" && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#c2410c", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, padding: "1px 5px" }}>ACOMPTE</span>
                    )}
                    <Badge s={i.statut} kind="facture"/>
                  </div>
                </div>
                {i.statut === "brouillon" && onDelete && (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(confirmDelete === i.id ? null : i.id); }}
                    style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    ✕
                  </button>
                )}
              </div>

              {/* Popover confirmation */}
              {confirmDelete === i.id && (
                <div ref={popoverRef} style={{ position: "absolute", top: "100%", right: 16, marginTop: 4, background: "white", borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,.15)", padding: "10px 12px", zIndex: 100, minWidth: 200, animation: "popIn .2s ease" }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Supprimer ce brouillon ?</div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => setConfirmDelete(null)}
                      style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #e2e8f0", background: "white", color: "#0f172a", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      Annuler
                    </button>
                    <button onClick={() => handleDelete(i.id)}
                      style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "#dc2626", color: "white", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      Supprimer
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
