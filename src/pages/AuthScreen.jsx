import { useState } from "react";

export default function AuthScreen({ onEnter }) {
  const [mode,      setMode]      = useState("login");
  const [siret,     setSiret]     = useState("");
  const [company,   setCompany]   = useState(null);
  const [searching, setSearching] = useState(false);

  const searchPappers = async () => {
    if (siret.length < 9) return;
    setSearching(true);
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
        alert("SIRET introuvable. Vérifiez le numéro ou renseignez votre entreprise manuellement lors de l'inscription.");
      }
    } catch {
      setCompany(null);
      alert("Impossible de contacter l'API. Renseignez votre entreprise manuellement lors de l'inscription.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1A1612", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ marginBottom: 14, fontSize: 38, fontWeight: 800, letterSpacing: "-1.5px", fontFamily: "'Syne', sans-serif" }}>
            <span style={{ color: "#22c55e" }}>Zen</span><span style={{ color: "white" }}>bat</span>
          </div>
          <p style={{ color: "#6B6358", fontSize: 12 }}>Devis BTP · Simple · Rapide · Professionnel</p>
        </div>

        <div style={{ background: "white", borderRadius: 24, padding: 24, boxShadow: "0 24px 48px rgba(0,0,0,.3)" }}>
          {/* Onglets */}
          <div style={{ display: "flex", background: "#F0EBE3", borderRadius: 12, padding: 4, marginBottom: 20 }}>
            {[["login", "Se connecter"], ["signup", "Créer un compte"]].map(([m, l]) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ flex: 1, padding: 8, borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600, background: mode === m ? "white" : "transparent", color: mode === m ? "#1A1612" : "#9A8E82", cursor: "pointer", boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>
                {l}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "signup" && (
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B6358", marginBottom: 6 }}>SIRET — Identification Pappers</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={siret} onChange={e => setSiret(e.target.value.replace(/\D/g, ""))} placeholder="14 chiffres" maxLength={14}
                    style={{ flex: 1, border: "1px solid #E8E2D8", borderRadius: 12, padding: "10px 12px", fontSize: 13, outline: "none" }}/>
                  <button onClick={searchPappers} disabled={siret.length < 9 || searching}
                    style={{ background: siret.length >= 9 ? "#22c55e" : "#d1fae5", color: "white", border: "none", borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 68 }}>
                    {searching
                      ? <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }}/>
                      : "Chercher"}
                  </button>
                </div>
                {company && (
                  <div style={{ marginTop: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "10px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>{company.nom}</div>
                    <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>{company.activite} · {company.ville}</div>
                  </div>
                )}
              </div>
            )}

            <input type="email" placeholder="Email"
              style={{ width: "100%", border: "1px solid #E8E2D8", borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none" }}/>
            <input type="password" placeholder="Mot de passe"
              onKeyDown={e => e.key === "Enter" && onEnter(company?.nom || null, mode === "signup")}
              style={{ width: "100%", border: "1px solid #E8E2D8", borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none" }}/>
            <button onClick={() => onEnter(company?.nom || null, mode === "signup")}
              style={{ width: "100%", background: "#22c55e", color: "white", border: "none", borderRadius: 12, padding: 13, fontSize: 13, fontWeight: 700, marginTop: 4, cursor: "pointer" }}>
              {mode === "login" ? "Se connecter →" : "Créer mon compte gratuit →"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
            <hr style={{ flex: 1, border: "none", borderTop: "1px solid #F0EBE3" }}/>
            <span style={{ color: "#cbd5e1", fontSize: 11 }}>ou</span>
            <hr style={{ flex: 1, border: "none", borderTop: "1px solid #F0EBE3" }}/>
          </div>

          <button onClick={() => onEnter(null, false)}
            style={{ width: "100%", border: "1px solid #E8E2D8", borderRadius: 12, padding: 11, fontSize: 12, fontWeight: 600, background: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#374151", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuer avec Google
          </button>

          {mode === "signup" && (
            <p style={{ textAlign: "center", fontSize: 11, color: "#9A8E82", marginTop: 14 }}>Essai 30 jours gratuit · puis 19€/mois HT</p>
          )}
        </div>
      </div>
    </div>
  );
}
