// Protection SSRF partagée par les endpoints qui fetchent une URL fournie
// par l'appelant (claude.js scrape_urls, crm.js scrape_email). Bloque les
// hôtes internes et les domaines qui résolvent vers une IP privée /
// réservée (AWS metadata 169.254.x, localhost, RFC1918, CGNAT, link-local,
// ULA, IPv4 mappée en IPv6…), y compris après une redirection HTTP
// (safeFetch revalide chaque saut).
//
// Limite connue : entre la résolution DNS de assertPublicHost et celle de
// fetch, un domaine piégé pourrait changer d'IP (DNS rebinding). Le risque
// reste faible (TTL courts nécessaires, réponse non renvoyée telle quelle).

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function ipv4ToInt(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

// [réseau, longueur du préfixe]
const PRIVATE_V4 = [
  ["0.0.0.0", 8],        // « ce réseau »
  ["10.0.0.0", 8],       // RFC1918
  ["100.64.0.0", 10],    // CGNAT (RFC6598)
  ["127.0.0.0", 8],      // loopback
  ["169.254.0.0", 16],   // link-local (metadata cloud)
  ["172.16.0.0", 12],    // RFC1918
  ["192.0.0.0", 24],     // IETF protocol assignments
  ["192.168.0.0", 16],   // RFC1918
  ["198.18.0.0", 15],    // bancs de test
  ["224.0.0.0", 4],      // multicast
  ["240.0.0.0", 4],      // réservé + broadcast
].map(([net, len]) => [ipv4ToInt(net), len]);

function isPrivateV4(ip) {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  return PRIVATE_V4.some(([net, len]) => {
    const mask = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0;
    return ((n & mask) >>> 0) === net;
  });
}

// Développe une IPv6 en 8 groupes de 16 bits (gère « :: » et un IPv4
// final en notation pointée). Renvoie null si la chaîne est invalide.
function expandIPv6(ip) {
  let s = ip;
  const v4 = s.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const n = ipv4ToInt(v4[1]);
    if (n === null) return null;
    s = s.slice(0, -v4[1].length) + ((n >>> 16).toString(16)) + ":" + ((n & 0xffff).toString(16));
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array(missing).fill("0"), ...tail].map(g => parseInt(g, 16));
  if (groups.length !== 8 || groups.some(g => !Number.isInteger(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}

function isPrivateV6(ip) {
  const g = expandIPv6(ip);
  if (!g) return true;
  const firstFiveZero = g.slice(0, 5).every(x => x === 0);
  const embeddedV4 = () => `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
  // ::ffff:a.b.c.d (IPv4 mappée) et ::a.b.c.d (IPv4 compatible, obsolète)
  if (firstFiveZero && (g[5] === 0xffff || g[5] === 0)) {
    if (g[5] === 0 && g[6] === 0 && g[7] <= 1) return true; // :: et ::1
    return isPrivateV4(embeddedV4());
  }
  // NAT64 64:ff9b::/96 : on juge l'IPv4 embarquée
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every(x => x === 0)) {
    return isPrivateV4(embeddedV4());
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 (ULA)
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 (site-local, obsolète)
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 (multicast)
  return false;
}

export function isPrivateIp(ip) {
  if (!ip || typeof ip !== "string") return true;
  let s = ip.trim().toLowerCase();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  s = s.replace(/%.*$/, ""); // identifiant de zone (fe80::1%eth0)
  const v = isIP(s);
  if (v === 4) return isPrivateV4(s);
  if (v === 6) return isPrivateV6(s);
  return true; // pas une IP : on refuse par prudence
}

// Lève une erreur si l'hôte est interne ou résout vers une IP privée.
export async function assertPublicHost(hostname) {
  if (!hostname) throw new Error("Hôte invalide");
  let host = String(hostname).toLowerCase();
  // URL.hostname garde les crochets d'une IPv6 littérale ([::1]).
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    throw new Error("Domaine interdit");
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("IP privée bloquée");
    return;
  }
  let addresses;
  try { addresses = await lookup(host, { all: true }); }
  catch { throw new Error("Domaine introuvable"); }
  const list = (Array.isArray(addresses) ? addresses : [addresses]).map(a => a?.address);
  if (list.length === 0) throw new Error("Domaine introuvable");
  if (list.some(isPrivateIp)) throw new Error("Domaine résout vers une IP privée");
}

export const SAFE_FETCH_MAX_REDIRECTS = 3;

// fetch d'une URL fournie par l'appelant : l'hôte est vérifié avant chaque
// requête, redirections comprises (suivies à la main, 3 sauts au plus). Avec
// redirect: "follow", seul le premier hôte était contrôlé : un site public
// pouvait rediriger vers 169.254.169.254 ou 127.0.0.1.
export async function safeFetch(url, init = {}, { maxRedirects = SAFE_FETCH_MAX_REDIRECTS } = {}) {
  let current = new URL(String(url));
  for (let hop = 0; ; hop++) {
    if (!["http:", "https:"].includes(current.protocol)) throw new Error("Protocole non autorisé");
    await assertPublicHost(current.hostname);
    const resp = await fetch(current.toString(), { ...init, redirect: "manual" });
    const status = resp.status;
    if (status < 300 || status >= 400 || status === 304) return resp;
    const location = resp.headers?.get?.("location");
    // Le corps d'une redirection ne sert à rien : on libère la connexion.
    try { await resp.body?.cancel?.(); } catch {}
    if (!location) throw new Error(`Redirection HTTP ${status} sans destination`);
    if (hop >= maxRedirects) throw new Error("Trop de redirections");
    try { current = new URL(location, current); }
    catch { throw new Error("Redirection invalide"); }
  }
}
