import { motion } from "framer-motion";

const C = {
  terra: "#C97B5C",
  terradark: "#A55F44",
  cream: "#FAF7F2",
  creamlight: "#FFFCF7",
  ink: "#1A1612",
  muted: "#6B6358",
  border: "#E8E2D8",
};

const STEPS = [
  {
    number: "1",
    title: "Dictez",
    description:
      "Sur votre téléphone, votre PC, en français, anglais, espagnol… Zenbat comprend et structure.",
    titleNode: null,
  },
  {
    number: "2",
    title: "Validez",
    description:
      "Aperçu PDF instantané, signature électronique eIDAS, envoi en un clic à votre client.",
    titleNode: null,
  },
  {
    number: "3",
    title: null,
    titleNode: (
      <>
        <em style={{ color: C.terra, fontStyle: "italic" }}>Encaissez</em>
        {" et dormez"}
      </>
    ),
    description:
      "Suivi du paiement, relances automatiques, export comptable. Vous voyez votre CA tomber sans lever le petit doigt.",
  },
];

const DELAYS = [0, 0.12, 0.24];

export default function LandingHow() {
  return (
    <section
      style={{
        background: C.creamlight,
        padding: "96px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
        {/* Section title */}
        <h2
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 42,
            fontWeight: 400,
            color: C.ink,
            letterSpacing: "-0.5px",
            lineHeight: 1.15,
            margin: "0 0 64px 0",
            textAlign: "center",
          }}
        >
          Trois actions. Le reste se fait tout seul.
        </h2>

        {/* Steps grid */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 32,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.55,
                delay: DELAYS[i],
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                flex: "1 1 240px",
                minWidth: 220,
                maxWidth: 280,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Big faint number */}
              <div
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 80,
                  fontWeight: 400,
                  color: "rgba(201,123,92,.12)",
                  lineHeight: 1,
                  marginBottom: 8,
                  userSelect: "none",
                }}
              >
                {step.number}
              </div>

              {/* Step title */}
              <div
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  color: C.ink,
                  lineHeight: 1.3,
                  marginBottom: 12,
                }}
              >
                {step.titleNode ?? step.title}
              </div>

              {/* Description */}
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  color: C.muted,
                  lineHeight: 1.72,
                  margin: 0,
                }}
              >
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
