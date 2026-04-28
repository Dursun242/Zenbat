// Helper CORS partagé par tous les endpoints Vercel.
// Fichier préfixé _ : Vercel ne le déploie pas comme fonction serverless.

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

// Origines autorisées hors production : uniquement le poste de dev local.
// On évite ainsi qu'une preview Vercel publique accepte n'importe quelle origine.
const DEV_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Applique les headers CORS sur res.
 * @param {string} methods  ex: "POST, OPTIONS" ou "GET, OPTIONS"
 * @param {boolean} auth    true => ajoute Authorization dans Allow-Headers
 */
export function cors(req, res, { methods = "POST, OPTIONS", auth = true } = {}) {
  const origin = req.headers.origin || "";
  const isProd  = process.env.VERCEL_ENV === "production";
  const allowed = isProd
    ? (ALLOWED_ORIGINS.includes(origin) ? origin : "")
    : (ALLOWED_ORIGINS.includes(origin) || DEV_ORIGIN_RE.test(origin) ? origin : "");
  if (allowed) res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader(
    "Access-Control-Allow-Headers",
    auth ? "Authorization, Content-Type" : "Content-Type"
  );
}
