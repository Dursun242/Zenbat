import { useState, useEffect } from "react";
import { getAllTypologies } from "../lib/coherence/engine.js";
import { loadUserCoherenceSettings, saveUserCoherenceSettings, DEFAULT_SETTINGS } from "../lib/coherence/userOverrides.js";

// Modale de configuration du moteur de cohérence.
// Permet à l'utilisateur d'ajuster ses fourchettes de prix par typologie
// ou de désactiver la vérification globalement / par catégorie.
export default function CoherenceSettings({ onClose, onSave }) {
  const [settings,  setSettings]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const allTypologies = getAllTypologies();

  useEffect(() => {
    loadUserCoherenceSettings().then(s => setSettings(s));
  }, []);

  if (!settings) {
    return (
      <Backdrop onClose={onClose}>
        <div style={{ padding: 40, textAlign: "center", color: "#9A8E82", fontSize: 13 }}>Chargement…</div>
      </Backdrop>
    );
  }

  const setGlobal = (val) => setSettings(s => ({ ...s, global_disabled: !val }));

  const setTypologyField = (typologyId, field, value) => {
    setSettings(s => ({
      ...s,
      typology_overrides: {
        ...s.typology_overrides,
        [typologyId]: {
          ...(s.typology_overrides[typologyId] || {}),
          [field]: value,
        },
      },
    }));
  };

  const setEnvelopeField = (typologyId, field, value) => {
    const current = settings.typology_overrides[typologyId] || {};
    const baseEnvelope = allTypologies.find(t => t.typology_id === typologyId)?.envelope || {};
    setSettings(s => ({
      ...s,
      typology_overrides: {
        ...s.typology_overrides,
        [typologyId]: {
          ...current,
          envelope: {
            ...(current.envelope || baseEnvelope),
            [field]: value === "" ? undefined : Number(value),
          },
        },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveUserCoherenceSettings(settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSave?.(settings);
  };

  const handleReset = () => setSettings({ ...DEFAULT_SETTINGS });

  const isActive = !settings.global_disabled;

  return (
    <Backdrop onClose={onClose}>
      {/* En-tête */}
      <div style={{ background: "#1A1612", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: 14 }}>Vérification des devis</div>
          <div style={{ color: "#9A8E82", fontSize: 10 }}>Personnalisez les règles du moteur de cohérence</div>
        </div>
        <button onClick={onClose}
          style={{ background: "none", border: "none", color: "#9A8E82", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
          ✕
        </button>
      </div>

      <div style={{ padding: "16px 18px", overflowY: "auto", flex: 1 }}>
        {/* Toggle global */}
        <div style={{ background: "white", borderRadius: 12, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1612" }}>Vérification automatique</div>
            <div style={{ fontSize: 11, color: "#9A8E82", marginTop: 2 }}>
              Zenbat analyse la cohérence de chaque devis généré et propose des corrections si nécessaire.
            </div>
          </div>
          <Toggle active={isActive} onChange={setGlobal} />
        </div>

        {isActive && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9A8E82", letterSpacing: "1px", marginBottom: 10 }}>
              FOURCHETTES PAR CATÉGORIE
            </div>

            {allTypologies.map(t => {
              const over = settings.typology_overrides[t.typology_id] || {};
              const env  = over.envelope || t.envelope || {};
              const isTypoActive = !over.disabled;

              return (
                <div key={t.typology_id}
                  style={{ background: "white", borderRadius: 12, marginBottom: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.05)", opacity: isTypoActive ? 1 : 0.5 }}>

                  {/* Header de la typologie */}
                  <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, background: isTypoActive ? "white" : "#FAF7F2" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1612" }}>{t.label}</div>
                      <div style={{ fontSize: 10, color: "#9A8E82" }}>{t.pack_name}</div>
                    </div>
                    <Toggle active={isTypoActive} onChange={v => setTypologyField(t.typology_id, "disabled", !v)} small />
                  </div>

                  {/* Fourchette de prix */}
                  {isTypoActive && t.envelope && (
                    <div style={{ padding: "10px 14px", borderTop: "1px solid #F0EBE3", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#6B6358", flexShrink: 0 }}>
                        Fourchette marché ({t.main_dimension?.unit}) :
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="number" min="0"
                          value={env.min_per_unit ?? t.envelope.min_per_unit}
                          onChange={e => setEnvelopeField(t.typology_id, "min_per_unit", e.target.value)}
                          style={inputStyle}
                        />
                        <span style={{ fontSize: 11, color: "#9A8E82" }}>→</span>
                        <input
                          type="number" min="0"
                          value={env.max_per_unit ?? t.envelope.max_per_unit}
                          onChange={e => setEnvelopeField(t.typology_id, "max_per_unit", e.target.value)}
                          style={inputStyle}
                        />
                        <span style={{ fontSize: 11, color: "#9A8E82" }}>€/{t.main_dimension?.unit}</span>
                      </div>
                      {(env.min_per_unit !== t.envelope.min_per_unit || env.max_per_unit !== t.envelope.max_per_unit) && (
                        <button onClick={() => setEnvelopeField(t.typology_id, "min_per_unit", t.envelope.min_per_unit) || setEnvelopeField(t.typology_id, "max_per_unit", t.envelope.max_per_unit)}
                          style={{ fontSize: 10, color: "#9A8E82", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                          Réinitialiser
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 18px", borderTop: "1px solid #F0EBE3", display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={handleReset}
          style={{ fontSize: 11, color: "#9A8E82", background: "none", border: "none", cursor: "pointer", padding: "6px 0", textDecoration: "underline" }}>
          Tout réinitialiser
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={onClose}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E8E2D8", background: "white", fontSize: 12, cursor: "pointer", color: "#6B6358" }}>
          Annuler
        </button>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "8px 18px", borderRadius: 8, background: "#1A1612", color: "white", border: "none", fontSize: 12, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
          {saved ? "✓ Enregistré" : saving ? "…" : "Enregistrer"}
        </button>
      </div>
    </Backdrop>
  );
}

// ── Sous-composants ─────────────────────────────────────────────────────────

function Backdrop({ onClose, children }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#FAF7F2", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 560, maxHeight: "90dvh", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

function Toggle({ active, onChange, small }) {
  const size = small ? 36 : 44;
  return (
    <button onClick={() => onChange(!active)}
      style={{ width: size, height: small ? 22 : 26, borderRadius: 99, background: active ? "#22c55e" : "#D1C9BE", border: "none", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background .2s" }}>
      <span style={{ position: "absolute", top: 2, left: active ? (size - (small ? 18 : 22)) : 2, width: small ? 18 : 22, height: small ? 18 : 22, borderRadius: "50%", background: "white", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
    </button>
  );
}

const inputStyle = {
  width: 70, padding: "4px 8px", borderRadius: 6, border: "1px solid #E8E2D8",
  fontSize: 12, textAlign: "right", background: "white", outline: "none",
};
