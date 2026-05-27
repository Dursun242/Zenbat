// Persistance localStorage du devis en cours d'édition — filet de
// sécurité contre toute perte de travail (reload imprévu, déconnexion
// transitoire, fermeture d'onglet accidentelle). Lu et écrit par
// DevisDetail, nettoyé par useDevis après chaque sauvegarde DB réussie.

export const devisDraftKey = (userId, devisId) =>
  `zenbat_devis_draft_${userId || "anon"}_${devisId}`;

export function clearDevisDraft(userId, devisId) {
  if (!devisId) return;
  try { localStorage.removeItem(devisDraftKey(userId, devisId)); } catch {}
}
