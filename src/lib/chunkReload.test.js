import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isChunkLoadError, recoverFromChunkError } from "./chunkReload.js";

describe("isChunkLoadError", () => {
  it("matche le wording Safari (Importing a module script failed)", () => {
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
  });

  it("matche le wording Chrome (Failed to fetch dynamically imported module)", () => {
    expect(
      isChunkLoadError(new Error("Failed to fetch dynamically imported module: /assets/x.js"))
    ).toBe(true);
  });

  it("matche le wording Loading chunk N failed", () => {
    expect(isChunkLoadError(new Error("Loading chunk 42 failed."))).toBe(true);
  });

  it("matche le wording MIME type (SW qui sert /index.html sur un .js)", () => {
    expect(
      isChunkLoadError(new Error("'text/html' is not a valid JavaScript MIME type"))
    ).toBe(true);
  });

  it("accepte une string brute", () => {
    expect(isChunkLoadError("Importing a module script failed")).toBe(true);
  });

  it("descend dans event.reason si fourni", () => {
    expect(isChunkLoadError({ reason: { message: "Loading chunk 1 failed" } })).toBe(true);
  });

  it("ignore une vraie erreur applicative", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("ignore null / undefined / vide", () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError("")).toBe(false);
  });
});

describe("recoverFromChunkError", () => {
  let reloadSpy;
  let store;

  beforeEach(() => {
    vi.useFakeTimers();
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    });
    reloadSpy = vi.fn();
    vi.stubGlobal("location", { reload: reloadSpy });
    vi.stubGlobal("caches", {
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
    });
    vi.stubGlobal("navigator", { serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([]) } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("arme un reload et renvoie true au premier appel", async () => {
    expect(recoverFromChunkError()).toBe(true);
    await vi.runAllTimersAsync();
    expect(reloadSpy).toHaveBeenCalled();
  });

  it("renvoie false si on retente dans la fenêtre anti-boucle (30s)", () => {
    expect(recoverFromChunkError()).toBe(true);
    expect(recoverFromChunkError()).toBe(false);
  });

  it("renvoie true à nouveau passé 30s", () => {
    expect(recoverFromChunkError()).toBe(true);
    // simule plus de 30s écoulées en réécrivant le timestamp
    store["zenbat_chunk_reload_at"] = String(Date.now() - 31_000);
    expect(recoverFromChunkError()).toBe(true);
  });

  it("vide les caches et désinscrit les SW avant de recharger", async () => {
    caches.keys.mockResolvedValueOnce(["workbox-precache-v2", "runtime"]);
    const unregister = vi.fn().mockResolvedValue(true);
    navigator.serviceWorker.getRegistrations.mockResolvedValueOnce([{ unregister }]);

    recoverFromChunkError();
    await vi.runAllTimersAsync();

    expect(caches.delete).toHaveBeenCalledWith("workbox-precache-v2");
    expect(caches.delete).toHaveBeenCalledWith("runtime");
    expect(unregister).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
  });
});
