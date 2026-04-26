import { useState, useRef } from "react";
import { STATUT } from "../lib/constants.js";
import { fmt } from "../lib/utils.js";
import { I } from "./ui/icons.jsx";
import Badge from "./ui/Badge.jsx";

function clientName(c) {
  return c?.raison_sociale || `${c?.prenom || ""} ${c?.nom || ""}`.trim() || "—";
}

function IndiceChip({ indice }) {
  if (!indice) return <span style={{ fontSize: 10, color: "#94a3b8" }}>Initial</span>;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: "#6b21a8", background: "#f5f3ff",
      border: "1px solid #e9d5ff", borderRadius: 5, padding: "1px 6px" }}>
      {indice}
    </span>
  );
}

// Carte pour un devis sans indice (affichage simple, identique à avant)
function DevisRow({ d, cl, goDevis, onDelete, confirmDelete, setConfirmDelete }) {
  const popoverRef = useRef(null);
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{ padding: "13px 16px", borderBottom: "1px solid #f8fafc", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}
        onMouseOver={e => e.currentTarget.style.background = "#fafafa"}
        onMouseOut={e  => e.currentTarget.style.background = "white"}>
        <div onClick={() => goDevis(d.id)} style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {d.objet || "—"}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{clientName(cl)}</div>
        </div>
        <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{fmt(d.montant_ht)}</div>
          <div style={{ marginTop: 4 }}><Badge s={d.statut}/></div>
        </div>
        {d.statut === "brouillon" && onDelete && (
          <button onClick={e => { e.stopPropagation(); setConfirmDelete(confirmDelete === d.id ? null : d.id); }}
            style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 6, border: "none",
              background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            ✕
          </button>
        )}
      </div>
      {confirmDelete === d.id && (
        <div ref={popoverRef} style={{ position: "absolute", top: "100%", right: 16, marginTop: 4,
          background: "white", borderRadius: 8, border: "1px solid #e5e7eb",
          boxShadow: "0 4px 12px rgba(0,0,0,.15)", padding: "10px 12px", zIndex: 100,
          minWidth: 200, animation: "popIn .2s ease" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Supprimer ce brouillon ?</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setConfirmDelete(null)}
              style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #e2e8f0",
                background: "white", color: "#0f172a", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              Annuler
            </button>
            <button onClick={() => { onDelete(d.id); setConfirmDelete(null); }}
              style={{ padding: "4px 10px", borderRadius: 4, border: "none",
                background: "#dc2626", color: "white", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Carte dossier pour un groupe de versions
function DossierCard({ versions, cl, goDevis, onDelete }) {
  const [open, setOpen] = useState(false);

  // Version active = la non-remplacée (dernière lettre)
  const active = versions.find(v => v.statut !== "remplace") || versions[versions.length - 1];
  const others = versions.filter(v => v.id !== active.id)
    .sort((a, b) => {
      if (!b.indice) return 1;
      if (!a.indice) return -1;
      return b.indice.localeCompare(a.indice);
    });

  return (
    <div style={{ borderBottom: "1px solid #f8fafc" }}>
      {/* Ligne principale — version active */}
      <div style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 8,
        background: open ? "#fafafa" : "white" }}>
        {/* Chevron expand */}
        <button onClick={() => setOpen(o => !o)}
          style={{ background: "none", border: "none", padding: "2px 4px", cursor: "pointer",
            color: "#94a3b8", fontSize: 12, flexShrink: 0, lineHeight: 1,
            transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
          ▶
        </button>

        {/* Icône dossier */}
        <span style={{ fontSize: 16, flexShrink: 0 }}>📁</span>

        {/* Infos */}
        <div onClick={() => goDevis(active.id)}
          style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {active.objet || "—"}
            </span>
            <IndiceChip indice={active.indice}/>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {clientName(cl)} · {versions.length} version{versions.length > 1 ? "s" : ""}
          </div>
        </div>

        {/* Montant + badge */}
        <div onClick={() => goDevis(active.id)}
          style={{ textAlign: "right", flexShrink: 0, cursor: "pointer" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{fmt(active.montant_ht)}</div>
          <div style={{ marginTop: 4 }}><Badge s={active.statut}/></div>
        </div>
      </div>

      {/* Versions précédentes (expandable) */}
      {open && others.map(v => (
        <div key={v.id}
          onClick={() => goDevis(v.id)}
          style={{ padding: "9px 16px 9px 44px", display: "flex", alignItems: "center", gap: 8,
            background: "#f8fafc", cursor: "pointer", borderTop: "1px solid #f1f5f9" }}
          onMouseOver={e => e.currentTarget.style.background = "#f1f5f9"}
          onMouseOut={e  => e.currentTarget.style.background = "#f8fafc"}>
          <span style={{ color: "#cbd5e1", fontSize: 11, flexShrink: 0 }}>└</span>
          <IndiceChip indice={v.indice}/>
          <span style={{ fontSize: 12, color: "#64748b", flex: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {v.numero}
          </span>
          <span style={{ fontSize: 12, color: "#94a3b8", flexShrink: 0 }}>{fmt(v.montant_ht)}</span>
          <Badge s={v.statut}/>
        </div>
      ))}
    </div>
  );
}

export default function DevisList({ devis, clients, goDevis, setTab, onDelete }) {
  const [filtre, setFiltre]           = useState("tous");
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Groupement : root_devis_id ou enfants
  const childRoots = new Set(devis.filter(d => d.root_devis_id).map(d => d.root_devis_id));

  const items = (() => {
    const result = [];
    const seen   = new Set();

    for (const d of devis) {
      if (seen.has(d.id)) continue;

      if (d.root_devis_id) {
        // Version enfant : déjà incluse via son root
        continue;
      }

      if (childRoots.has(d.id)) {
        // Root d'un groupe : collecte toutes les versions
        const versions = [d, ...devis.filter(x => x.root_devis_id === d.id)]
          .sort((a, b) => !a.indice ? -1 : !b.indice ? 1 : a.indice.localeCompare(b.indice));
        versions.forEach(v => seen.add(v.id));
        result.push({ type: "group", versions });
      } else {
        seen.add(d.id);
        result.push({ type: "single", d });
      }
    }
    return result;
  })();

  // Filtre : sur les groupes, on regarde si la version active correspond
  const filtered = items.filter(item => {
    if (filtre === "tous") return true;
    if (item.type === "single") return item.d.statut === filtre;
    const active = item.versions.find(v => v.statut !== "remplace") || item.versions[0];
    return active.statut === filtre;
  });

  const total = devis.filter(d => !d.root_devis_id || !devis.find(x => x.id === d.root_devis_id)).length;

  return (
    <div style={{ padding: 18 }} className="fu">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#0f172a", fontFamily: "'Syne', sans-serif", letterSpacing: '-0.3px' }}>Devis</h1>
          <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{total} affaire{total > 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setTab("agent")}
          style={{ background: "#22c55e", color: "white", border: "none", borderRadius: 12,
            padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6 }}>
          {I.spark} Via IA
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {["tous", "brouillon", "en_signature", "accepte", "refuse"].map(s => (
          <button key={s} onClick={() => setFiltre(s)}
            style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: "none",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              background: filtre === s ? "#0f172a" : "white",
              color: filtre === s ? "white" : "#64748b",
              boxShadow: filtre === s ? "none" : "0 1px 3px rgba(0,0,0,.06)" }}>
            {s === "tous" ? "Tous" : STATUT[s]?.label}
          </button>
        ))}
      </div>

      <div style={{ background: "white", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        {filtered.length === 0 && (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
            Aucun devis
          </div>
        )}
        {filtered.map((item, i) => {
          if (item.type === "group") {
            const cl = clients.find(c => c.id === (item.versions.find(v => v.client_id)?.client_id));
            return <DossierCard key={item.versions[0].id} versions={item.versions} cl={cl} goDevis={goDevis} onDelete={onDelete}/>;
          }
          const cl = clients.find(c => c.id === item.d.client_id);
          return (
            <DevisRow key={item.d.id} d={item.d} cl={cl} goDevis={goDevis} onDelete={onDelete}
              confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}/>
          );
        })}
      </div>
    </div>
  );
}
