// Liste des clients (système « Bordereau ») : recherche, création (à la
// main ou depuis une photo lue par l'IA), registre tracé.
import { useState, useRef, useMemo } from "react";
import { CLAUDE_MODEL } from "../lib/constants.js";
import { uid, displayName, emptyClient } from "../lib/utils.js";
import { ZB } from "../lib/theme.js";
import ContactEditor from "./ContactEditor.jsx";
import { getToken } from "../lib/getToken.js";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { LIST_CSS, ListHeader, Sheet, EmptyRow, LoadingRows, LoadErrorRow, RowMenu, btnPrimary, btnSecondary, SearchIcon, PlusIcon, CameraIcon } from "./ui/Register.jsx";

const TYPE_LABEL = { particulier: "Particulier", artisan: "Artisan", entreprise: "Entreprise" };


// loaded / loadError / onRetry : état du chargement de la liste (useClients).
export default function ClientsList({ clients, onSave, onDelete, onRestore, goClient, showUndo, loaded = true, loadError = null, onRetry }) {
  const [query,       setQuery]       = useState("");
  const [editing,     setEditing]     = useState(null);
  const [importing,   setImporting]   = useState(false);
  const [importError, setImportError] = useState("");
  const fileRef = useRef(null);

  // Debounce + memo : sur un compte avec 500+ clients, filtrer sur 8 champs
  // à chaque frappe produisait un lag perceptible. L'input reste réactif,
  // seul le filtre coûteux attend l'arrêt de frappe.
  const debouncedQuery = useDebouncedValue(query, 180);
  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      [c.raison_sociale, c.nom, c.prenom, c.email, c.telephone, c.ville, c.siret, c.activite]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    );
  }, [clients, debouncedQuery]);

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
      setImportError("Impossible de lire l'image. Essaie une photo plus nette, ou saisis le client à la main.");
    } finally {
      setImporting(false);
    }
  };

  const saveContact  = async (c) => { await onSave(c); setEditing(null); };
  const deleteContact = async (id) => {
    const { victim, idx } = await onDelete(id);
    if (!victim) return;
    showUndo?.(`Client « ${displayName(victim)} » supprimé`, () => onRestore(victim, idx));
  };

  return (
    <div className="zb-list" style={{ maxWidth: 960, margin: "0 auto", padding: "16px 12px 24px", fontFamily: ZB.font, color: ZB.ink }}>
      <style>{LIST_CSS + "@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <ListHeader count={loaded ? `${clients.length} client${clients.length > 1 ? "s" : ""}` : ""}/>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }}/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <button type="button" style={{ ...btnSecondary, padding: "0 10px", opacity: importing ? 0.7 : 1 }} disabled={importing} onClick={() => fileRef.current?.click()}>
          {importing
            ? <><span aria-hidden="true" style={{ width: 14, height: 14, border: `2px solid ${ZB.rule}`, borderTopColor: ZB.accent, borderRadius: "50%", animation: "spin .8s linear infinite" }}/> Lecture…</>
            : <>{CameraIcon} Depuis une photo</>}
        </button>
        <button type="button" className="zb-primary" style={{ ...btnPrimary, padding: "0 10px" }} onClick={() => setEditing(emptyClient())}>{PlusIcon} Nouveau client</button>
      </div>
      {importError && <p role="alert" style={{ margin: "0 0 12px", fontSize: 15, color: ZB.danger }}>{importError}</p>}

      <label style={{ position: "relative", display: "block", marginBottom: 12 }}>
        <span className="zb-sr">Rechercher un client</span>
        <span aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: ZB.ink3, display: "inline-flex" }}>{SearchIcon}</span>
        <input value={query} onChange={e => setQuery(e.target.value)} type="search"
          placeholder="Nom, société, ville, email…"
          style={{ width: "100%", boxSizing: "border-box", minHeight: 48, padding: "0 14px 0 42px", background: ZB.sheet, border: `1px solid ${ZB.field}`, borderRadius: 10,
            fontFamily: "inherit", fontSize: 16, color: ZB.ink }}/>
      </label>

      <Sheet>
        {!loaded && (loadError
          ? <LoadErrorRow message="Impossible de charger tes clients." onRetry={onRetry}/>
          : <LoadingRows label="Chargement de tes clients…"/>)}
        {loaded && filtered.length === 0 && (
          <EmptyRow>{clients.length === 0 ? "Aucun client pour l'instant. Ajoute-le à la main ou depuis une photo de sa carte." : "Aucun client ne correspond à ta recherche."}</EmptyRow>
        )}
        {loaded && filtered.map((c, i) => {
          const contactLine  = [c.email, c.telephone].filter(Boolean).join(" · ");
          const locationLine = [c.code_postal, c.ville].filter(Boolean).join(" ");
          const sub = [c.activite || contactLine, locationLine].filter(Boolean).join(" · ") || "Pas de coordonnées";
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 4, paddingRight: 4, borderBottom: i < filtered.length - 1 ? `1px solid ${ZB.ruleSoft}` : "none" }}>
              <button type="button" className="zb-row" onClick={() => goClient(c.id)} aria-label={`Ouvrir la fiche de ${displayName(c)}`}
                style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, minHeight: 64, padding: "10px 8px 10px 16px",
                  background: "none", border: "none", textAlign: "left", fontFamily: "inherit", color: ZB.ink, cursor: "pointer" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayName(c)}
                    {TYPE_LABEL[c.type] && <span style={{ fontWeight: 500, color: ZB.ink3 }}> · {TYPE_LABEL[c.type]}</span>}
                  </span>
                  <span style={{ display: "block", fontSize: 13, color: ZB.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>
                </span>
              </button>
              <RowMenu label={`Actions pour ${displayName(c)}`} items={[
                { key: "edit", label: "Modifier", onClick: () => setEditing(c) },
                { key: "del", label: "Supprimer", danger: true, confirmLabel: "Appuie encore pour supprimer", onClick: () => deleteContact(c.id) },
              ]}/>
            </div>
          );
        })}
      </Sheet>

      {editing && <ContactEditor c={editing} onSave={saveContact} onClose={() => setEditing(null)}/>}
    </div>
  );
}
