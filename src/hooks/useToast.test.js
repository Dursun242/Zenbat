import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast } from "./useToast.js";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("useToast", () => {
  it("toast initial = null", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
  });

  it("showErr affiche un toast d'erreur", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showErr("Connexion impossible"));
    expect(result.current.toast).not.toBeNull();
    expect(result.current.toast.label).toBe("Connexion impossible");
    expect(result.current.toast.isError).toBe(true);
  });

  it("showUndo affiche un toast avec callback", () => {
    const onUndo = vi.fn();
    const { result } = renderHook(() => useToast());
    act(() => result.current.showUndo("Client supprimé", onUndo));
    expect(result.current.toast.label).toBe("Client supprimé");
    expect(result.current.toast.onUndo).toBe(onUndo);
    expect(result.current.toast.isError).toBeUndefined();
  });

  it("showErr disparaît après 5 secondes", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showErr("Erreur"));
    act(() => vi.advanceTimersByTime(4999));
    expect(result.current.toast).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
  });

  it("showUndo disparaît après 6 secondes", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showUndo("Supprimé", vi.fn()));
    act(() => vi.advanceTimersByTime(5999));
    expect(result.current.toast).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
  });

  it("dismissToast efface immédiatement", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showErr("Erreur"));
    act(() => result.current.dismissToast());
    expect(result.current.toast).toBeNull();
  });

  it("un 2e showErr annule le timer du 1er", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showErr("Erreur 1"));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.showErr("Erreur 2")); // repart à 0
    act(() => vi.advanceTimersByTime(3000));
    // Le timer du 1er ne doit pas avoir effacé le 2e toast
    expect(result.current.toast).not.toBeNull();
    expect(result.current.toast.label).toBe("Erreur 2");
    act(() => vi.advanceTimersByTime(2001));
    expect(result.current.toast).toBeNull();
  });
});
