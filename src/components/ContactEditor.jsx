import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { searchEntreprises } from "../lib/insee";

// Composant champ de formulaire générique
function Field({ label, val, onChange, type = "text", placeholder = "" }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B6358", marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={val || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", background: "white", border: "1px solid #E8E2D8", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#1A1612", outline: "none", boxSizing: "border-box" }}
      />
    </div>
  );
}

export default function ContactEditor({ c, onSave, onClose }) {
  const [form, setForm] = useState(c);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isValid = form.raison_sociale?.trim() || form.nom?.trim() || form.prenom?.trim();

  // Recherche INSEE (recherche-entreprises.api.gouv.fr) — uniquement pour entreprise/artisan.
  const [inseeQuery, setInseeQuery] = useState("");
  const [inseeResults, setInseeResults] = useState([]);
  const [inseeLoading, setInseeLoading] = useState(false);
  const [inseeError, setInseeError] = useState(null);
  const [inseeOpen, setInseeOpen] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    if (form.type === "particulier") return;
    const q = inseeQuery.trim();
    if (q.length < 3) {
      setInseeResults([]);
      setInseeError(null);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setInseeLoading(true);
      setInseeError(null);
      try {
        const list = await searchEntreprises(q, { signal: ctrl.signal });
        setInseeResults(list);
        setInseeOpen(true);
      } catch (e) {
        if (e.name === "AbortError") return;
        setInseeError(e.message || "Erreur INSEE");
        setInseeResults([]);
      } finally {
        setInseeLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [inseeQuery, form.type]);

  function pickInseeResult(r) {
    setForm(f => ({
      ...f,
      raison_sociale: r.raison_sociale || f.raison_sociale,
      siret: r.siret || f.siret,
      tva_intra: r.tva_intra || f.tva_intra,
      adresse: r.adresse || f.adresse,
      code_postal: r.code_postal || f.code_postal,
      ville: r.ville || f.ville,
      naf: r.naf || f.naf,
      activite: r.activite || f.activite,
    }));
    setInseeQuery("");
    setInseeResults([]);
    setInseeOpen(false);
  }

  return createPortal(
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,.7)", zIndex: 9999, fontFamily: "'DM Sans',sans-serif" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }}/>
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        maxHeight: "92dvh", height: "92dvh",
        background: "white",
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        display: "flex", flexDirection: "column",
      }}>

        <div style={{ padding: "14px 18px", borderBottom: "1px solid #F0EBE3", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1612" }}>
            {c.raison_sociale || c.nom ? "Modifier le contact" : "Nouveau contact"}
          </div>
          <button onClick={onClose} style={{ background: "#F0EBE3", border: "none", borderRadius: 10, width: 32, height: 32, cursor: "pointer", fontSize: 14, color: "#6B6358" }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Type */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B6358", marginBottom: 6 }}>TYPE</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[["particulier", "Particulier"], ["artisan", "Artisan"], ["entreprise", "Entreprise"]].map(([id, lbl]) => (
                <button key={id} onClick={() => set("type", id)}
                  style={{ flex: 1, padding: 8, borderRadius: 10, border: `1.5px solid ${form.type === id ? "#1A1612" : "#E8E2D8"}`, background: form.type === id ? "#1A1612" : "white", color: form.type === id ? "white" : "#6B6358", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {form.type !== "particulier" && (
            <div style={{ position: "relative" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B6358", marginBottom: 6 }}>
                RECHERCHE INSEE (NOM OU SIRET)
              </label>
              <input
                type="text"
                value={inseeQuery}
                onChange={e => setInseeQuery(e.target.value)}
                onFocus={() => inseeResults.length && setInseeOpen(true)}
                placeholder="Ex : Dupont Maçonnerie ou 12345678900010"
                style={{ width: "100%", background: "white", border: "1px solid #E8E2D8", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#1A1612", outline: "none", boxSizing: "border-box" }}
              />
              {inseeLoading && (
                <div style={{ fontSize: 11, color: "#6B6358", marginTop: 4 }}>Recherche…</div>
              )}
              {inseeError && (
                <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{inseeError}</div>
              )}
              {inseeOpen && inseeResults.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "white", border: "1px solid #E8E2D8", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.08)", zIndex: 50, maxHeight: 240, overflowY: "auto" }}>
                  {inseeResults.map((r, i) => (
                    <button
                      key={`${r.siret}-${i}`}
                      type="button"
                      onClick={() => pickInseeResult(r)}
                      style={{ display: "block", width: "100%", textAlign: "left", background: "white", border: "none", borderBottom: i < inseeResults.length - 1 ? "1px solid #F0EBE3" : "none", padding: "10px 12px", cursor: "pointer", fontSize: 12 }}
                    >
                      <div style={{ fontWeight: 600, color: "#1A1612", display: "flex", gap: 6, alignItems: "center" }}>
                        <span>{r._display.label}</span>
                        {r._display.etat && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", background: "#fee2e2", padding: "1px 6px", borderRadius: 6 }}>{r._display.etat}</span>
                        )}
                      </div>
                      {r._display.sub && (
                        <div style={{ color: "#6B6358", marginTop: 2 }}>{r._display.sub}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {form.type !== "particulier" && (
            <Field label="Raison sociale *" val={form.raison_sociale} onChange={v => set("raison_sociale", v)} placeholder="Ex : Dupont Maçonnerie SAS"/>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={form.type === "particulier" ? "Prénom *" : "Prénom contact"} val={form.prenom} onChange={v => set("prenom", v)}/>
            <Field label={form.type === "particulier" ? "Nom *"    : "Nom contact"}    val={form.nom}    onChange={v => set("nom", v)}/>
          </div>

          <Field label="Email" type="email" val={form.email} onChange={v => set("email", v)} placeholder="contact@exemple.fr"/>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Mobile" type="tel" val={form.telephone}       onChange={v => set("telephone", v)}       placeholder="06 12 34 56 78"/>
            <Field label="Fixe"   type="tel" val={form.telephone_fixe} onChange={v => set("telephone_fixe", v)}  placeholder="02 35 00 00 00"/>
          </div>

          <Field label="Adresse" val={form.adresse} onChange={v => set("adresse", v)} placeholder="12 rue des Artisans"/>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
            <Field label="Code postal" val={form.code_postal} onChange={v => set("code_postal", v)} placeholder="76600"/>
            <Field label="Ville"       val={form.ville}       onChange={v => set("ville", v)}       placeholder="Le Havre"/>
          </div>

          {form.type !== "particulier" && (
            <>
              <Field label="SIRET" val={form.siret} onChange={v => set("siret", v)} placeholder="12345678900010"/>
              <Field label="N° TVA intracommunautaire" val={form.tva_intra} onChange={v => set("tva_intra", v)} placeholder="FR12345678901"/>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                <Field label="Code NAF/APE" val={form.naf} onChange={v => set("naf", v)} placeholder="43.32A"/>
                <Field label="Activité" val={form.activite} onChange={v => set("activite", v)} placeholder="Ex : Travaux de menuiserie bois et PVC"/>
              </div>
            </>
          )}

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B6358", marginBottom: 6 }}>NOTES</label>
            <textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} rows={2}
              style={{ width: "100%", background: "white", border: "1px solid #E8E2D8", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#1A1612", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}/>
          </div>
        </div>

        <div style={{ padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", borderTop: "1px solid #F0EBE3", display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: "white", border: "1px solid #E8E2D8", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, color: "#6B6358", cursor: "pointer" }}>
            Annuler
          </button>
          <button onClick={() => isValid && onSave(form)} disabled={!isValid}
            style={{ flex: 2, background: isValid ? "#22c55e" : "#cbd5e1", color: "white", border: "none", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, cursor: isValid ? "pointer" : "not-allowed" }}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
