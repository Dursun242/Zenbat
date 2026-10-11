// Bug iOS (PWA installée, barre d'état « black-translucent », vu sur iOS 18.7) :
// après certains usages du clavier, la zone d'affichage perd la hauteur de la
// barre d'état et ne la récupère pas (innerHeight 793 au lieu de 852 sur un
// iPhone 393 × 852). Tout ce qui est ancré en bas (barre de navigation,
// saisie de l'agent) remonte alors de 59 px et le fond sombre de la page
// apparaît dessous. outerHeight, lui, garde la vraie hauteur.
//
// Renvoie l'écart à compenser (px), 0 hors de ce cas précis : appli
// installée, écart positif mais bien plus petit qu'un clavier (< 100 px).
export const MAX_IOS_GAP = 100;

export function iosViewportGap({ outerHeight, innerHeight, visualHeight, standalone }) {
  if (!standalone) return 0;
  const shown = Math.max(innerHeight || 0, visualHeight || 0);
  const gap = Math.round((outerHeight || 0) - shown);
  return gap > 0 && gap < MAX_IOS_GAP ? gap : 0;
}

export function isStandalone() {
  return (typeof window !== "undefined") &&
    (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
}
