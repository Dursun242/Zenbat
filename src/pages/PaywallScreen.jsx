import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

const CHECK = <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>;

const FEATURES = [
  "Agent IA illimité (voix + texte)",
  "PDF brandé avec votre logo",
  "Envoi Odoo Sign intégré",
  "Identification SIRET via Pappers",
  "Signature électronique eIDAS",
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

export default function PaywallScreen({ daysLeft = 0, onBack }) {
  const [billing,  setBilling]  = useState("biannual");
  const [loading,  setLoading]  = useState(false);
  const [ctaError, setCtaError] = useState(null);
  const [myStats,  setMyStats]  = useState(null); // { count, ca, avg }
  const expired = daysLeft <= 0;
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
      if (!token) throw new Error("Vous devez être connecté.")
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

  return (
    <div style={{ minHeight: "100vh", background: "#1A1612", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}@keyframes popIn{0%{opacity:0;transform:scale(.94) translateY(4px)}100%{opacity:1;transform:scale(1) translateY(0)}}`}</style>

      <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>

        {/* Logo */}
        <div style={{ marginBottom: 20, fontSize: 32, fontWeight: 800, fontFamily: "'Syne', sans-serif", letterSpacing: '-1px' }}>
          <span style={{ color: "#22c55e" }}>Zen</span><span style={{ color: "white" }}>bat</span>
        </div>

        {/* Titre */}
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 600, marginBottom: 8, fontFamily: "'Syne', sans-serif", letterSpacing: '-0.3px' }}>
          {expired ? "Période d'essai terminée" : `Encore ${daysLeft} jour${daysLeft > 1 ? "s" : ""} d'essai`}
        </h2>
        <p style={{ color: "#6B6358", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
          {expired
            ? "Passez à Pro pour continuer à créer des devis avec l'Agent IA, le PDF brandé et l'envoi en signature."
            : "Passez à Pro à tout moment pour débloquer toutes les fonctionnalités sans limite."}
        </p>

        {/* Bandeau personnalisé — données du mois courant */}
        {myStats && myStats.count > 0 && (() => {
          const projected = Math.round((myStats.avg || DEFAULT_AVG_DEVIS) * myStats.count * 5);
          const fmtEur = n => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
          return (
            <div style={{ background: "#2A231C", border: "1px solid #3D3028", borderRadius: 16, padding: "14px 16px", marginBottom: 16, textAlign: "left" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6B6358", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Ce mois-ci avec l'essai</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#9A8E82" }}>Devis créés</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>{myStats.count}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "#9A8E82" }}>CA généré</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>{fmtEur(myStats.ca)}</span>
              </div>
              <div style={{ height: 1, background: "#3D3028", marginBottom: 12 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#9A8E82" }}>Avec Pro (×5 devis)</div>
                  <div style={{ fontSize: 10, color: "#6B6358" }}>votre potentiel ce mois</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>{fmtEur(projected)}</div>
              </div>
            </div>
          );
        })()}

        {/* Sélecteur mensuel / 6 mois */}
        <div style={{ display: "flex", background: "#2A231C", borderRadius: 14, padding: 4, marginBottom: 16, position: "relative" }}>
          {Object.values(PLANS).map(p => {
            const active = billing === p.id;
            return (
              <button key={p.id} onClick={() => setBilling(p.id)}
                style={{
                  flex: 1, padding: "9px 8px", border: "none", borderRadius: 10, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 700, transition: "all .18s",
                  background: active ? "white" : "transparent",
                  color: active ? "#1A1612" : "#6B6358",
                  boxShadow: active ? "0 1px 4px rgba(0,0,0,.15)" : "none",
                  position: "relative",
                }}>
                {p.label}
                {p.badge && (
                  <span style={{
                    marginLeft: 6, background: "#22c55e", color: "white",
                    fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 20,
                  }}>
                    {p.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Carte offre */}
        <div key={billing} style={{ background: "white", borderRadius: 24, padding: 22, textAlign: "left", marginBottom: 14, boxShadow: "0 24px 48px rgba(0,0,0,.3)", animation: "popIn .22s ease both" }}>

          {/* En-tête prix */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#1A1612" }}>Zenbat Pro</div>
              <div style={{ color: "#9A8E82", fontSize: 11, marginTop: 2 }}>Pour artisans et entreprises BTP</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e", lineHeight: 1 }}>{plan.priceLabel}</div>
              <div style={{ color: "#9A8E82", fontSize: 11, marginTop: 2 }}>{plan.unit}</div>
            </div>
          </div>

          {/* Bandeau économie */}
          {plan.saving && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "8px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🎉</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>Vous économisez {plan.saving} € TTC</div>
                <div style={{ fontSize: 11, color: "#16a34a" }}>{plan.billed}</div>
              </div>
            </div>
          )}
          {!plan.saving && (
            <div style={{ fontSize: 11, color: "#9A8E82", marginBottom: 14 }}>{plan.billed}</div>
          )}

          {/* Features */}
          {FEATURES.map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#22c55e" }}>
                {CHECK}
              </div>
              <span style={{ fontSize: 13, color: "#3D3028" }}>{f}</span>
            </div>
          ))}

          {/* CTA */}
          <button onClick={handleSubscribe} disabled={loading}
            style={{ width: "100%", background: loading ? "#86efac" : "#22c55e", color: "white", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, marginTop: 16, cursor: loading ? "default" : "pointer", transition: "background .15s" }}>
            {loading ? "Redirection…" : plan.cta}
          </button>
          {ctaError && (
            <p style={{ textAlign: "center", fontSize: 11, color: "#ef4444", marginTop: 8 }}>{ctaError}</p>
          )}

          {/* Garantie */}
          <p style={{ textAlign: "center", fontSize: 11, color: "#9A8E82", marginTop: 10 }}>
            {billing === "biannual"
              ? "Engagement 6 mois · Sans renouvellement automatique"
              : "Sans engagement · Résiliable à tout moment"}
          </p>
        </div>

        <button onClick={onBack} style={{ background: "none", border: "none", color: "#6B6358", fontSize: 12, cursor: "pointer" }}>← Retour</button>
      </div>
    </div>
  );
}
