// Constantes et helpers de l'enveloppe App.

export const TRIAL_DAYS = 30;

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
