// Landing page publique — présentation du produit pour visiteurs non authentifiés.
// Deux CTA principaux : "Commencer" (signup) et "Se connecter" (login).

const AC = "#22c55e";
const AC_DARK = "#16a34a";

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#ffffff",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: "#0f172a",
  },
  nav: {
    position: "sticky", top: 0, zIndex: 50,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 24px",
    background: "rgba(255,255,255,0.9)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid #f1f5f9",
  },
  logo: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" },
  logoAccent: { color: AC },
  navBtns: { display: "flex", gap: 10, alignItems: "center" },
  linkBtn: {
    background: "none", border: "none", fontSize: 14, fontWeight: 600,
    color: "#475569", cursor: "pointer", padding: "10px 14px", borderRadius: 8,
  },
  primaryBtn: {
    background: AC, color: "white", border: "none",
    padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 700,
    cursor: "pointer", boxShadow: `0 4px 14px ${AC}44`,
  },

  hero: {
    padding: "80px 24px 60px",
    maxWidth: 1100, margin: "0 auto",
    textAlign: "center",
  },
  heroBadge: {
    display: "inline-block",
    background: `${AC}15`, color: AC_DARK,
    padding: "6px 14px", borderRadius: 999,
    fontSize: 12, fontWeight: 700, letterSpacing: "0.5px",
    marginBottom: 20, textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 56, fontWeight: 800, lineHeight: 1.05,
    letterSpacing: "-1.5px", maxWidth: 820, margin: "0 auto",
  },
  heroHighlight: { color: AC },
  heroSubtitle: {
    fontSize: 19, color: "#475569", lineHeight: 1.6,
    maxWidth: 640, margin: "24px auto 36px",
  },
  heroCTA: { display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" },
  ctaPrimary: {
    background: AC, color: "white", border: "none",
    padding: "16px 30px", borderRadius: 12, fontSize: 16, fontWeight: 700,
    cursor: "pointer", boxShadow: `0 8px 24px ${AC}55`,
  },
  ctaSecondary: {
    background: "white", color: "#0f172a",
    border: "2px solid #e2e8f0",
    padding: "14px 28px", borderRadius: 12, fontSize: 16, fontWeight: 700,
    cursor: "pointer",
  },
  heroNote: { marginTop: 18, fontSize: 13, color: "#94a3b8" },

  section: { padding: "80px 24px", maxWidth: 1100, margin: "0 auto" },
  sectionAlt: { background: "#f8fafc" },
  sectionTitle: {
    fontSize: 40, fontWeight: 800, letterSpacing: "-0.8px",
    textAlign: "center", margin: "0 0 16px",
  },
  sectionSub: {
    fontSize: 17, color: "#64748b", textAlign: "center",
    maxWidth: 600, margin: "0 auto 50px", lineHeight: 1.6,
  },

  features: {
    display: "grid", gap: 24,
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  },
  feature: {
    background: "white",
    padding: 28, borderRadius: 16,
    border: "1px solid #f1f5f9",
    transition: "all .2s",
  },
  featureIcon: {
    width: 48, height: 48, borderRadius: 12,
    background: `${AC}15`, color: AC_DARK,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 24, marginBottom: 16,
  },
  featureTitle: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  featureDesc: { fontSize: 14, color: "#64748b", lineHeight: 1.6 },

  trades: {
    display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12,
    marginTop: 30,
  },
  tradeChip: {
    background: "white", border: "1px solid #e2e8f0",
    padding: "10px 18px", borderRadius: 999,
    fontSize: 14, fontWeight: 600, color: "#334155",
  },

  pricingCard: {
    maxWidth: 440, margin: "0 auto",
    background: "white", borderRadius: 20,
    border: `3px solid ${AC}`,
    padding: 40,
    boxShadow: `0 20px 40px ${AC}22`,
    textAlign: "center",
  },
  priceLabel: { fontSize: 14, fontWeight: 700, color: AC_DARK, textTransform: "uppercase", letterSpacing: "1px" },
  priceAmount: { fontSize: 64, fontWeight: 800, margin: "12px 0 4px", letterSpacing: "-2px" },
  priceUnit: { fontSize: 18, color: "#64748b", fontWeight: 500 },
  priceList: { listStyle: "none", padding: 0, margin: "30px 0", textAlign: "left" },
  priceItem: {
    padding: "10px 0", fontSize: 15, color: "#334155",
    borderBottom: "1px solid #f1f5f9",
    display: "flex", alignItems: "center", gap: 10,
  },
  check: { color: AC, fontWeight: 800, fontSize: 16 },

  finalCTA: {
    background: `linear-gradient(135deg, ${AC} 0%, ${AC_DARK} 100%)`,
    borderRadius: 24, padding: "60px 40px",
    textAlign: "center", color: "white",
    maxWidth: 900, margin: "40px auto",
  },
  finalTitle: { fontSize: 40, fontWeight: 800, letterSpacing: "-1px", marginBottom: 14 },
  finalSub: { fontSize: 17, opacity: 0.9, marginBottom: 30, lineHeight: 1.6 },
  finalBtn: {
    background: "white", color: AC_DARK, border: "none",
    padding: "16px 36px", borderRadius: 12,
    fontSize: 17, fontWeight: 800, cursor: "pointer",
    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
  },

  footer: {
    padding: "40px 24px", textAlign: "center",
    color: "#94a3b8", fontSize: 13,
    borderTop: "1px solid #f1f5f9",
  },
};

const FEATURES = [
  {
    icon: "✨",
    title: "Agent IA multilingue",
    desc: "Décrivez les travaux en français, darija, arabe, espagnol… L'IA rédige le devis en français professionnel avec prix réalistes BTP 2025 et TVA automatique.",
  },
  {
    icon: "📄",
    title: "PDF A4 professionnel",
    desc: "Votre logo, vos couleurs, vos coordonnées bancaires. Export instantané en PDF prêt à envoyer, multi-pages, avec totaux TVA multi-taux.",
  },
  {
    icon: "✍️",
    title: "Signature électronique",
    desc: "Envoyez le devis en signature à votre client en un clic via Odoo Sign. Suivi du statut en temps réel directement dans l'app.",
  },
  {
    icon: "📱",
    title: "100% mobile",
    desc: "Installez Zenbat comme une app sur votre iPhone ou Android. Fonctionne aussi hors ligne, parfait sur chantier.",
  },
  {
    icon: "💾",
    title: "Vos données synchronisées",
    desc: "Clients, devis et lignes sauvegardés automatiquement. Retrouvez votre travail sur n'importe quel appareil.",
  },
  {
    icon: "🎨",
    title: "À votre image",
    desc: "Personnalisez la charte graphique : logo, couleur, typographie, mentions légales, conditions de paiement, RIB/IBAN.",
  },
];

const TRADES = [
  "Maçonnerie", "Gros œuvre", "Carrelage", "Plâtrerie", "Peinture",
  "Plomberie", "Électricité", "Menuiserie", "Toiture", "Isolation",
];

export default function Landing({ onSignup, onLogin }) {
  return (
    <div style={styles.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes floatUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        .feat:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(15,23,42,.08); border-color: #e2e8f0 }
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 28px ${AC}66 }
        @media (max-width: 640px) {
          h1.hero-title { font-size: 38px !important }
          h2.section-title { font-size: 30px !important }
          .final-title { font-size: 28px !important }
        }
      `}</style>

      <nav style={styles.nav}>
        <div style={styles.logo}>Zen<span style={styles.logoAccent}>bat</span></div>
        <div style={styles.navBtns}>
          <button style={styles.linkBtn} onClick={onLogin}>Se connecter</button>
          <button style={styles.primaryBtn} onClick={onSignup}>Commencer</button>
        </div>
      </nav>

      <section style={styles.hero}>
        <div style={styles.heroBadge}>🛠 Outil n°1 des artisans BTP français</div>
        <h1 className="hero-title" style={styles.heroTitle}>
          Créez un devis pro en <span style={styles.heroHighlight}>30 secondes</span>.
        </h1>
        <p style={styles.heroSubtitle}>
          Décrivez les travaux à l'oral ou à l'écrit — l'IA Zenbat rédige le devis, calcule les prix et la TVA, génère le PDF et l'envoie en signature à votre client.
        </p>
        <div style={styles.heroCTA}>
          <button className="cta-primary" style={styles.ctaPrimary} onClick={onSignup}>
            Essayer 30 jours gratuits →
          </button>
          <button style={styles.ctaSecondary} onClick={onLogin}>
            Se connecter
          </button>
        </div>
        <div style={styles.heroNote}>Sans carte bancaire • Installation en 2 minutes</div>
      </section>

      <section style={{ ...styles.section, ...styles.sectionAlt, maxWidth: "none" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 className="section-title" style={styles.sectionTitle}>Tout ce qu'il faut pour devisser vite.</h2>
          <p style={styles.sectionSub}>Pensé par et pour des artisans du bâtiment. Zéro Word, zéro Excel, zéro prise de tête.</p>
          <div style={styles.features}>
            {FEATURES.map((f, i) => (
              <div key={i} className="feat" style={styles.feature}>
                <div style={styles.featureIcon}>{f.icon}</div>
                <div style={styles.featureTitle}>{f.title}</div>
                <div style={styles.featureDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 className="section-title" style={styles.sectionTitle}>Pensé pour votre métier.</h2>
        <p style={styles.sectionSub}>L'IA connaît les ouvrages, unités et tarifs de votre spécialité.</p>
        <div style={styles.trades}>
          {TRADES.map((t, i) => (
            <div key={i} style={styles.tradeChip}>{t}</div>
          ))}
          <div style={{ ...styles.tradeChip, background: `${AC}15`, borderColor: AC, color: AC_DARK }}>
            + bien d'autres
          </div>
        </div>
      </section>

      <section style={{ ...styles.section, ...styles.sectionAlt, maxWidth: "none" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 className="section-title" style={styles.sectionTitle}>Un tarif unique, tout compris.</h2>
          <p style={styles.sectionSub}>Commencez gratuitement pendant 30 jours. Pas d'engagement, résiliation en un clic.</p>
          <div style={styles.pricingCard}>
            <div style={styles.priceLabel}>Formule Pro</div>
            <div style={styles.priceAmount}>
              29€<span style={styles.priceUnit}>/mois</span>
            </div>
            <div style={{ color: "#64748b", fontSize: 14 }}>HT, sans engagement</div>
            <ul style={styles.priceList}>
              <li style={styles.priceItem}><span style={styles.check}>✓</span> Devis illimités</li>
              <li style={styles.priceItem}><span style={styles.check}>✓</span> Agent IA multilingue</li>
              <li style={styles.priceItem}><span style={styles.check}>✓</span> Clients illimités</li>
              <li style={styles.priceItem}><span style={styles.check}>✓</span> Signature électronique incluse</li>
              <li style={styles.priceItem}><span style={styles.check}>✓</span> PDF personnalisés à votre marque</li>
              <li style={styles.priceItem}><span style={styles.check}>✓</span> Support par email</li>
            </ul>
            <button className="cta-primary" style={{ ...styles.ctaPrimary, width: "100%" }} onClick={onSignup}>
              Démarrer l'essai gratuit
            </button>
          </div>
        </div>
      </section>

      <section style={{ padding: "0 24px" }}>
        <div style={styles.finalCTA}>
          <h2 className="final-title" style={styles.finalTitle}>Votre premier devis dans 2 minutes.</h2>
          <p style={styles.finalSub}>
            Rejoignez les artisans qui ont dit adieu aux devis sur Word.
          </p>
          <button style={styles.finalBtn} onClick={onSignup}>
            Créer mon compte gratuit →
          </button>
        </div>
      </section>

      <footer style={styles.footer}>
        © {new Date().getFullYear()} Zenbat — Fait avec ❤️ pour les artisans du BTP français.
      </footer>
    </div>
  );
}
