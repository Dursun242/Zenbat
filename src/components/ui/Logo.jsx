export default function Logo({ size = 22, white = false }) {
  return (
    <span style={{ fontWeight: 700, fontSize: size, letterSpacing: "-0.5px", fontFamily: "'Syne', sans-serif" }}>
      <span style={{ color: "#C97B5C" }}>Zen</span>
      <span style={{ color: white ? "white" : "#1A1612" }}>bat</span>
    </span>
  );
}
