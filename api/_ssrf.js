// Protection SSRF partagée par les endpoints qui fetchent une URL fournie
// par l'appelant (claude.js scrape_urls, crm.js scrape_email). Bloque les
// hôtes internes et les domaines qui résolvent vers une IP privée /
// réservée (AWS metadata 169.254.x, localhost, RFC1918, link-local, ULA).

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === "::1" || ip === "::" || ip === "0.0.0.0") return true;
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^0\./.test(ip)) return true;
  if (/^f[cd]/i.test(ip)) return true;
  if (/^fe[89ab]/i.test(ip)) return true;
  return false;
}

// Lève une erreur si l'hôte est interne ou résout vers une IP privée.
export async function assertPublicHost(hostname) {
  if (!hostname) throw new Error("Hôte invalide");
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".local") || lower.endsWith(".internal") || lower.endsWith(".localhost")) {
    throw new Error("Domaine interdit");
  }
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("IP privée bloquée");
    return;
  }
  let address;
  try { address = (await lookup(hostname)).address; }
  catch { throw new Error("Domaine introuvable"); }
  if (isPrivateIp(address)) throw new Error("Domaine résout vers une IP privée");
}
