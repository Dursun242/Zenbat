import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useModalGuard } from "./useModalGuard.js";
import DeleteAccountModal from "../components/onboarding/DeleteAccountModal.jsx";

function Fenetre({ open = true, onClose, onEscape, children }) {
  useModalGuard(open, onClose, onEscape ? { onEscape } : undefined);
  return open ? <div role="dialog">{children}</div> : null;
}

describe("useModalGuard : touche Échap", () => {
  it("ferme la fenêtre comme son bouton de fermeture", () => {
    const onClose = vi.fn();
    render(<Fenetre onClose={onClose}/>);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deux fenêtres empilées : seule la plus haute réagit", () => {
    const closeBas = vi.fn();
    const closeHaut = vi.fn();
    const { rerender } = render(<><Fenetre onClose={closeBas}/><Fenetre open={false} onClose={closeHaut}/></>);
    rerender(<><Fenetre onClose={closeBas}/><Fenetre open onClose={closeHaut}/></>);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closeHaut).toHaveBeenCalledTimes(1);
    expect(closeBas).not.toHaveBeenCalled();
    // La fenêtre du haut refermée, Échap revient à celle du dessous.
    rerender(<><Fenetre onClose={closeBas}/><Fenetre open={false} onClose={closeHaut}/></>);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closeBas).toHaveBeenCalledTimes(1);
  });

  it("onEscape peut refuser la fermeture, les autres touches sont ignorées", () => {
    const onClose = vi.fn();
    render(<Fenetre onClose={onClose} onEscape={() => {}}/>);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Suppression du compte : Échap", () => {
  const props = { myEmail: "a@exemple.fr", confirm: "", setConfirm: () => {}, error: null, onConfirm: () => {} };

  it("Échap ferme la fenêtre comme « Annuler »", () => {
    const onClose = vi.fn();
    render(<DeleteAccountModal {...props} busy={false} onClose={onClose}/>);
    fireEvent.keyDown(document.activeElement || document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("pendant la suppression, Échap ne ferme pas", () => {
    const onClose = vi.fn();
    render(<DeleteAccountModal {...props} busy onClose={onClose}/>);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
