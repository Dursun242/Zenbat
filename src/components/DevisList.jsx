import { useState } from "react";
import { STATUT } from "../lib/constants.js";
import { fmt } from "../lib/utils.js";
import { I } from "./ui/icons.jsx";
import Badge from "./ui/Badge.jsx";

function clientName(c) {
  return c?.raison_sociale || `${c?.prenom || ""} ${c?.nom || ""}`.trim() || "—";
}

// Indicateur « envoyé il y a Xj » sur un devis envoyé en attente de réponse.
// Vert ≤2j (récent), orange 3-7j (à surveiller), rouge >7j (à relancer).
function sentSinceChip(sentAt, statut) {
  if (!sentAt || !["envoye", "en_signature", "en_negociation"].includes(statut)) return null;
  const days = Math.floor((Date.now() - new Date(sentAt).getTime()) / 86400000);
  if (days < 0) return null;
  const color = days <= 2 ? "#15803d" : days <= 7 ? "#b45309" : "#b91c1c";
  const bg    = days <= 2 ? "#f0fdf4" : days <= 7 ? "#fffbeb" : "#fef2f2";
  const label = days === 0 ? "envoyé aujourd'hui" : days === 1 ? "envoyé hier" : `envoyé il y a ${days} j`;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, background: bg,
      borderRadius: 4, padding: "1px 6px", marginLeft: 6 }}>
      {label}
    </span>
  );
}

function IndiceChip({ indice }) {
  if (!indice) return <span style={{ fontSize: 10, color: "#9A8E82" }}>Initial</span>;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: "#6b21a8", background: "#f5f3ff",
      border: "1px solid #e9d5ff", borderRadius: 5, padding: "1px 6px" }}>
      {indice}
    </span>
  );
}

// Carte pour un devis sans indice (affichage simple, identique à avant)
function DevisRow({ d, cl, goDevis, onDelete, onDuplicate, duplicating, confirmDelete, setConfirmDelete }) {
  return (
    <div>
      <div
        style={{ padding: "13px 16px", borderBottom: "1px solid #FAF7F2", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}
        onMouseOver={e => e.currentTarget.style.background = "#fafafa"}
        onMouseOut={e  => e.currentTarget.style.background = "white"}>
        <div onClick={() => goDevis(d.id)} style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1612",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {d.objet || "—"}
          </div>
          <div style={{ fontSize: 11, color: "#9A8E82", marginTop: 2, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
            <span>{clientName(cl)}</span>
            {sentSinceChip(d.sent_to_client_at, d.statut)}
          </div>
        </div>
        <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1612" }}>{fmt(d.montant_ht)}</div>
          <div style={{ marginTop: 4 }}><Badge s={d.statut}/></div>
        </div>
        {onDuplicate && (
          <button onClick={e => { e.stopPropagation(); onDuplicate(d.id); }} disabled={duplicating} title="Dupliquer ce devis"
            style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 6, border: "none",
              background: "#F0EBE3", color: "#6B6358", fontSize: 13, fontWeight: 600, cursor: duplicating ? "default" : "pointer", opacity: duplicating ? 0.5 : 1 }}>
            {duplicating ? "⏳" : "📋"}
          </button>
        )}
        {d.statut === "brouillon" && onDelete && (
          confirmDelete === d.id ? (
            <>
              <button onClick={e => { e.stopPropagation(); setConfirmDelete(null); }}
                style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "white", color: "#1A1612", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={e => { e.stopPropagation(); onDelete(d.id); setConfirmDelete(null); }}
                style={{ marginLeft: 4, padding: "4px 8px", borderRadius: 6, border: "none", background: "#dc2626", color: "white", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Supprimer
              </button>
            </>
          ) : (
            <button onClick={e => { e.stopPropagation(); setConfirmDelete(d.id); }}
              style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 6, border: "none",
                background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              ✕
            </button>
          )
        )}
      </div>
    </div>
  );
}

// Carte dossier pour un groupe de versions
function DossierCard({ versions, cl, goDevis, onDelete, onDuplicate, duplicatingIds }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Version active = la non-remplacée (dernière lettre)
  const active = versions.find(v => v.statut !== "remplace") || versions[versions.length - 1];
  const others = versions.filter(v => v.id !== active.id)
    .sort((a, b) => {
      if (!b.indice) return 1;
      if (!a.indice) return -1;
      return b.indice.localeCompare(a.indice);
    });

  const btnCancel  = id => <button key="cancel" onClick={e => { e.stopPropagation(); setConfirmDelete(null); }}
    style={{ flexShrink: 0, padding: "3px 7px", borderRadius: 6, border: "1px solid #e5e7eb", background: "white", color: "#1A1612", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Annuler</button>;
  const btnConfirm = id => <button key="confirm" onClick={e => { e.stopPropagation(); onDelete(id); setConfirmDelete(null); }}
    style={{ flexShrink: 0, padding: "3px 7px", borderRadius: 6, border: "none", background: "#dc2626", color: "white", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Supprimer</button>;
  const btnX       = id => <button key="x" onClick={e => { e.stopPropagation(); setConfirmDelete(id); }}
    style={{ flexShrink: 0, padding: "3px 7px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✕</button>;

  return (
    <div style={{ borderBottom: "1px solid #FAF7F2" }}>
      {/* Ligne principale — version active */}
      <div style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 8,
        background: open ? "#fafafa" : "white" }}>
        {/* Chevron expand */}
        <button onClick={() => setOpen(o => !o)}
          style={{ background: "none", border: "none", padding: "2px 4px", cursor: "pointer",
            color: "#9A8E82", fontSize: 12, flexShrink: 0, lineHeight: 1,
            transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
          ▶
        </button>

        {/* Icône dossier */}
        <span style={{ fontSize: 16, flexShrink: 0 }}>📁</span>

        {/* Infos */}
        <div onClick={() => goDevis(active.id)}
          style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1612",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {active.objet || "—"}
            </span>
            <IndiceChip indice={active.indice}/>
          </div>
          <div style={{ fontSize: 11, color: "#9A8E82", display: "flex", alignItems: "center", flexWrap: "wrap" }}>
            <span>{clientName(cl)} · {versions.length} version{versions.length > 1 ? "s" : ""}</span>
            {sentSinceChip(active.sent_to_client_at, active.statut)}
          </div>
        </div>

        {/* Montant + badge */}
        <div onClick={() => goDevis(active.id)}
          style={{ textAlign: "right", flexShrink: 0, cursor: "pointer" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1612" }}>{fmt(active.montant_ht)}</div>
          <div style={{ marginTop: 4 }}><Badge s={active.statut}/></div>
        </div>

        {/* 📋 dupliquer (sur la version active) */}
        {onDuplicate && (() => {
          const dup = duplicatingIds?.has(active.id);
          return (
            <button onClick={e => { e.stopPropagation(); onDuplicate(active.id); }} disabled={dup} title="Dupliquer ce devis"
              style={{ flexShrink: 0, padding: "3px 7px", borderRadius: 6, border: "none", background: "#F0EBE3", color: "#6B6358", fontSize: 12, fontWeight: 600, cursor: dup ? "default" : "pointer", opacity: dup ? 0.5 : 1 }}>
              {dup ? "⏳" : "📋"}
            </button>
          );
        })()}

        {/* ✕ version active si brouillon */}
        {active.statut === "brouillon" && onDelete && (
          confirmDelete === active.id
            ? <>{btnCancel(active.id)}{btnConfirm(active.id)}</>
            : btnX(active.id)
        )}
      </div>

      {/* Versions précédentes (expandable) */}
      {open && others.map(v => (
        <div key={v.id}
          style={{ padding: "9px 16px 9px 44px", display: "flex", alignItems: "center", gap: 8,
            background: "#FAF7F2", borderTop: "1px solid #F0EBE3" }}>
          <div onClick={() => goDevis(v.id)}
            style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
            onMouseOver={e => e.currentTarget.style.opacity = "0.7"}
            onMouseOut={e  => e.currentTarget.style.opacity = "1"}>
            <span style={{ color: "#cbd5e1", fontSize: 11, flexShrink: 0 }}>└</span>
            <IndiceChip indice={v.indice}/>
            <span style={{ fontSize: 12, color: "#6B6358", flex: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {v.numero}
            </span>
            <span style={{ fontSize: 12, color: "#9A8E82", flexShrink: 0 }}>{fmt(v.montant_ht)}</span>
            <Badge s={v.statut}/>
          </div>
          {/* ✕ version précédente si brouillon */}
          {v.statut === "brouillon" && onDelete && (
            confirmDelete === v.id
              ? <>{btnCancel(v.id)}{btnConfirm(v.id)}</>
              : btnX(v.id)
          )}
        </div>
      ))}
    </div>
  );
}

export default function DevisList({ devis, clients, goDevis, setTab, onDelete, onDuplicate }) {
  const [filtre, setFiltre]           = useState("tous");
  const [confirmDelete, setConfirmDelete] = useState(null);
  // Track des devis en cours de duplication (Set d'IDs) : empêche un
  // double-clic de créer deux copies du même devis pendant la latence
  // réseau de l'API.
  const [duplicatingIds, setDuplicatingIds] = useState(() => new Set());
  const wrappedDuplicate = onDuplicate ? async (id) => {
    if (duplicatingIds.has(id)) return;
    setDuplicatingIds(prev => { const n = new Set(prev); n.add(id); return n; });
    try { await onDuplicate(id); }
    finally { setDuplicatingIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  } : null;

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
  const negociationCount = devis.filter(d => d.statut === "en_negociation").length;

  return (
    <div style={{ padding: 18 }} className="fu">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1A1612", fontFamily: "'Syne', sans-serif", letterSpacing: '-0.3px' }}>Devis</h1>
          <p style={{ color: "#9A8E82", fontSize: 11, marginTop: 2 }}>{total} affaire{total > 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setTab("agent")}
          style={{ background: "#22c55e", color: "white", border: "none", borderRadius: 12,
            padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6 }}>
          {I.spark} Via IA
        </button>
      </div>

      {/* Bannière d'alerte si des clients ont envoyé des demandes de modification.
          Cliquable : filtre la liste sur les devis en négociation. */}
      {negociationCount > 0 && filtre !== "en_negociation" && (
        <button onClick={() => setFiltre("en_negociation")}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 12,
            background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10,
            padding: "10px 14px", cursor: "pointer", textAlign: "left" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f97316", flexShrink: 0 }}/>
          <span style={{ fontSize: 12, color: "#9a3412", fontWeight: 600, flex: 1 }}>
            {negociationCount} demande{negociationCount > 1 ? "s" : ""} de modification en attente de votre réponse
          </span>
          <span style={{ fontSize: 11, color: "#c2410c", fontWeight: 700 }}>Voir →</span>
        </button>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {["tous", "brouillon", "en_signature", "en_negociation", "accepte", "refuse"].map(s => {
          const showAlert = s === "en_negociation" && negociationCount > 0;
          return (
            <button key={s} onClick={() => setFiltre(s)}
              style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: "none",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: filtre === s ? "#1A1612" : "white",
                color: filtre === s ? "white" : "#6B6358",
                boxShadow: filtre === s ? "none" : "0 1px 3px rgba(0,0,0,.06)",
                display: "inline-flex", alignItems: "center", gap: 5 }}>
              {s === "tous" ? "Tous" : STATUT[s]?.label}
              {showAlert && (
                <span style={{ background: "#ef4444", color: "white", fontSize: 9, fontWeight: 700,
                  padding: "1px 6px", borderRadius: 8, minWidth: 16, textAlign: "center" }}>
                  {negociationCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ background: "white", borderRadius: 14, border: "1px solid #F0EBE3", overflow: "hidden" }}>
        {filtered.length === 0 && (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "#9A8E82", fontSize: 12 }}>
            Aucun devis
          </div>
        )}
        {filtered.map((item, i) => {
          if (item.type === "group") {
            const cl = clients.find(c => c.id === (item.versions.find(v => v.client_id)?.client_id));
            return <DossierCard key={item.versions[0].id} versions={item.versions} cl={cl} goDevis={goDevis} onDelete={onDelete} onDuplicate={wrappedDuplicate} duplicatingIds={duplicatingIds}/>;
          }
          const cl = clients.find(c => c.id === item.d.client_id);
          return (
            <DevisRow key={item.d.id} d={item.d} cl={cl} goDevis={goDevis} onDelete={onDelete} onDuplicate={wrappedDuplicate} duplicating={duplicatingIds.has(item.d.id)}
              confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}/>
          );
        })}
      </div>
    </div>
  );
}
