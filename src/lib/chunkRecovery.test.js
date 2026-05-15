import { describe, it, expect, beforeEach, vi } from "vitest";
import { isChunkLoadError, tryReloadOnce } from "./chunkRecovery.js";

describe("isChunkLoadError", () => {
  it("détecte Importing a module script failed", () => {
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
  });
  it("détecte Failed to fetch dynamically imported module", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module: /assets/x.js"))).toBe(true);
  });
  it("détecte Loading chunk N failed", () => {
    expect(isChunkLoadError(new Error("Loading chunk 42 failed."))).toBe(true);
  });
  it("détecte le MIME type text/html sur un module", () => {
    expect(isChunkLoadError(new Error("Expected a JavaScript module script but the server responded with a MIME type of \"text/html\". 'text/html' is not a valid JavaScript MIME type"))).toBe(true);
  });
  it("accepte une string brute", () => {
    expect(isChunkLoadError("Importing a module script failed")).toBe(true);
  });
  it("accepte un objet avec .reason (PromiseRejectionEvent)", () => {
    expect(isChunkLoadError({ reason: new Error("Loading chunk 7 failed.") })).toBe(true);
  });
  it("renvoie false sur une erreur applicative normale", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });
  it("renvoie false sur null/undefined", () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("tryReloadOnce", () => {
  const realReload = window.location.reload;
  const reloadSpy = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    reloadSpy.mockClear();
    // window.location.reload n'est pas configurable en jsdom par défaut ; on
    // remplace l'objet location.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });
  });

  it("déclenche un reload la première fois", () => {
    expect(tryReloadOnce()).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("zenbat_chunk_reload_at")).toBeTruthy();
  });

  it("n'enchaîne pas un second reload dans la fenêtre de 30s (anti-boucle)", () => {
    tryReloadOnce();
    reloadSpy.mockClear();
    expect(tryReloadOnce()).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("re-déclenche après expiration du cooldown", () => {
    localStorage.setItem("zenbat_chunk_reload_at", String(Date.now() - 31_000));
    expect(tryReloadOnce()).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _restore = () => { window.location.reload = realReload };
});
