import { useState, useRef } from "react";
import { CLAUDE_MODEL } from "../lib/constants.js";
import { uid, displayName, emptyClient } from "../lib/utils.js";
import ContactEditor from "./ContactEditor.jsx";

export default function ClientsList({ clients, onSave, onDelete, onRestore, goClient, showUndo }) {
  const [query,       setQuery]       = useState("");
  const [editing,     setEditing]     = useState(null);
  const [importing,   setImporting]   = useState(false);
  const [importError, setImportError] = useState("");
  const fileRef = useRef(null);

  const filtered = clients.filter(c => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [c.raison_sociale, c.nom, c.prenom, c.email, c.telephone, c.ville, c.siret, c.activite]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
  });

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setImportError("");
    setImporting(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      const [, mediaType, b64] = String(base64).match(/^data:([^;]+);base64,(.+)$/) || [];
      if (!b64) throw new Error("format_image");

      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 800,
          system: `Tu extrais les informations d'un contact BTP depuis une photo (carte de visite, capture d'écran, en-tête de courrier, annuaire Pappers, etc.).
Renvoie UNIQUEMENT un JSON valide entre <CONTACT></CONTACT>, sans texte autour.
Format strict :
{"type":"particulier|entreprise|artisan","raison_sociale":"","nom":"","prenom":"","email":"","telephone":"","telephone_fixe":"","adresse":"","code_postal":"","ville":"","siret":"","tva_intra":"","activite":""}
Règles :
- "type" : "artisan" ou "entreprise" si SIRET/raison sociale, sinon "particulier".
- Numéros français : format "06 XX XX XX XX" (mobile commence par 06/07, fixe par 01-05/09).
- Sépare "code_postal" (5 chiffres) de "ville".
- "activite" : description courte de l'activité (ex : "Maçonnerie générale et gros œuvre").
- Si un champ est illisible ou absent, laisse une chaîne vide "".`,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
              { type: "text",  text: "Extrais les informations de contact de cette image." },
            ],
          }],
        }),
      });
      if (!res.ok) throw new Error("api");
      const data = await res.json();
      const raw   = data.content?.[0]?.text || "";
      const match = raw.match(/<CONTACT>([\s\S]*?)<\/CONTACT>/) || raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("parse");
      const parsed = JSON.parse((match[1] || match[0]).trim());
      setEditing({ ...emptyClient(), ...parsed, id: uid() });
    } catch {
      setImportError("Impossible d'analyser l'image. Essayez une photo plus nette ou saisissez manuellement.");
    } finally {
      setImporting(false);
    }
  };

  const saveContact = async (c) => { await onSave(c); setEditing(null); };

  const deleteContact = async (id) => {
    const { victim, idx } = await onDelete(id);
    if (!victim) return;
    showUndo?.(`Contact "${displayName(victim)}" supprimé`, () => onRestore(victim, idx));
  };

  return (
    <div style={{ padding: 18 }} className="fu">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Contacts</h1>
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{clients.length} contact{clients.length > 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }}/>
        {importing ? (
          <div style={{ background: "#eef2ff", border: "1.5px solid #c7d2fe", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#4338ca", fontSize: 13, fontWeight: 600 }}>
            <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #c7d2fe", borderTopColor: "#4338ca", borderRadius: "50%", animation: "spin .8s linear infinite" }}/> Analyse en cours…
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            style={{ background: "#eef2ff", border: "1.5px solid #c7d2fe", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#4338ca", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}>
            📷 Importer une photo
          </button>
        )}
        <button onClick={() => setEditing(emptyClient())}
          style={{ background: "#0f172a", color: "white", border: "none", borderRadius: 14, padding: "12px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouveau contact
        </button>
        {importError && (
          <div style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>{importError}</div>
        )}
      </div>

      {/* Recherche */}
      <div style={{ marginBottom: 12, position: "relative" }}>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher nom, société, ville, email…"
          style={{ width: "100%", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 12, padding: "11px 14px 11px 36px", fontSize: 13, color: "#0f172a", outline: "none" }}/>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 14 }}>🔍</span>
      </div>

      {/* Liste */}
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        {filtered.length === 0 && (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Aucun contact trouvé</div>
        )}
        {filtered.map(c => (
          <div key={c.id} style={{ padding: "13px 16px", borderBottom: "1px solid #f8fafc", display: "flex", alignItems: "center", gap: 12 }}>
            <div onClick={() => goClient(c.id)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: c.type === "particulier" ? "#eff6ff" : "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: c.type === "particulier" ? "#1d4ed8" : "#b45309", fontSize: 15, flexShrink: 0 }}>
                {displayName(c).charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName(c)}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, flexShrink: 0, background: c.type === "particulier" ? "#dbeafe" : "#fef3c7", color: c.type === "particulier" ? "#1e40af" : "#92400e" }}>
                    {c.type === "particulier" ? "Particulier" : c.type === "artisan" ? "Artisan" : "Entreprise"}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[c.email, c.telephone, c.ville].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button onClick={() => setEditing(c)} aria-label="Modifier"
                style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 14, color: "#475569" }}>✏️</button>
              <button onClick={() => deleteContact(c.id)} aria-label="Supprimer"
                style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 14 }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {editing && <ContactEditor c={editing} onSave={saveContact} onClose={() => setEditing(null)}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
