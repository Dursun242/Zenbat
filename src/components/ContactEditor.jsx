import { useState } from "react";

// Composant champ de formulaire générique
function Field({ label, val, onChange, type = "text", placeholder = "" }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={val || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#0f172a", outline: "none", boxSizing: "border-box" }}
      />
    </div>
  );
}

export default function ContactEditor({ c, onSave, onClose }) {
  const [form, setForm] = useState(c);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isValid = form.raison_sociale?.trim() || form.nom?.trim() || form.prenom?.trim();

  return (
    <div style={{ position: "fixed", inset: 0, height: "100dvh", background: "rgba(15,23,42,.7)", zIndex: 999, display: "flex", flexDirection: "column", fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ flex: 1 }} onClick={onClose}/>
      <div style={{ background: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90dvh", display: "flex", flexDirection: "column" }}>

        <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
            {c.raison_sociale || c.nom ? "Modifier le contact" : "Nouveau contact"}
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, width: 32, height: 32, cursor: "pointer", fontSize: 14, color: "#64748b" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Type */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>TYPE</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[["particulier", "Particulier"], ["artisan", "Artisan"], ["entreprise", "Entreprise"]].map(([id, lbl]) => (
                <button key={id} onClick={() => set("type", id)}
                  style={{ flex: 1, padding: 8, borderRadius: 10, border: `1.5px solid ${form.type === id ? "#0f172a" : "#e2e8f0"}`, background: form.type === id ? "#0f172a" : "white", color: form.type === id ? "white" : "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

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
              <Field label="Activité" val={form.activite} onChange={v => set("activite", v)} placeholder="Ex : Maçonnerie générale et gros œuvre"/>
            </>
          )}

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>NOTES</label>
            <textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} rows={2}
              style={{ width: "100%", background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#0f172a", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}/>
          </div>
        </div>

        <div style={{ padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", borderTop: "1px solid #f1f5f9", display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
            Annuler
          </button>
          <button onClick={() => isValid && onSave(form)} disabled={!isValid}
            style={{ flex: 2, background: isValid ? "#22c55e" : "#cbd5e1", color: "white", border: "none", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, cursor: isValid ? "pointer" : "not-allowed" }}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
