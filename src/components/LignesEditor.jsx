import { UNITES, TVA_RATES } from "../lib/constants.js";
import { fmt, uid } from "../lib/utils.js";

export default function LignesEditor({ lignes, onChange, ac, vatRegime }) {
  const franchise = vatRegime === "franchise";
  const update = (id, patch) => onChange(lignes.map(l => l.id === id ? { ...l, ...patch } : l));
  const remove = (id) => { if (confirm("Supprimer cette ligne ?")) onChange(lignes.filter(l => l.id !== id)); };

  const move = (id, dir) => {
    const i = lignes.findIndex(l => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= lignes.length) return;
    const arr = [...lignes];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  };

  const addOuvrage = () => {
    const lastLot = [...lignes].reverse().find(l => l.type_ligne === "lot");
    onChange([...lignes, {
      id: uid(), type_ligne: "ouvrage",
      designation: "Nouvelle prestation",
      lot: lastLot?.designation ? lastLot.designation.charAt(0) + lastLot.designation.slice(1).toLowerCase() : "Divers",
      unite: "u", quantite: 1, prix_unitaire: 0, tva_rate: franchise ? 0 : 20,
    }]);
  };

  const addLot = () => {
    onChange([...lignes, { id: uid(), type_ligne: "lot", designation: "NOUVEAU LOT", lot: "" }]);
  };

  return (
    <div style={{ background: "white", borderRadius: 14, border: "1px solid #F0EBE3", overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #FAF7F2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#1A1612" }}>Modifier les lignes</div>
        <div style={{ fontSize: 10, color: "#9A8E82" }}>
          {lignes.filter(l => l.type_ligne === "ouvrage").length} ouvrage{lignes.filter(l => l.type_ligne === "ouvrage").length > 1 ? "s" : ""}
        </div>
      </div>

      {lignes.length === 0 && (
        <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 12, color: "#9A8E82" }}>
          Aucune ligne. Ajoutez un lot puis des ouvrages ci-dessous.
        </div>
      )}

      {lignes.map((l, idx) => (
        <div key={l.id} style={{ padding: "10px 12px", borderBottom: "1px solid #FAF7F2", background: l.type_ligne === "lot" ? "#FAF7F2" : "white" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: l.type_ligne === "lot" ? ac : "#9A8E82", letterSpacing: .5, textTransform: "uppercase" }}>
              {l.type_ligne === "lot" ? "LOT" : `Ligne ${idx + 1}`}
            </span>
            <div style={{ flex: 1 }}/>
            <button onClick={() => move(l.id, -1)} disabled={idx === 0}
              style={{ background: "none", border: "none", color: idx === 0 ? "#cbd5e1" : "#6B6358", cursor: idx === 0 ? "default" : "pointer", fontSize: 13, padding: "2px 6px" }}>↑</button>
            <button onClick={() => move(l.id, 1)} disabled={idx === lignes.length - 1}
              style={{ background: "none", border: "none", color: idx === lignes.length - 1 ? "#cbd5e1" : "#6B6358", cursor: idx === lignes.length - 1 ? "default" : "pointer", fontSize: 13, padding: "2px 6px" }}>↓</button>
            <button onClick={() => remove(l.id)}
              style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 15, padding: "2px 6px", fontWeight: 700 }}>×</button>
          </div>

          {l.type_ligne === "lot" ? (
            <input
              value={l.designation || ""}
              onChange={e => update(l.id, { designation: e.target.value.toUpperCase() })}
              placeholder="NOM DU LOT"
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 700, letterSpacing: .3, color: "#1A1612", background: "white", boxSizing: "border-box" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                value={l.designation || ""}
                onChange={e => update(l.id, { designation: e.target.value })}
                placeholder="Désignation"
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#1A1612", boxSizing: "border-box" }}
              />
              <input
                value={l.lot || ""}
                onChange={e => update(l.id, { lot: e.target.value })}
                placeholder="Lot (ex. Plomberie)"
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#6B6358", boxSizing: "border-box" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#9A8E82", marginBottom: 2 }}>Qté</div>
                  <input type="number" inputMode="decimal" step="0.01"
                    value={l.quantite ?? 0}
                    onChange={e => update(l.id, { quantite: Number(e.target.value) })}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 12, color: "#1A1612", boxSizing: "border-box" }}/>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#9A8E82", marginBottom: 2 }}>Unité</div>
                  <select value={l.unite || "u"} onChange={e => update(l.id, { unite: e.target.value })}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 4px", fontSize: 12, color: "#1A1612", background: "white", boxSizing: "border-box" }}>
                    {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#9A8E82", marginBottom: 2 }}>PU HT</div>
                  <input type="number" inputMode="decimal" step="0.01"
                    value={l.prix_unitaire ?? 0}
                    onChange={e => update(l.id, { prix_unitaire: Number(e.target.value) })}
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
                    <select value={l.tva_rate ?? 20} onChange={e => update(l.id, { tva_rate: Number(e.target.value) })}
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

      <div style={{ display: "flex", gap: 8, padding: 10, background: "#FAF7F2" }}>
        <button onClick={addOuvrage}
          style={{ flex: 1, background: "white", color: ac, border: `1px solid ${ac}55`, borderRadius: 10, padding: "9px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          + Ajouter ouvrage
        </button>
        <button onClick={addLot}
          style={{ flex: 1, background: "white", color: "#1A1612", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          + Ajouter lot
        </button>
      </div>
    </div>
  );
}
