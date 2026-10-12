import { useState } from "react";
import { ZB } from "../lib/theme.js";
import { btnPrimary, btnSecondary } from "../components/ui/Register.jsx";
import { Logo, FORM_CSS, inputStyle, labelStyle } from "../components/onboarding/shared.jsx";

export default function AuthScreen({ onEnter }) {
  const [mode,      setMode]      = useState("login");
  const [siret,     setSiret]     = useState("");
  const [company,   setCompany]   = useState(null);
  const [searching, setSearching] = useState(false);
  // Message affiché sous le champ SIRET (pas de fenêtre système).
  const [siretMsg,  setSiretMsg]  = useState(null);

  const searchPappers = async () => {
    if (siret.length < 9) return;
    setSearching(true);
    setSiretMsg(null);
    try {
      const res = await fetch(`https://suggestions.pappers.fr/v2?q=${siret}&cibles=siret`);
      const data = await res.json();
      const r = data?.resultats_siret?.[0];
      if (r) {
        setCompany({
          nom:      r.nom_entreprise || r.siege?.nom_entreprise || "",
          ville:    r.siege?.ville || "",
          siret:    r.siege?.siret || siret,
          activite: r.libelle_code_naf || "",
        });
      } else {
        setCompany(null);
        setSiretMsg("SIRET introuvable. Vérifie le numéro ou renseigne ton entreprise manuellement lors de l'inscription.");
      }
    } catch {
      setCompany(null);
      setSiretMsg("Impossible de contacter l'API. Renseigne ton entreprise manuellement lors de l'inscription.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="zb-form" style={{ minHeight: "100vh", background: ZB.paper, color: ZB.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: ZB.font }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}${FORM_CSS}`}</style>

      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ marginBottom: 8 }}><Logo size={36}/></div>
          <p style={{ color: ZB.ink2, fontSize: 14 }}>Devis BTP · Simple · Rapide · Professionnel</p>
        </div>

        <div style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "8px 20px 20px" }}>
          {/* Onglets soulignés */}
          <div role="tablist" style={{ display: "flex", borderBottom: `1px solid ${ZB.rule}`, marginBottom: 18 }}>
            {[["login", "Se connecter"], ["signup", "Créer un compte"]].map(([m, l]) => {
              const on = mode === m;
              return (
                <button key={m} type="button" role="tab" aria-selected={on} onClick={() => setMode(m)}
                  style={{ flex: 1, minHeight: 48, background: "none", border: "none", borderBottom: `2px solid ${on ? ZB.accent : "transparent"}`, marginBottom: -1, fontFamily: "inherit", fontSize: 15, fontWeight: on ? 700 : 500, color: on ? ZB.ink : ZB.ink2, cursor: "pointer" }}>
                  {l}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "signup" && (
              <div>
                <label htmlFor="auth-siret" style={labelStyle}>SIRET — Identification Pappers</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input id="auth-siret" value={siret} onChange={e => setSiret(e.target.value.replace(/\D/g, ""))} placeholder="14 chiffres" maxLength={14} inputMode="numeric"
                    style={{ ...inputStyle, flex: 1, minWidth: 0, fontVariantNumeric: "tabular-nums" }}/>
                  <button type="button" onClick={searchPappers} disabled={siret.length < 9 || searching}
                    style={{ ...btnSecondary, flexShrink: 0, minWidth: 96, opacity: siret.length >= 9 ? 1 : 0.5, cursor: siret.length >= 9 && !searching ? "pointer" : "not-allowed" }}>
                    {searching
                      ? <span aria-label="Recherche…" style={{ display: "inline-block", width: 16, height: 16, border: `2px solid ${ZB.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }}/>
                      : "Chercher"}
                  </button>
                </div>
                {siretMsg && (
                  <p role="alert" style={{ marginTop: 8, fontSize: 14, color: ZB.danger, fontWeight: 600, lineHeight: 1.4 }}>{siretMsg}</p>
                )}
                {company && (
                  <div style={{ marginTop: 10, background: ZB.paper2, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: ZB.ink }}>{company.nom}</div>
                    <div style={{ fontSize: 13, color: ZB.ink2, marginTop: 2 }}>{company.activite} · {company.ville}</div>
                  </div>
                )}
              </div>
            )}

            <input type="email" placeholder="Email" aria-label="Email" autoComplete="email"
              style={inputStyle}/>
            <input type="password" placeholder="Mot de passe" aria-label="Mot de passe"
              onKeyDown={e => e.key === "Enter" && onEnter(company?.nom || null, mode === "signup")}
              style={inputStyle}/>
            <button type="button" onClick={() => onEnter(company?.nom || null, mode === "signup")}
              style={{ ...btnPrimary, width: "100%", minHeight: 52, fontSize: 16, marginTop: 4 }}>
              {mode === "login" ? "Se connecter" : "Créer mon compte gratuit"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
            <hr style={{ flex: 1, border: "none", borderTop: `1px solid ${ZB.rule}` }}/>
            <span style={{ color: ZB.ink2, fontSize: 13 }}>ou</span>
            <hr style={{ flex: 1, border: "none", borderTop: `1px solid ${ZB.rule}` }}/>
          </div>

          <button type="button" onClick={() => onEnter(null, false)}
            style={{ ...btnSecondary, width: "100%" }}>
            {/* Logo Google : couleurs de la marque Google, pas de l'interface */}
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuer avec Google
          </button>

          {mode === "signup" && (
            <p style={{ textAlign: "center", fontSize: 13, color: ZB.ink2, marginTop: 14 }}>Gratuit à vie · 5 devis/semaine · Pro illimité 19 € TTC/mois</p>
          )}
        </div>
      </div>
    </div>
  );
}
