import { useState, useRef } from "react";
import { CLAUDE_MODEL } from "../lib/constants.js";
import { uid, displayName, emptyClient } from "../lib/utils.js";
import ContactEditor from "./ContactEditor.jsx";
import { getToken } from "../lib/getToken.js";

const TYPE_STYLE = {
  particulier: { bg: "#eff6ff", color: "#1e40af", label: "Particulier", avatarBg: "#dbeafe", avatarColor: "#1d4ed8" },
  artisan:     { bg: "#f0fdf4", color: "#166534", label: "Artisan",     avatarBg: "#bbf7d0", avatarColor: "#15803d" },
  entreprise:  { bg: "#fef3c7", color: "#92400e", label: "Entreprise",  avatarBg: "#fde68a", avatarColor: "#b45309" },
};

function initials(c) {
  const name = displayName(c).trim();
  const words = name.split(/\s+/).filter(w => /\w/.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

export default function ClientsList({ clients, onSave, onDelete, onRestore, goClient, showUndo }) {
  const [query,       setQuery]       = useState("");
  const [editing,     setEditing]     = useState(null);
  const [importing,   setImporting]   = useState(false);
  const [importError, setImportError] = useState("");
  const [openMenu,    setOpenMenu]    = useState(null);
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

      const token = await getToken();
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

  const saveContact  = async (c) => { await onSave(c); setEditing(null); };
  const deleteContact = async (id) => {
    const { victim, idx } = await onDelete(id);
    if (!victim) return;
    showUndo?.(`Contact "${displayName(victim)}" supprimé`, () => onRestore(victim, idx));
  };

  return (
    <div style={{ padding: 18 }} className="fu">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1A1612", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.3px" }}>Contacts</h1>
          <p style={{ color: "#9A8E82", fontSize: 12, marginTop: 2 }}>{clients.length} contact{clients.length > 1 ? "s" : ""}</p>
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
          style={{ background: "#1A1612", color: "white", border: "none", borderRadius: 14, padding: "12px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
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
          style={{ width: "100%", background: "#F0EBE3", border: "1px solid #E8E2D8", borderRadius: 12, padding: "11px 14px 11px 36px", fontSize: 13, color: "#1A1612", outline: "none" }}/>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9A8E82", fontSize: 14 }}>🔍</span>
      </div>

      {/* Liste */}
      <div style={{ background: "white", borderRadius: 16, border: "1px solid #F0EBE3", overflow: "hidden" }}
        onClick={() => setOpenMenu(null)}>
        {filtered.length === 0 && (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "#9A8E82", fontSize: 12 }}>Aucun contact trouvé</div>
        )}
        {filtered.map((c, i) => {
          const ts = TYPE_STYLE[c.type] || TYPE_STYLE.particulier;
          const contactLine = [c.email, c.telephone].filter(Boolean).join(" · ");
          const locationLine = [c.code_postal, c.ville].filter(Boolean).join(" ");
          return (
            <div key={c.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #FAF7F2" : "none", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px 13px 16px", position: "relative" }}>

              {/* Avatar */}
              <div onClick={() => goClient(c.id)}
                style={{ width: 46, height: 46, borderRadius: 14, background: ts.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: ts.avatarColor, fontSize: 15, flexShrink: 0, cursor: "pointer", letterSpacing: "-0.5px" }}>
                {initials(c)}
              </div>

              {/* Infos */}
              <div onClick={() => goClient(c.id)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayName(c)}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, flexShrink: 0, background: ts.bg, color: ts.color }}>
                    {ts.label}
                  </span>
                </div>
                {c.activite && (
                  <div style={{ fontSize: 11, color: "#6B6358", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.activite}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#9A8E82", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {contactLine || locationLine || "—"}
                  {contactLine && locationLine && <span style={{ color: "#C8BFB5" }}> · {locationLine}</span>}
                </div>
              </div>

              {/* Menu ⋯ */}
              <div style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)}
                  style={{ background: openMenu === c.id ? "#F0EBE3" : "transparent", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, color: "#9A8E82", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  ···
                </button>
                {openMenu === c.id && (
                  <div style={{ position: "absolute", right: 0, top: 36, background: "white", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)", border: "1px solid #F0EBE3", zIndex: 20, minWidth: 150, overflow: "hidden" }}>
                    <button onClick={() => { setEditing(c); setOpenMenu(null); }}
                      style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", fontSize: 13, fontWeight: 500, color: "#1A1612", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                      ✏️ Modifier
                    </button>
                    <div style={{ height: 1, background: "#F0EBE3" }}/>
                    <button onClick={() => { deleteContact(c.id); setOpenMenu(null); }}
                      style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", fontSize: 13, fontWeight: 500, color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                      🗑️ Supprimer
                    </button>
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {editing && <ContactEditor c={editing} onSave={saveContact} onClose={() => setEditing(null)}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
