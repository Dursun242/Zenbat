import { useState } from "react";
import { STATUT_FACTURE } from "../lib/constants.js";
import { fmt } from "../lib/utils.js";
import Badge from "./ui/Badge.jsx";

export default function InvoicesList({ invoices, clients, goInvoice, onCreateEmpty }) {
  const [filtre, setFiltre] = useState("tous");
  const filtered = filtre === "tous" ? invoices : invoices.filter(i => i.statut === filtre);

  return (
    <div style={{ padding: 18 }} className="fu">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Factures</h1>
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
            <div key={i.id} onClick={() => goInvoice(i.id)}
              style={{ padding: "13px 16px", borderBottom: "1px solid #f8fafc", cursor: "pointer" }}
              onMouseOver={e => e.currentTarget.style.background = "#fafafa"}
              onMouseOut={e => e.currentTarget.style.background = "white"}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{i.numero}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cl?.raison_sociale || `${cl?.prenom || ""} ${cl?.nom || ""}`.trim() || "—"}
                    {i.objet && ` · ${i.objet}`}
                  </div>
                </div>
                <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{fmt(i.montant_ttc)}</div>
                  <div style={{ marginTop: 5 }}><Badge s={i.statut} kind="facture"/></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
