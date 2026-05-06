// Constantes et helpers de l'enveloppe App.

export const TRIAL_DAYS = 30;
export const TRIAL_DAILY_DEVIS_LIMIT = 5;

// Compte les devis du state dont la création remonte à aujourd'hui (timezone locale).
// NB : ne résiste pas à la suppression (un devis supprimé fait baisser le compte).
// Utilisé en complément du compteur sticky localStorage via Math.max.
export function countDevisToday(devis) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  return (devis || []).reduce((n, d) => {
    if (!d?.created_at) return n;
    const t = new Date(d.created_at).getTime();
    return Number.isFinite(t) && t >= startMs ? n + 1 : n;
  }, 0);
}

// Compteur sticky par jour stocké en localStorage. Ne décrémente jamais à la
// suppression (résiste au bypass "créer 5, supprimer, recréer"). Reset auto
// au changement de date.
const STICKY_COUNTER_KEY = "zenbat_devis_daily_counter";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function readStickyDevisToday() {
  try {
    const raw = localStorage.getItem(STICKY_COUNTER_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return parsed?.date === todayKey() ? Number(parsed.count) || 0 : 0;
  } catch { return 0; }
}

export function bumpStickyDevisToday() {
  const today = todayKey();
  const next = readStickyDevisToday() + 1;
  try { localStorage.setItem(STICKY_COUNTER_KEY, JSON.stringify({ date: today, count: next })); } catch {}
  return next;
}

// Recopie les champs de l'inscription (prénom, nom, société, email de
// connexion) dans le brand si celui-ci est encore vierge. L'email de
// connexion sert d'email pro par défaut — affiché dans l'en-tête des
// devis et transmis au client pour la signature.
export function hydrateFromMetadata(user, setBrand) {
  const md = user?.user_metadata || {};
  const explicitFirst = (md.first_name || "").trim();
  const explicitLast  = (md.last_name  || "").trim();
  const full          = (md.full_name  || "").trim();
  const company       = (md.company_name || "").trim();
  const loginEmail    = (user?.email || "").trim();
  if (!explicitFirst && !explicitLast && !full && !company && !loginEmail) return;

  setBrand(prev => {
    const next = { ...prev };
    // Chaque champ est renseigné UNIQUEMENT s'il est vide
    // (on n'écrase jamais une saisie déjà faite par l'utilisateur).
    if (!next.companyName?.trim() && company)   next.companyName = company;
    if (!next.email?.trim()       && loginEmail) next.email       = loginEmail;
    if (!next.firstName?.trim() && !next.lastName?.trim()) {
      if (explicitFirst || explicitLast) {
        next.firstName = explicitFirst;
        next.lastName  = explicitLast;
      } else if (full) {
        const parts = full.split(/\s+/);
        next.firstName = parts[0] || "";
        next.lastName  = parts.slice(1).join(" ");
      }
    }
    return next;
  });
}
