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

// Pile des fenêtres ouvertes qui écoutent Échap : seule la dernière ouverte
// (la plus haute) réagit. Un seul écouteur clavier pour toute l'application.
const escapeStack = [];

function onEscapeKey(e) {
  if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
  const top = escapeStack[escapeStack.length - 1];
  if (!top) return;
  e.preventDefault();
  top.current?.();
}

/**
 * Échap ferme la fenêtre comme son bouton de fermeture : `handler` n'est
 * appelé que si cette fenêtre est la plus haute de la pile. C'est lui qui
 * décide (refus pendant une opération en cours, confirmation après saisie…).
 */
export function useEscapeClose(open, handler) {
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; }, [handler]);

  useEffect(() => {
    if (!open) return;
    const entry = handlerRef;
    if (escapeStack.length === 0) window.addEventListener("keydown", onEscapeKey);
    escapeStack.push(entry);
    return () => {
      const i = escapeStack.lastIndexOf(entry);
      if (i !== -1) escapeStack.splice(i, 1);
      if (escapeStack.length === 0) window.removeEventListener("keydown", onEscapeKey);
    };
  }, [open]);
}

/**
 * À monter dans une modale / drawer / overlay fixed.
 *
 * Quand `open` passe à true :
 *  - bloque le scroll du body (et le pull-to-refresh iOS)
 *  - pousse une entrée d'historique → le bouton retour navigateur ou le
 *    swipe back iOS ferme la modale au lieu de quitter l'app
 *  - écoute popstate et appelle onClose()
 *  - Échap appelle onClose() (ou `options.onEscape` s'il faut refuser ou
 *    confirmer), seulement pour la fenêtre la plus haute (cf. useEscapeClose)
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
export function useModalGuard(open, onClose, { onEscape } = {}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEscapeClose(open, onEscape || onClose);

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
