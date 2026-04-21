const CHECK = <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>;

const FEATURES = [
  "Agent IA illimité (voix + texte)",
  "PDF brandé avec votre logo",
  "Envoi Odoo Sign intégré",
  "Identification SIRET via Pappers",
  "Signature électronique eIDAS",
  "Annulation à tout moment",
];

export default function PaywallScreen({ daysLeft = 0, onBack, onSubscribe }) {
  const expired = daysLeft <= 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div style={{ marginBottom: 20, fontSize: 32, fontWeight: 800 }}>
          <span style={{ color: "#22c55e" }}>Zen</span><span style={{ color: "white" }}>bat</span>
        </div>

        <h2 style={{ color: "white", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          {expired ? "Période d'essai terminée" : `Encore ${daysLeft} jour${daysLeft > 1 ? "s" : ""} d'essai`}
        </h2>
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
          {expired
            ? "Votre essai gratuit de 30 jours est terminé. Passez à Zenbat Pro pour continuer à utiliser l'Agent IA, le PDF brandé et l'envoi en signature."
            : "Profitez de toutes les fonctionnalités gratuitement pendant votre essai. Passez à Pro à tout moment."}
        </p>

        <div style={{ background: "white", borderRadius: 24, padding: 22, textAlign: "left", marginBottom: 14, boxShadow: "0 24px 48px rgba(0,0,0,.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>Zenbat Pro</div>
              <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>Pour artisans et entreprises BTP</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#22c55e" }}>19€</div>
              <div style={{ color: "#94a3b8", fontSize: 11 }}>/mois HT</div>
            </div>
          </div>

          {FEATURES.map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#22c55e" }}>
                {CHECK}
              </div>
              <span style={{ fontSize: 13, color: "#374151" }}>{f}</span>
            </div>
          ))}

          <button onClick={onSubscribe}
            style={{ width: "100%", background: "#22c55e", color: "white", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, marginTop: 14, cursor: "pointer" }}>
            S'abonner — 19€/mois HT
          </button>
        </div>

        <button onClick={onBack} style={{ background: "none", border: "none", color: "#475569", fontSize: 12, cursor: "pointer" }}>← Retour</button>
      </div>
    </div>
  );
}
