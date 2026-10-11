import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { searchEntreprises } from "../lib/insee";
import { ZB } from "../lib/theme.js";

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: ZB.ink2, marginBottom: 6 };
const inputStyle = { width: "100%", minHeight: 44, background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "10px 12px", fontSize: 16, color: ZB.ink, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

// Composant champ de formulaire générique
function Field({ label, val, onChange, type = "text", placeholder = "" }) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        value={val || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </label>
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
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (saving || !isValid) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };
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
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(26,22,18,.55)", zIndex: 9999, fontFamily: ZB.font, color: ZB.ink }}>
      <style>{`.zb-contact input:focus, .zb-contact textarea:focus { border-color: ${ZB.accent} !important; } .zb-contact input::placeholder, .zb-contact textarea::placeholder { color: ${ZB.ink3}; opacity: 1; } .zb-contact button:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; }`}</style>
      <div role="dialog" aria-modal="true" aria-labelledby="contact-title" className="zb-contact" style={{
        position: "absolute", left: 0, right: 0, bottom: 0, margin: "0 auto", maxWidth: 640,
        maxHeight: "92dvh", height: "92dvh",
        background: ZB.paper,
        borderTopLeftRadius: 10, borderTopRightRadius: 10,
        display: "flex", flexDirection: "column",
      }}>

        <div style={{ padding: "6px 6px 6px 18px", borderBottom: `1px solid ${ZB.rule}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h2 id="contact-title" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>
            {c.raison_sociale || c.nom ? "Modifier le client" : "Nouveau client"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: "none", cursor: "pointer", color: ZB.ink2 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Type */}
          <div>
            <span style={labelStyle} id="contact-type">Type de client</span>
            <div role="radiogroup" aria-labelledby="contact-type" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[["particulier", "Particulier"], ["artisan", "Artisan"], ["entreprise", "Entreprise"]].map(([id, lbl]) => {
                const on = form.type === id;
                return (
                  <button key={id} type="button" role="radio" aria-checked={on} onClick={() => set("type", id)}
                    style={{ minHeight: 44, borderRadius: 8, border: `1px solid ${on ? ZB.accent : ZB.rule}`, background: on ? ZB.accentSoft : ZB.sheet, color: on ? ZB.accent : ZB.ink, fontFamily: "inherit", fontSize: 15, fontWeight: on ? 700 : 500, cursor: "pointer" }}>
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>

          {form.type !== "particulier" && (
            <div style={{ position: "relative" }}>
              <label htmlFor="contact-insee" style={labelStyle}>
                Retrouver l'entreprise (nom ou SIRET)
              </label>
              <input
                id="contact-insee"
                type="search"
                value={inseeQuery}
                onChange={e => setInseeQuery(e.target.value)}
                onFocus={() => inseeResults.length && setInseeOpen(true)}
                placeholder="Nom de l'entreprise ou SIRET"
                style={inputStyle}
              />
              {inseeLoading && (
                <div role="status" style={{ fontSize: 14, color: ZB.ink2, marginTop: 6 }}>Recherche…</div>
              )}
              {inseeError && (
                <div role="alert" style={{ fontSize: 14, color: ZB.danger, marginTop: 6 }}>{inseeError}</div>
              )}
              {inseeOpen && inseeResults.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 10, boxShadow: "0 10px 30px rgba(26,22,18,.16)", zIndex: 50, maxHeight: 280, overflowY: "auto" }}>
                  {inseeResults.map((r, i) => (
                    <button
                      key={`${r.siret}-${i}`}
                      type="button"
                      onClick={() => pickInseeResult(r)}
                      style={{ display: "block", width: "100%", minHeight: 52, textAlign: "left", background: "none", border: "none", borderBottom: i < inseeResults.length - 1 ? `1px solid ${ZB.ruleSoft}` : "none", padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 15 }}
                    >
                      <div style={{ fontWeight: 600, color: ZB.ink, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span>{r._display.label}</span>
                        {r._display.etat && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: ZB.danger, border: `1px solid ${ZB.danger}`, padding: "0 5px", borderRadius: 3, textTransform: "uppercase", letterSpacing: ".04em" }}>{r._display.etat}</span>
                        )}
                      </div>
                      {r._display.sub && (
                        <div style={{ color: ZB.ink2, fontSize: 13, marginTop: 2 }}>{r._display.sub}</div>
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

          <Field label="Email" type="email" val={form.email} onChange={v => set("email", v)} placeholder="Ex : contact@exemple.fr"/>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Mobile" type="tel" val={form.telephone}       onChange={v => set("telephone", v)}       placeholder="Ex : 06 12 34 56 78"/>
            <Field label="Fixe"   type="tel" val={form.telephone_fixe} onChange={v => set("telephone_fixe", v)}  placeholder="Ex : 02 35 00 00 00"/>
          </div>

          <Field label="Adresse" val={form.adresse} onChange={v => set("adresse", v)} placeholder="Ex : 12 rue des Artisans"/>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
            <Field label="Code postal" val={form.code_postal} onChange={v => set("code_postal", v)} placeholder="Ex : 76600"/>
            <Field label="Ville"       val={form.ville}       onChange={v => set("ville", v)}       placeholder="Ex : Le Havre"/>
          </div>

          {form.type !== "particulier" && (
            <>
              <Field label="SIRET" val={form.siret} onChange={v => set("siret", v)} placeholder="14 chiffres"/>
              <Field label="N° TVA intracommunautaire" val={form.tva_intra} onChange={v => set("tva_intra", v)} placeholder="Ex : FR12345678901"/>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                <Field label="Code NAF/APE" val={form.naf} onChange={v => set("naf", v)} placeholder="Ex : 43.32A"/>
                <Field label="Activité" val={form.activite} onChange={v => set("activite", v)} placeholder="Ex : Travaux de menuiserie bois et PVC"/>
              </div>
            </>
          )}

          <div>
            <label htmlFor="contact-notes" style={labelStyle}>Notes</label>
            <textarea id="contact-notes" value={form.notes || ""} onChange={e => set("notes", e.target.value)} rows={2}
              style={{ ...inputStyle, resize: "vertical" }}/>
          </div>
        </div>

        {!isValid && (
          <p style={{ margin: 0, padding: "8px 16px 0", fontSize: 14, color: ZB.ink2, flexShrink: 0 }}>
            {form.type === "particulier" ? "Indique au moins le nom ou le prénom." : "Indique au moins la raison sociale ou un nom."}
          </p>
        )}
        <div style={{ padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", borderTop: isValid ? `1px solid ${ZB.rule}` : "none", display: "flex", gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, minHeight: 48, background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 10, fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: ZB.ink, cursor: "pointer" }}>
            Annuler
          </button>
          <button type="button" onClick={handleSave} disabled={!isValid || saving}
            style={{ flex: 2, minHeight: 48, background: ZB.accent, color: ZB.sheet, border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 15, fontWeight: 700, opacity: (isValid && !saving) ? 1 : 0.5, cursor: (isValid && !saving) ? "pointer" : "not-allowed" }}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
