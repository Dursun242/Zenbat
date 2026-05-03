// Helpers d'affichage pour le panel admin. Purs — aucune dépendance React.

export const fmtEur = n => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

export const fmtD  = d => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

export const fmtDT = d => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

export const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;

export const relTime = d => {
  if (!d) return "—";
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days === 0) return "Auj.";
  if (days === 1) return "Hier";
  if (days < 30)  return `${days}j`;
  if (days < 365) return `${Math.floor(days / 30)}m`;
  return `${Math.floor(days / 365)}a`;
};

// Couleurs/labels compactes pour les statuts devis
export const SC = { brouillon: "#94a3b8", envoye: "#3b82f6", en_signature: "#f59e0b", accepte: "#22c55e", refuse: "#ef4444" };
export const SL = { brouillon: "Brou.", envoye: "Env.", en_signature: "Sig.", accepte: "Acc.", refuse: "Ref." };

export const SORT_OPTS = [
  { v: "joined",      l: "Inscription" },
  { v: "lastSignIn",  l: "Dernière connexion" },
  { v: "lastDevis",   l: "Dernier devis" },
  { v: "caTotal",     l: "CA signé" },
  { v: "devisTotal",  l: "Nb devis" },
  { v: "accepte",     l: "Devis acceptés" },
  { v: "txConv",      l: "Taux conv." },
  { v: "ai_used",     l: "Usage IA" },
  { v: "name",        l: "Nom A→Z" },
];
