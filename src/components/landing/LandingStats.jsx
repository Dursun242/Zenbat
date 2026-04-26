import { useRef, useEffect, useState } from "react";
import { useInView } from "framer-motion";

const COLORS = {
  terra: "#C97B5C",
  cream: "#FAF7F2",
  ink: "#1A1612",
  muted: "#6B6358",
  border: "#E8E2D8",
};

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function useCountUp(target, duration, active) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    startTimeRef.current = null;

    function tick(timestamp) {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, target, duration]);

  return value;
}

function StatItem({ prefix, number, numberSuffix, label, animate, isInView }) {
  const counted = useCountUp(animate ? number : 0, 1800, animate && isInView);
  const displayNumber = animate ? counted : number;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "16px 8px",
      }}
    >
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "48px",
          fontWeight: 600,
          color: COLORS.ink,
          letterSpacing: "-2px",
          lineHeight: 1,
        }}
      >
        {prefix && (
          <span style={{ color: COLORS.ink }}>{prefix}</span>
        )}
        {displayNumber !== null && (
          <span>{displayNumber}</span>
        )}
        {numberSuffix && (
          <span
            style={{
              color: COLORS.terra,
              fontSize: "24px",
              letterSpacing: "-1px",
            }}
          >
            {numberSuffix}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "13px",
          color: COLORS.muted,
          marginTop: "6px",
          maxWidth: "140px",
        }}
      >
        {label}
      </div>
    </div>
  );
}

const STATS = [
  {
    id: "time",
    prefix: "< 2 min",
    number: null,
    numberSuffix: null,
    label: "par devis",
    animate: false,
  },
  {
    id: "langues",
    prefix: null,
    number: 12,
    numberSuffix: " langues",
    label: "pour dicter",
    animate: true,
  },
  {
    id: "pct",
    prefix: "+",
    number: 30,
    numberSuffix: " %",
    label: "de factures payées à temps",
    animate: true,
  },
  {
    id: "facturx",
    prefix: "2026",
    number: null,
    numberSuffix: null,
    label: "prêt Factur-X",
    animate: false,
  },
];

export default function LandingStats() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

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
      ref={ref}
      style={{
        background: COLORS.cream,
        borderTop: `1px solid ${COLORS.border}`,
        borderBottom: `1px solid ${COLORS.border}`,
        padding: "56px 24px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: isMobile ? "32px 16px" : "0",
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        {STATS.map((stat) => (
          <StatItem
            key={stat.id}
            prefix={stat.prefix}
            number={stat.number}
            numberSuffix={stat.numberSuffix}
            label={stat.label}
            animate={stat.animate}
            isInView={isInView}
          />
        ))}
      </div>
    </section>
  );
}
