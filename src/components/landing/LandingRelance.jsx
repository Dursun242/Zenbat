import { useRef, useState, useEffect } from "react";
import { useInView, motion } from "framer-motion";
import { Send, Mail, MailWarning, CheckCircle2 } from "lucide-react";

const C = {
  terra: "#C97B5C",
  terradark: "#A55F44",
  cream: "#FAF7F2",
  creamlight: "#FFFCF7",
  ink: "#1A1612",
  muted: "#6B6358",
  border: "#E8E2D8",
  green: "#22c55e",
};

const STEPS = [
  {
    icon: Send,
    day: "Jour 0",
    label: "Facture émise",
    note: null,
    color: C.terra,
  },
  {
    icon: Mail,
    day: "Jour +7",
    label: "Relance amicale envoyée",
    note: "« Bonjour, petit rappel… »",
    color: C.terra,
  },
  {
    icon: MailWarning,
    day: "Jour +15",
    label: "Relance ferme envoyée",
    note: "« Paiement requis sous 48h »",
    color: C.terra,
  },
  {
    icon: CheckCircle2,
    day: "Jour +18",
    label: "Paiement reçu ✓",
    note: null,
    color: C.green,
  },
];

const MINI_STATS = [
  "Email + SMS automatiques",
  "Ton ajusté intelligemment",
  "0 € de logiciel en plus",
];

function Timeline({ activeStep }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        width: "100%",
        maxWidth: 360,
        margin: "0 auto",
      }}
    >
      {STEPS.map((step, i) => {
        const isActive = i <= activeStep;
        const Icon = step.icon;
        const color = isActive ? step.color : "#9CA3AF";
        const borderColor = isActive ? step.color : C.border;
        const isLast = i === STEPS.length - 1;

        return (
          <motion.div
            key={i}
            animate={{ opacity: isActive ? 1 : 0.25 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            style={{ display: "flex", flexDirection: "column" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              {/* Icon + connector column */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: `2px solid ${borderColor}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isActive
                      ? `${step.color}18`
                      : "transparent",
                    transition: "border-color 0.4s, background 0.4s",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color={color} strokeWidth={1.8} />
                </div>
                {!isLast && (
                  <div
                    style={{
                      width: 2,
                      height: 52,
                      background: isActive ? C.terra : C.border,
                      transition: "background 0.4s",
                      borderRadius: 1,
                    }}
                  />
                )}
              </div>

              {/* Text */}
              <div style={{ paddingTop: 6 }}>
                <div
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 11,
                    fontWeight: 600,
                    color: isActive ? step.color : C.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    marginBottom: 2,
                    transition: "color 0.4s",
                  }}
                >
                  {step.day}
                </div>
                <div
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 15,
                    fontWeight: 600,
                    color: C.ink,
                    lineHeight: 1.4,
                  }}
                >
                  {step.label}
                </div>
                {step.note && (
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12,
                      fontStyle: "italic",
                      color: C.muted,
                      marginTop: 3,
                    }}
                  >
                    {step.note}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function LandingRelance() {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: false, margin: "-100px" });
  const [activeStep, setActiveStep] = useState(-1);
  const timerRef = useRef(null);

  useEffect(() => {
    if (inView) {
      setActiveStep(-1);
      let step = 0;
      timerRef.current = setInterval(() => {
        setActiveStep(step);
        step += 1;
        if (step >= STEPS.length) {
          clearInterval(timerRef.current);
        }
      }, 1300);
    } else {
      clearInterval(timerRef.current);
      setActiveStep(-1);
    }
    return () => clearInterval(timerRef.current);
  }, [inView]);

  return (
    <section
      ref={sectionRef}
      style={{
        background: C.cream,
        padding: "96px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 64,
          flexWrap: "wrap",
        }}
      >
        {/* Left copy */}
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: C.terra,
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 16,
            }}
          >
            Le différenciateur Zenbat
          </div>

          <h2
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 42,
              fontWeight: 400,
              color: C.ink,
              letterSpacing: "-0.5px",
              lineHeight: 1.15,
              margin: "0 0 20px 0",
            }}
          >
            Vous facturez.
            <br />
            Zenbat encaisse.
          </h2>

          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 16,
              color: C.muted,
              lineHeight: 1.75,
              maxWidth: 440,
              margin: 0,
            }}
          >
            73&nbsp;% des TPE perdent du chiffre d&apos;affaires sur des
            factures jamais relancées. Pas par mauvaise volonté — par manque de
            temps, par gêne, par oubli. Zenbat élimine ce trou.
          </p>

          {/* Mini stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 20,
              marginTop: 28,
            }}
          >
            {MINI_STATS.map((stat) => (
              <div
                key={stat}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: C.terra,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 13,
                    color: C.muted,
                  }}
                >
                  {stat}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right timeline */}
        <div
          style={{
            flex: "1 1 300px",
            minWidth: 280,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Timeline activeStep={activeStep} />
        </div>
      </div>
    </section>
  );
}
