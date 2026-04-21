// Mesure la qualité du profil entreprise pour la génération de devis propres.
// Un champ "critical" manquant rend le devis non conforme ou incomplet.
// Un champ "recommended" améliore le rendu pro.

const CRITICAL_FIELDS = [
  { key: "companyName",    label: "Nom de l'entreprise",  step: 0, impact: "Sans ce nom, vos devis n'ont pas d'en-tête." },
  { key: "siret",          label: "Numéro SIRET",         step: 0, impact: "Obligatoire sur un devis en France (art. L441-9)." },
  { key: "address",        label: "Adresse postale",      step: 2, impact: "Obligatoire sur un devis pour identifier l'émetteur." },
  { key: "city",           label: "Ville / Code postal",  step: 2, impact: "Obligatoire sur un devis pour identifier l'émetteur." },
  { key: "phone",          label: "Téléphone",            step: 2, impact: "Vos clients ne pourront pas vous joindre depuis le devis." },
  { key: "email",          label: "Email professionnel",  step: 2, impact: "Indispensable pour la signature électronique." },
  { key: "iban",           label: "IBAN",                 step: 4, impact: "Sans IBAN, vos clients ne peuvent pas régler par virement." },
  { key: "mentionsLegales",label: "Mentions légales",     step: 4, impact: "L'assurance décennale et le régime TVA sont obligatoires." },
];

const RECOMMENDED_FIELDS = [
  { key: "logo",      label: "Logo",           step: 0, impact: "Un logo renforce la crédibilité du devis." },
  { key: "tva",       label: "N° TVA intra",   step: 0, impact: "Requis si vous êtes assujetti à la TVA." },
  { key: "website",   label: "Site web",       step: 2, impact: "Rassure vos clients sur votre professionnalisme." },
  { key: "bic",       label: "BIC / SWIFT",    step: 4, impact: "Complète l'IBAN pour les virements internationaux." },
  { key: "trades",    label: "Métiers BTP",    step: 1, impact: "L'Agent IA génère des devis plus précis avec vos métiers." },
];

const isFilled = (v) => {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
};

export function brandCompleteness(brand) {
  const b = brand || {};
  const missingCritical    = CRITICAL_FIELDS.filter(f => !isFilled(b[f.key]));
  const missingRecommended = RECOMMENDED_FIELDS.filter(f => !isFilled(b[f.key]));

  const totalFields   = CRITICAL_FIELDS.length + RECOMMENDED_FIELDS.length;
  const filledFields  = totalFields - missingCritical.length - missingRecommended.length;
  const percent       = Math.round((filledFields / totalFields) * 100);

  let level;
  if (missingCritical.length >= 5) level = { id: "basic",  label: "À compléter", color: "#ef4444" };
  else if (missingCritical.length > 0) level = { id: "partial", label: "Correct", color: "#f59e0b" };
  else if (missingRecommended.length > 0) level = { id: "good", label: "Bon", color: "#3b82f6" };
  else level = { id: "pro", label: "Pro", color: "#22c55e" };

  return {
    percent,
    level,
    missingCritical,
    missingRecommended,
    isCleanQuote: missingCritical.length === 0,
  };
}
