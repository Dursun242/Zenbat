import { useEffect, useState } from "react";

// Détecte l'ouverture du clavier soft mobile via le focus d'un input
// texte / textarea / contenteditable. Plus fiable que le delta visualViewport
// car sur iOS 16+ le layout viewport rétrécit AVEC le visual viewport
// (donc `innerHeight - vv.height ≈ 0`).
//
// Retourne true tant qu'un champ texte est focus, false sinon.
// Couvre Safari, Chrome, Firefox, mobile et desktop.
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isTextInput = (el) => {
      if (!el || !el.tagName) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === "textarea") return true;
      if (tag === "input") {
        const type = (el.type || "text").toLowerCase();
        return !["checkbox","radio","submit","button","reset","file","color","range","image","hidden"].includes(type);
      }
      return el.isContentEditable === true;
    };
    const onFocusIn  = (e) => { if (isTextInput(e.target)) setOpen(true);  };
    const onFocusOut = (e) => { if (isTextInput(e.target)) setOpen(false); };
    document.addEventListener("focusin",  onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    if (isTextInput(document.activeElement)) setOpen(true);
    return () => {
      document.removeEventListener("focusin",  onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return open;
}
