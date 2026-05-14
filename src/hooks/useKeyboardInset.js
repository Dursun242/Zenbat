import { useEffect, useState } from "react";

// Retourne la hauteur en px occupée par le clavier soft en bas du
// layout viewport. 0 quand le clavier est fermé.
//
// Calcul : `innerHeight - (visualViewport.height + visualViewport.offsetTop)`.
//
// iOS PWA standalone quirk : `visualViewport.height` compte parfois la
// barre de suggestion ("Je / Tu / C'est") comme partie du "viewport"
// au lieu du "clavier" → l'inset mesuré sous-estime la zone réellement
// occluse. Quand un input texte est focused, on garantit un minimum de
// 48 % de innerHeight (= portion typique du clavier iOS portrait :
// AZERTY + suggestions + dock home indicator).
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const compute = () => {
      const vv = window.visualViewport;
      const iwh = window.innerHeight || 0;
      if (!iwh) { setInset(0); return; }

      const ae = document.activeElement;
      const isInput = !!ae && (
        ae.tagName === "TEXTAREA" ||
        (ae.tagName === "INPUT" && !["checkbox","radio","submit","button","reset","file","color","range","image","hidden"].includes((ae.type || "text").toLowerCase())) ||
        ae.isContentEditable === true
      );

      const measured = vv
        ? Math.max(0, iwh - (vv.height + vv.offsetTop))
        : 0;

      // Heuristique réservée aux cas où visualViewport a effectivement
      // shrink (= clavier soft confirmé). Sur desktop, vv.height === iwh
      // et l'utilisateur tape sur un clavier physique → keyboardInset = 0.
      const softKeyboardOpen = vv && (iwh - vv.height) > 100;

      if (isInput && softKeyboardOpen) {
        const heuristic = Math.round(iwh * 0.48);
        setInset(Math.max(measured, heuristic));
      } else {
        setInset(measured);
      }
    };

    compute();
    window.visualViewport?.addEventListener("resize", compute);
    window.visualViewport?.addEventListener("scroll", compute);
    const onFocusIn  = () => compute();
    const onFocusOut = () => setTimeout(compute, 100);
    document.addEventListener("focusin",  onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      window.visualViewport?.removeEventListener("resize", compute);
      window.visualViewport?.removeEventListener("scroll", compute);
      document.removeEventListener("focusin",  onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return inset;
}
