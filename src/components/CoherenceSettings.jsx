import { useState, useEffect } from "react";
import { getAllTypologies } from "../lib/coherence/engine.js";
import { loadUserCoherenceSettings, saveUserCoherenceSettings, DEFAULT_SETTINGS } from "../lib/coherence/userOverrides.js";
import { ZB, NUM } from "../lib/theme.js";
import { btnPrimary, btnSecondary } from "./ui/Register.jsx";
import { useModalGuard } from "../hooks/useModalGuard.js";

const CloseIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>;
const CheckIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>;

// Modale de configuration du moteur de cohérence.
// Permet à l'utilisateur d'ajuster ses fourchettes de prix par typologie
// ou de désactiver la vérification globalement / par catégorie.
export default function CoherenceSettings({ onClose, onSave }) {
  const [settings,  setSettings]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const allTypologies = getAllTypologies();

  // Échap, retour du téléphone : ferment comme le bouton ✕.
  useModalGuard(true, onClose);

  useEffect(() => {
    loadUserCoherenceSettings().then(s => setSettings(s));
  }, []);

  if (!settings) {
    return (
      <Backdrop onClose={onClose}>
        <div style={{ padding: 40, textAlign: "center", color: ZB.ink2, fontSize: 15 }}>Chargement…</div>
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
      <div style={{ padding: "6px 6px 6px 18px", borderBottom: `1px solid ${ZB.rule}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="coherence-title" style={{ margin: 0, fontSize: 19, fontWeight: 700, color: ZB.ink }}>Vérification des devis</h2>
          <div style={{ color: ZB.ink2, fontSize: 13, marginTop: 2 }}>Personnalise les règles du moteur de cohérence</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer"
          style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: "none", color: ZB.ink2, cursor: "pointer", flexShrink: 0 }}>
          {CloseIcon}
        </button>
      </div>

      <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
        {/* Toggle global */}
        <div style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "12px 8px 12px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div id="coherence-global" style={{ fontSize: 15, fontWeight: 700, color: ZB.ink }}>Vérification automatique</div>
            <div style={{ fontSize: 13, color: ZB.ink2, marginTop: 2, lineHeight: 1.4 }}>
              Zenbat analyse la cohérence de chaque devis généré et propose des corrections si nécessaire.
            </div>
          </div>
          <Toggle active={isActive} onChange={setGlobal} labelledBy="coherence-global" />
        </div>

        {isActive && (
          <>
            <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: ZB.ink }}>
              Fourchettes par catégorie
            </h3>

            <div style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8 }}>
            {allTypologies.map((t, i) => {
              const over = settings.typology_overrides[t.typology_id] || {};
              const env  = over.envelope || t.envelope || {};
              const isTypoActive = !over.disabled;
              const labelId = `coherence-typo-${t.typology_id}`;

              return (
                <div key={t.typology_id}
                  style={{ borderBottom: i < allTypologies.length - 1 ? `1px solid ${ZB.rule}` : "none", background: isTypoActive ? ZB.sheet : ZB.paper }}>

                  {/* Header de la typologie */}
                  <div style={{ padding: "8px 8px 8px 16px", display: "flex", alignItems: "center", gap: 10, minHeight: 56 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div id={labelId} style={{ fontSize: 15, fontWeight: 600, color: isTypoActive ? ZB.ink : ZB.ink2 }}>{t.label}</div>
                      <div style={{ fontSize: 13, color: ZB.ink2 }}>{t.pack_name}</div>
                    </div>
                    <Toggle active={isTypoActive} onChange={v => setTypologyField(t.typology_id, "disabled", !v)} small labelledBy={labelId} />
                  </div>

                  {/* Fourchette de prix */}
                  {isTypoActive && t.envelope && (
                    <div style={{ padding: "8px 16px 12px", borderTop: `1px solid ${ZB.ruleSoft}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, color: ZB.ink2, flexShrink: 0 }}>
                        Fourchette marché ({t.main_dimension?.unit}) :
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="number" min="0"
                          aria-label={`${t.label} : minimum`}
                          value={env.min_per_unit ?? t.envelope.min_per_unit}
                          onChange={e => setEnvelopeField(t.typology_id, "min_per_unit", e.target.value)}
                          style={inputStyle}
                        />
                        <span aria-hidden="true" style={{ fontSize: 14, color: ZB.ink2 }}>→</span>
                        <input
                          type="number" min="0"
                          aria-label={`${t.label} : maximum`}
                          value={env.max_per_unit ?? t.envelope.max_per_unit}
                          onChange={e => setEnvelopeField(t.typology_id, "max_per_unit", e.target.value)}
                          style={inputStyle}
                        />
                        <span style={{ fontSize: 14, color: ZB.ink2 }}>€/{t.main_dimension?.unit}</span>
                      </div>
                      {(env.min_per_unit !== t.envelope.min_per_unit || env.max_per_unit !== t.envelope.max_per_unit) && (
                        <button type="button" onClick={() => setEnvelopeField(t.typology_id, "min_per_unit", t.envelope.min_per_unit) || setEnvelopeField(t.typology_id, "max_per_unit", t.envelope.max_per_unit)}
                          style={{ minHeight: 44, fontSize: 14, fontWeight: 600, color: ZB.accent, background: "none", border: "none", cursor: "pointer", padding: "0 4px", fontFamily: "inherit" }}>
                          Réinitialiser
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 16px", paddingBottom: "max(10px, env(safe-area-inset-bottom))", borderTop: `1px solid ${ZB.rule}`, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: ZB.paper }}>
        <button type="button" onClick={handleReset}
          style={{ minHeight: 44, fontSize: 14, fontWeight: 600, color: ZB.ink2, background: "none", border: "none", cursor: "pointer", padding: "0 4px", fontFamily: "inherit" }}>
          Tout réinitialiser
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onClose} style={btnSecondary}>
          Annuler
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className="zb-coh-cta"
          style={{ ...btnPrimary, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saved ? <>{CheckIcon}Enregistré</> : saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </Backdrop>
  );
}

// ── Sous-composants ─────────────────────────────────────────────────────────

function Backdrop({ onClose, children }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(26,22,18,.55)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: ZB.font, color: ZB.ink }}>
      <style>{`
        .zb-coh button:focus-visible, .zb-coh input:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; }
        .zb-coh input:focus { border-color: ${ZB.accent} !important; }
        @media (hover: hover) { .zb-coh .zb-coh-cta:not(:disabled):hover { background: var(--zb-accent-hover) !important; } }
        @media (prefers-reduced-motion: reduce) { .zb-coh * { transition: none !important; } }
      `}</style>
      <div role="dialog" aria-modal="true" aria-labelledby="coherence-title" className="zb-coh"
        style={{ background: ZB.paper, borderRadius: "10px 10px 0 0", width: "100%", maxWidth: 560, maxHeight: "90dvh", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

// Interrupteur : cible de 44px, piste terre cuite quand il est actif.
function Toggle({ active, onChange, small, labelledBy }) {
  const w = small ? 40 : 46;
  const h = small ? 24 : 28;
  const knob = h - 4;
  return (
    <button type="button" role="switch" aria-checked={active} aria-labelledby={labelledBy} onClick={() => onChange(!active)}
      style={{ width: Math.max(44, w + 8), height: 44, display: "grid", placeItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
      <span style={{ position: "relative", display: "block", width: w, height: h, borderRadius: 99, background: active ? ZB.accent : ZB.rule, transition: "background .2s" }}>
        <span style={{ position: "absolute", top: 2, left: active ? w - knob - 2 : 2, width: knob, height: knob, borderRadius: "50%", background: ZB.sheet, transition: "left .2s" }} />
      </span>
    </button>
  );
}

const inputStyle = {
  width: 84, minHeight: 44, padding: "8px 10px", borderRadius: 8, border: `1px solid ${ZB.field}`,
  fontSize: 16, textAlign: "right", background: ZB.sheet, color: ZB.ink, outline: "none", fontFamily: "inherit", ...NUM,
};
