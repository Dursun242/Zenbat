import { useState } from "react";
import { UNITES, UNITE_ALIASES, TVA_RATES } from "../lib/constants.js";

const normalizeUnite = (v) => UNITE_ALIASES[v] || v || "u";
const UNITES_VALUES = new Set(UNITES.map(u => u.value));
import { fmt, uid } from "../lib/utils.js";

export default function LignesEditor({ lignes, onChange, ac, vatRegime, readOnly = false }) {
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  // Glisser-déposer souris : la ligne n'est rendue `draggable` que lorsque la
  // poignée est pressée (dragHandleId), sinon le drag piégerait la sélection de
  // texte dans les champs <input>. draggingId = ligne en cours de déplacement,
  // dragOverId = ligne actuellement survolée (pour le repère visuel de dépôt).
  const [dragHandleId, setDragHandleId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const franchise = vatRegime === "franchise";
  // En lecture seule (devis remplacé), onChange peut être absent : toutes
  // les mutations sont court-circuitées pour éviter un appel à undefined.
  const update = (id, patch) => { if (readOnly) return; onChange(lignes.map(l => l.id === id ? { ...l, ...patch } : l)); };
  const remove = (id) => { if (readOnly) return; onChange(lignes.filter(l => l.id !== id)); setConfirmRemoveId(null); };

  const move = (id, dir) => {
    if (readOnly) return;
    const i = lignes.findIndex(l => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= lignes.length) return;
    const arr = [...lignes];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  };

  // Déplace la ligne `fromId` à l'emplacement de `toId` (insertion à sa place).
  const reorder = (fromId, toId) => {
    if (readOnly || !fromId || fromId === toId) return;
    const from = lignes.findIndex(l => l.id === fromId);
    const to = lignes.findIndex(l => l.id === toId);
    if (from < 0 || to < 0) return;
    const arr = [...lignes];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onChange(arr);
  };

  const resetDrag = () => { setDragHandleId(null); setDraggingId(null); setDragOverId(null); };

  const addOuvrage = () => {
    if (readOnly) return;
    const lastLot = [...lignes].reverse().find(l => l.type_ligne === "lot");
    onChange([...lignes, {
      id: uid(), type_ligne: "ouvrage",
      designation: "Nouvelle prestation",
      lot: lastLot?.designation ? lastLot.designation.charAt(0) + lastLot.designation.slice(1).toLowerCase() : "Divers",
      unite: "u", quantite: 1, prix_unitaire: 0, tva_rate: franchise ? 0 : 20,
    }]);
  };

  const addLot = () => {
    if (readOnly) return;
    onChange([...lignes, { id: uid(), type_ligne: "lot", designation: "NOUVEAU LOT", lot: "" }]);
  };

  return (
    <div style={{ background: "white", borderRadius: 14, border: "1px solid #F0EBE3", overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #FAF7F2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#1A1612" }}>{readOnly ? "Lignes du devis" : "Modifier les lignes"}</div>
        <div style={{ fontSize: 10, color: "#9A8E82" }}>
          {lignes.filter(l => l.type_ligne === "ouvrage").length} prestation{lignes.filter(l => l.type_ligne === "ouvrage").length > 1 ? "s" : ""}
        </div>
      </div>

      {lignes.length === 0 && (
        <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 12, color: "#9A8E82" }}>
          Aucune ligne. Ajoutez un lot puis des prestations ci-dessous.
        </div>
      )}

      {lignes.map((l, idx) => (
        <div
          key={l.id}
          draggable={!readOnly && dragHandleId === l.id}
          onDragStart={(e) => { if (readOnly || dragHandleId !== l.id) { e.preventDefault(); return; } e.dataTransfer.effectAllowed = "move"; setDraggingId(l.id); }}
          onDragOver={(e) => { if (readOnly || !draggingId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverId !== l.id) setDragOverId(l.id); }}
          onDrop={(e) => { if (readOnly) return; e.preventDefault(); reorder(draggingId, l.id); resetDrag(); }}
          onDragEnd={resetDrag}
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid #FAF7F2",
            background: l.type_ligne === "lot" ? "#FAF7F2" : "white",
            opacity: draggingId === l.id ? 0.4 : 1,
            boxShadow: dragOverId === l.id && draggingId && draggingId !== l.id ? `inset 0 2px 0 ${ac}` : "none",
            transition: "box-shadow .1s",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            {!readOnly && (
              <span
                onMouseDown={() => setDragHandleId(l.id)}
                onMouseUp={() => { if (!draggingId) setDragHandleId(null); }}
                title="Glisser pour réordonner"
                style={{ cursor: draggingId === l.id ? "grabbing" : "grab", color: "#C4BAAE", fontSize: 13, lineHeight: 1, padding: "2px 2px", userSelect: "none" }}>⠿</span>
            )}
            <span style={{ fontSize: 9, fontWeight: 700, color: l.type_ligne === "lot" ? ac : "#9A8E82", letterSpacing: .5, textTransform: "uppercase" }}>
              {l.type_ligne === "lot" ? "LOT" : `Ligne ${idx + 1}`}
            </span>
            <div style={{ flex: 1 }}/>
            {!readOnly && (
              <>
                <button onClick={() => move(l.id, -1)} disabled={idx === 0}
                  style={{ background: "none", border: "none", color: idx === 0 ? "#cbd5e1" : "#6B6358", cursor: idx === 0 ? "default" : "pointer", fontSize: 13, padding: "2px 6px" }}>↑</button>
                <button onClick={() => move(l.id, 1)} disabled={idx === lignes.length - 1}
                  style={{ background: "none", border: "none", color: idx === lignes.length - 1 ? "#cbd5e1" : "#6B6358", cursor: idx === lignes.length - 1 ? "default" : "pointer", fontSize: 13, padding: "2px 6px" }}>↓</button>
                {confirmRemoveId === l.id ? (
                  <>
                    <button onClick={() => setConfirmRemoveId(null)}
                      style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 4, color: "#6B6358", cursor: "pointer", fontSize: 10, padding: "2px 6px", fontWeight: 600 }}>Annuler</button>
                    <button onClick={() => remove(l.id)}
                      style={{ background: "#dc2626", border: "none", borderRadius: 4, color: "white", cursor: "pointer", fontSize: 10, padding: "2px 7px", fontWeight: 700 }}>✓</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmRemoveId(l.id)}
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 15, padding: "2px 6px", fontWeight: 700 }}>×</button>
                )}
              </>
            )}
          </div>

          {l.type_ligne === "lot" ? (
            <input
              value={l.designation || ""}
              onChange={e => update(l.id, { designation: e.target.value.toUpperCase() })}
              placeholder="NOM DU LOT" disabled={readOnly}
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 700, letterSpacing: .3, color: "#1A1612", background: "white", boxSizing: "border-box" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                value={l.designation || ""}
                onChange={e => update(l.id, { designation: e.target.value })}
                placeholder="Désignation" disabled={readOnly}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#1A1612", boxSizing: "border-box" }}
              />
              <input
                value={l.lot || ""}
                onChange={e => update(l.id, { lot: e.target.value })}
                placeholder="Lot (ex. Plomberie)" disabled={readOnly}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#6B6358", boxSizing: "border-box" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#9A8E82", marginBottom: 2 }}>Qté</div>
                  <input type="number" inputMode="decimal" step="0.01" disabled={readOnly}
                    value={l.quantite ?? 0}
                    onChange={e => {
                      const v = Number(e.target.value);
                      // Négatifs autorisés (ex. ligne de remise / avoir). On ne
                      // garde que le filet anti-NaN : un champ vide ou non
                      // numérique retombe à 0 plutôt que de casser les totaux.
                      update(l.id, { quantite: Number.isFinite(v) ? v : 0 });
                    }}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 12, color: "#1A1612", boxSizing: "border-box" }}/>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#9A8E82", marginBottom: 2 }}>Unité</div>
                  <select
                    value={normalizeUnite(l.unite)} disabled={readOnly}
                    onChange={e => update(l.id, { unite: e.target.value })}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 4px", fontSize: 11, color: "#1A1612", background: "white", boxSizing: "border-box" }}>
                    {!UNITES_VALUES.has(normalizeUnite(l.unite)) && (
                      <option value={normalizeUnite(l.unite)}>{normalizeUnite(l.unite)}</option>
                    )}
                    {UNITES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#9A8E82", marginBottom: 2 }}>PU HT</div>
                  <input type="number" inputMode="decimal" step="0.01" disabled={readOnly}
                    value={l.prix_unitaire ?? 0}
                    onChange={e => {
                      const v = Number(e.target.value);
                      // Négatifs autorisés (ex. remise/avoir). Filet anti-NaN seul.
                      update(l.id, { prix_unitaire: Number.isFinite(v) ? v : 0 });
                    }}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 12, color: "#1A1612", boxSizing: "border-box" }}/>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#9A8E82", marginBottom: 2 }}>TVA</div>
                  {franchise ? (
                    <div title="Franchise en base (art. 293 B du CGI)"
                      style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 12, color: "#6B6358", background: "#FAF7F2", boxSizing: "border-box", textAlign: "center" }}>
                      0 %
                    </div>
                  ) : (
                    <select value={l.tva_rate ?? 20} disabled={readOnly} onChange={e => update(l.id, { tva_rate: Number(e.target.value) })}
                      style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 4px", fontSize: 12, color: "#1A1612", background: "white", boxSizing: "border-box" }}>
                      {TVA_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 11, color: "#6B6358" }}>
                Total HT : <b style={{ color: ac }}>{fmt((l.quantite || 0) * (l.prix_unitaire || 0))}</b>
              </div>
            </div>
          )}
        </div>
      ))}

      {!readOnly && (
        <div style={{ display: "flex", gap: 8, padding: 10, background: "#FAF7F2" }}>
          <button onClick={addOuvrage}
            style={{ flex: 1, background: "white", color: ac, border: `1px solid ${ac}55`, borderRadius: 10, padding: "9px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            + Ajouter prestation
          </button>
          <button onClick={addLot}
            style={{ flex: 1, background: "white", color: "#1A1612", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            + Ajouter lot
          </button>
        </div>
      )}
    </div>
  );
}
