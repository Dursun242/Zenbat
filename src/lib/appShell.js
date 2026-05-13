// Constantes et helpers de l'enveloppe App.

export const FREEMIUM_WEEKLY_DEVIS_LIMIT = 5;

// Lundi 00:00 de la semaine ISO courante (timezone locale du navigateur).
// On approxime Europe/Paris : pour un utilisateur français le résultat
// coïncide ; la source de vérité reste public.current_week_start() côté DB.
function isoWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // getDay() : 0=dimanche, 1=lundi, …, 6=samedi → on veut 1..7 (lundi..dim).
  const day = d.getDay() || 7;
  if (day > 1) d.setDate(d.getDate() - (day - 1));
  return d;
}

// Compte les devis du state dont la création remonte à la semaine ISO courante.
// NB : ne résiste pas à la suppression. Utilisé en complément du compteur
// sticky localStorage et du compteur DB (RPC devis_week_count) via Math.max.
export function countDevisThisWeek(devis) {
  const startMs = isoWeekStart().getTime();
  return (devis || []).reduce((n, d) => {
    if (!d?.created_at) return n;
    const t = new Date(d.created_at).getTime();
    return Number.isFinite(t) && t >= startMs ? n + 1 : n;
  }, 0);
}

// Compteur sticky par semaine ET par utilisateur stocké en localStorage. Ne
// décrémente jamais à la suppression (résiste au bypass "créer 5, supprimer,
// recréer"). Reset auto au changement de semaine.
//
// IMPORTANT : la clé est scopée par `user.id` car le localStorage est partagé
// entre toutes les sessions du navigateur. Sans ce scope, un nouvel inscrit
// qui se connecte sur un navigateur où un autre compte a atteint 5 devis
// hériterait de ce compteur et serait bloqué à 5/5 sans avoir créé un seul
// devis. Le legacy key (sans userId) reste lu en fallback uniquement si
// aucun userId n'est fourni — au cas où un appelant historique persiste.
const STICKY_COUNTER_KEY = "zenbat_devis_weekly_counter";

function storageKey(userId) {
  return userId ? `${STICKY_COUNTER_KEY}_${userId}` : STICKY_COUNTER_KEY;
}

function weekKey() {
  const d = isoWeekStart();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function readStickyDevisThisWeek(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return parsed?.week === weekKey() ? Number(parsed.count) || 0 : 0;
  } catch { return 0; }
}

export function bumpStickyDevisThisWeek(userId) {
  const week = weekKey();
  const next = readStickyDevisThisWeek(userId) + 1;
  try { localStorage.setItem(storageKey(userId), JSON.stringify({ week, count: next })); } catch {}
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
