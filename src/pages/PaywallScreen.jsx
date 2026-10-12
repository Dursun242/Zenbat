import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { ZB, NUM } from "../lib/theme.js";
import { btnPrimary } from "../components/ui/Register.jsx";

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

const CHECK = <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20,6 9,17 4,12"/></svg>;
const BACK  = <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>;

const FEATURES = [
  "Agent IA illimité (voix + texte)",
  "PDF brandé avec ton logo",
  "Signature électronique par OTP email",
  "Identification SIRET via Pappers",
  "Export Factur-X (PDF/A-3 + XML CII)",
];

const PLANS = {
  monthly: {
    id:         "monthly",
    label:      "Mensuel",
    price:      19,
    priceLabel: "19€",
    unit:       "/mois TTC",
    billed:     "Résiliable à tout moment",
    cta:        "S'abonner — 19 € TTC / mois",
    badge:      null,
    saving:     null,
  },
  biannual: {
    id:         "biannual",
    label:      "6 mois",
    price:      9.5,
    priceLabel: "9,50€",
    unit:       "/mois TTC",
    billed:     "Soit 57 € TTC facturés en une fois",
    cta:        "S'abonner — 57 € TTC pour 6 mois",
    badge:      "-50%",
    saving:     57,
  },
};

const DEFAULT_AVG_DEVIS = 1_200; // € HT — valeur artisan BTP si aucun historique

export default function PaywallScreen({ quotaReached = false, weekCount = 0, weekLimit = 5, onBack }) {
  const [billing,  setBilling]  = useState("biannual");
  const [loading,  setLoading]  = useState(false);
  const [ctaError, setCtaError] = useState(null);
  const [myStats,  setMyStats]  = useState(null); // { count, ca, avg }
  const plan    = PLANS[billing];

  useEffect(() => {
    const startMonth = new Date();
    startMonth.setUTCDate(1);
    startMonth.setUTCHours(0, 0, 0, 0);
    supabase
      .from("devis")
      .select("montant_ht, statut")
      .gte("created_at", startMonth.toISOString())
      .is("deleted_at", null)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const count = data.length;
        const ca    = data.reduce((s, d) => s + Number(d.montant_ht || 0), 0);
        const avg   = count ? Math.round(ca / count) : DEFAULT_AVG_DEVIS;
        setMyStats({ count, ca: Math.round(ca), avg });
      })
      .catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    setLoading(true); setCtaError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error("Tu dois être connecté.")
      const res  = await fetch("/api/stripe-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ plan: billing }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
      window.location.href = data.url
    } catch (e) {
      setCtaError(e.message || "Erreur inattendue")
      setLoading(false)
    }
  };

  const fmtEur = n => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="zb-pay" style={{ minHeight: "100vh", background: ZB.paper, color: ZB.ink, fontFamily: ZB.font, padding: "24px 16px 32px", display: "flex", justifyContent: "center" }}>
      <style>{`
        .zb-pay button:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; }
        @media (hover: hover) { .zb-pay .zb-pay-cta:not(:disabled):hover { background: var(--zb-accent-hover) !important; } .zb-pay .zb-pay-plan:hover { background: ${ZB.paper} !important; } }
      `}</style>

      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ marginBottom: 20, fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>
          <span style={{ color: ZB.accent }}>Zen</span><span style={{ color: ZB.ink }}>bat</span>
        </div>

        {/* Titre */}
        <h1 style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 700, lineHeight: 1.25 }}>
          {quotaReached
            ? `Limite de ${weekLimit} devis atteinte`
            : "Passe Pro"}
        </h1>
        <p style={{ margin: "0 0 18px", color: ZB.ink2, fontSize: 15, lineHeight: 1.45 }}>
          {quotaReached
            ? `Tu as utilisé tes ${weekLimit} devis offerts cette semaine. Le compteur repart à zéro lundi prochain — ou passe Pro maintenant pour un nombre illimité.`
            : `Le forfait gratuit te permet de créer ${weekLimit} devis par semaine. Passe Pro pour des devis illimités, les factures et la conformité 2026.`}
        </p>

        {/* Indicateur usage hebdo (freemium uniquement) */}
        {weekCount > 0 && !quotaReached && (
          <p style={{ margin: "0 0 14px", color: ZB.ink2, fontSize: 14, ...NUM }}>
            {weekCount}/{weekLimit} devis créés cette semaine
          </p>
        )}

        {/* Bandeau personnalisé — données du mois courant */}
        {myStats && myStats.count > 0 && (() => {
          const projected = Math.round((myStats.avg || DEFAULT_AVG_DEVIS) * myStats.count * 5);
          return (
            <section aria-label="Ce mois-ci en freemium" style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "4px 16px", marginBottom: 18 }}>
              <h2 style={{ margin: 0, padding: "12px 0 10px", fontSize: 14, fontWeight: 700, borderBottom: `2px solid ${ZB.ink}` }}>Ce mois-ci en freemium</h2>
              <div style={rowStyle}>
                <span style={{ color: ZB.ink2 }}>Devis créés</span>
                <span style={{ fontWeight: 700, ...NUM }}>{myStats.count}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ color: ZB.ink2 }}>CA généré</span>
                <span style={{ fontWeight: 700, ...NUM }}>{fmtEur(myStats.ca)}</span>
              </div>
              <div style={{ ...rowStyle, borderBottom: "none" }}>
                <span>
                  <span style={{ display: "block", fontWeight: 600 }}>Avec Pro (×5 devis)</span>
                  <span style={{ display: "block", fontSize: 13, color: ZB.ink2 }}>ton potentiel ce mois</span>
                </span>
                <span style={{ fontWeight: 700, ...NUM }}>{fmtEur(projected)}</span>
              </div>
            </section>
          );
        })()}

        {/* Offre : bordereau des formules */}
        <section style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, marginBottom: 14 }}>

          {/* En-tête */}
          <div style={{ padding: "16px 16px 12px", borderBottom: `2px solid ${ZB.ink}` }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Zenbat Pro</h2>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: ZB.ink2 }}>Pour artisans et entreprises BTP</p>
          </div>

          {/* Sélecteur mensuel / 6 mois */}
          <div role="radiogroup" aria-label="Formule">
            {Object.values(PLANS).map(p => {
              const active = billing === p.id;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={active} className="zb-pay-plan" onClick={() => setBilling(p.id)}
                  style={{
                    display: "grid", gridTemplateColumns: "22px 1fr auto", gap: "2px 12px", alignItems: "center",
                    width: "100%", minHeight: 64, padding: "12px 16px 12px 13px", textAlign: "left",
                    background: active ? ZB.accentSoft : "none", border: "none", borderBottom: `1px solid ${ZB.ruleSoft}`,
                    borderLeft: `3px solid ${active ? ZB.accent : "transparent"}`,
                    fontFamily: "inherit", color: ZB.ink, cursor: "pointer",
                  }}>
                  <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${active ? ZB.accent : ZB.rule}`, display: "grid", placeItems: "center" }}>
                    {active && <span style={{ width: 10, height: 10, borderRadius: "50%", background: ZB.accent }}/>}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700 }}>
                    {p.label}
                    {p.badge && (
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "0 6px", borderRadius: 4, border: `1px solid ${ZB.ink2}`, color: ZB.ink2, lineHeight: "18px", ...NUM }}>
                        {p.badge}
                      </span>
                    )}
                  </span>
                  <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: 17, fontWeight: 700, ...NUM }}>{p.priceLabel}</span>
                    <span style={{ fontSize: 13, color: ZB.ink2 }}> {p.unit}</span>
                  </span>
                  <span style={{ gridColumn: "2 / -1", fontSize: 13, color: ZB.ink2, ...NUM }}>{p.billed}</span>
                </button>
              );
            })}
          </div>

          {/* Économie */}
          {plan.saving && (
            <p style={{ margin: 0, padding: "10px 16px", borderBottom: `1px solid ${ZB.ruleSoft}`, fontSize: 14, fontWeight: 600, ...NUM }}>
              Tu économises {plan.saving} € TTC
            </p>
          )}

          {/* Features */}
          <ul style={{ listStyle: "none", margin: 0, padding: "6px 16px" }}>
            {FEATURES.map((f, i) => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40, fontSize: 15, borderBottom: i < FEATURES.length - 1 ? `1px solid ${ZB.ruleSoft}` : "none" }}>
                <span style={{ color: ZB.ink2, display: "grid", flexShrink: 0 }}>{CHECK}</span>
                {f}
              </li>
            ))}
          </ul>

          <div style={{ padding: "8px 16px 16px" }}>
            {/* CTA */}
            <button onClick={handleSubscribe} disabled={loading} className="zb-pay-cta"
              style={{ ...btnPrimary, width: "100%", minHeight: 52, fontSize: 16, opacity: loading ? 0.7 : 1, cursor: loading ? "default" : "pointer", ...NUM }}>
              {loading ? "Redirection…" : plan.cta}
            </button>
            {ctaError && (
              <p role="alert" style={{ margin: "8px 0 0", textAlign: "center", fontSize: 14, color: ZB.danger }}>{ctaError}</p>
            )}

            {/* Garantie */}
            <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 13, color: ZB.ink2 }}>
              {billing === "biannual"
                ? "Engagement 6 mois · Sans renouvellement automatique"
                : "Sans engagement · Résiliable à tout moment"}
            </p>
          </div>
        </section>

        <div style={{ textAlign: "center" }}>
          <button onClick={onBack}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44, padding: "0 12px", background: "none", border: "none", color: ZB.ink2, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            {quotaReached ? "Continuer en freemium (5 devis/semaine)" : <>{BACK}Retour</>}
          </button>
        </div>
      </div>
    </div>
  );
}

const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, minHeight: 44, padding: "8px 0", borderBottom: `1px solid ${ZB.ruleSoft}`, fontSize: 15 };
