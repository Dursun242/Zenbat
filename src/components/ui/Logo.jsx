export default function Logo({ size = 22, white = false }) {
  return (
    <span style={{ fontWeight: 800, fontSize: size, letterSpacing: "-0.5px" }}>
      <span style={{ color: "#22c55e" }}>Zen</span>
      <span style={{ color: white ? "white" : "#0f172a" }}>bat</span>
    </span>
  );
}
