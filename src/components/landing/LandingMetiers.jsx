import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Receipt, TrendingUp } from "lucide-react";

const COLORS = {
  terra: "#C97B5C",
  cream: "#FAF7F2",
  ink: "#1A1612",
  muted: "#6B6358",
  border: "#E8E2D8",
};

const CARDS = [
  {
    id: "commercial",
    Icon: Mic,
    title: "Commercial",
    body: "Dictez sur le chantier, en réunion, en voiture. Zenbat structure votre devis, applique les bons taux TVA, ajoute les mentions légales. En 12 langues. En quelques minutes.",
    featured: false,
    delay: 0,
  },
  {
    id: "comptable",
    Icon: Receipt,
    title: "Comptable",
    body: "Factur-X embarqué dans chaque PDF, prêt pour la réforme 2026. Export comptable en un clic. Zéro ressaisie pour votre cabinet.",
    featured: false,
    delay: 0.1,
  },
  {
    id: "recouvrement",
    Icon: TrendingUp,
    title: "Recouvrement",
    body: "Relances automatiques par email et SMS. Ton ajusté selon le retard. Escalade progressive jusqu'au paiement. Vos factures encaissées sans que vous les réclamiez.",
    featured: true,
    delay: 0.2,
  },
];

function Card({ card, isMobile }) {
  const { Icon, title, body, featured, delay } = card;

  const cardStyle = featured
    ? {
        background: "#FEF3EC",
        border: `2px solid ${COLORS.terra}`,
        borderRadius: "20px",
        padding: "32px",
        flex: 1,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }
    : {
        background: "#FFFFFF",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "20px",
        padding: "32px",
        flex: 1,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      };

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, boxShadow: "0 16px 48px rgba(26,22,18,0.10)" }}
      style={cardStyle}
    >
      {featured && (
        <span
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "rgba(201,123,92,0.12)",
            color: COLORS.terra,
            fontSize: "11px",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            letterSpacing: "0.5px",
            padding: "4px 10px",
            borderRadius: "999px",
            border: `1px solid rgba(201,123,92,0.25)`,
          }}
        >
          Nouveau
        </span>
      )}

      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          background: "rgba(201,123,92,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={COLORS.terra} strokeWidth={1.75} />
      </div>

      <div
        style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "22px",
          color: COLORS.ink,
          lineHeight: 1.2,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "15px",
          color: COLORS.muted,
          lineHeight: 1.65,
        }}
      >
        {body}
      </div>
    </motion.div>
  );
}

export default function LandingMetiers() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <section
      id="features"
      style={{
        background: "#FFFCF7",
        padding: "96px 24px",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        {/* Pretext */}
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "11px",
            fontWeight: 600,
            color: COLORS.terra,
            letterSpacing: "1px",
            textTransform: "uppercase",
            marginBottom: "16px",
          }}
        >
          FONCTIONNALITÉS
        </div>

        {/* H2 */}
        <h2
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "42px",
            fontWeight: 700,
            color: COLORS.ink,
            margin: "0 0 16px 0",
            lineHeight: 1.1,
            letterSpacing: "-1px",
          }}
        >
          Trois métiers. Un seul assistant.
        </h2>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "16px",
            color: COLORS.muted,
            margin: "0 0 56px 0",
            lineHeight: 1.6,
            maxWidth: "560px",
          }}
        >
          Vous dirigez. Zenbat exécute le commercial, le comptable et le recouvrement.
        </p>

        {/* Cards */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: "20px",
            alignItems: isMobile ? "stretch" : "flex-start",
          }}
        >
          {CARDS.map((card) => (
            <Card key={card.id} card={card} isMobile={isMobile} />
          ))}
        </div>
      </div>
    </section>
  );
}
