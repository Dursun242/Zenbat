import { useEffect, useRef } from "react";

// Compteur partagé : permet d'empiler plusieurs modales sans relâcher le
// scroll body tant qu'au moins une reste ouverte.
let lockCount = 0;
let savedOverflow = "";
let savedTouchAction = "";

function lockBody() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    savedTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    // touch-action:none bloque aussi le pull-to-refresh + le scroll inertiel
    // qui "transperce" la modale sur iOS Safari.
    document.body.style.touchAction = "none";
  }
  lockCount++;
}

function unlockBody() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.touchAction = savedTouchAction;
  }
}

/**
 * À monter dans une modale / drawer / overlay fixed.
 *
 * Quand `open` passe à true :
 *  - bloque le scroll du body (et le pull-to-refresh iOS)
 *  - pousse une entrée d'historique → le bouton retour navigateur ou le
 *    swipe back iOS ferme la modale au lieu de quitter l'app
 *  - écoute popstate et appelle onClose()
 *
 * Au démontage (ou quand `open` redevient false) :
 *  - relâche le scroll
 *  - dépile l'entrée d'historique si l'utilisateur n'a pas déjà fait retour
 *    (pour ne pas laisser une entrée fantôme qui obligerait à appuyer 2× sur
 *    retour la prochaine fois)
 *
 * Si onClose() n'est pas fourni (par ex. la modale est démontée par son
 * parent via un setState), le hook gère quand même le scroll lock et le
 * push d'historique mais ne tentera pas de fermer la modale au retour.
 */
export function useModalGuard(open, onClose) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    lockBody();
    try { window.history.pushState({ __zenbatModal: true, t: Date.now() }, ""); } catch {}
    let popped = false;
    const onPop = () => { popped = true; onCloseRef.current?.(); };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      unlockBody();
      if (!popped) { try { window.history.back(); } catch {} }
    };
  }, [open]);
}
