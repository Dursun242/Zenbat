import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSaveState } from "./useSaveState.js";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("useSaveState", () => {
  it("état initial = idle", () => {
    const { result } = renderHook(() => useSaveState());
    expect(result.current.saveState).toBe("idle");
  });

  it("markSaving → saving", () => {
    const { result } = renderHook(() => useSaveState());
    act(() => result.current.markSaving());
    expect(result.current.saveState).toBe("saving");
  });

  it("markSaved → saved puis idle après 1800ms", () => {
    const { result } = renderHook(() => useSaveState());
    act(() => result.current.markSaved());
    expect(result.current.saveState).toBe("saved");

    act(() => vi.advanceTimersByTime(1799));
    expect(result.current.saveState).toBe("saved");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.saveState).toBe("idle");
  });

  it("markSaving annule le timer de retour à idle", () => {
    const { result } = renderHook(() => useSaveState());
    act(() => result.current.markSaved());
    expect(result.current.saveState).toBe("saved");

    // Un nouveau save démarre avant que le timer expire
    act(() => result.current.markSaving());
    act(() => vi.advanceTimersByTime(2000));
    // Le timer du markSaved précédent ne doit pas remettre idle
    expect(result.current.saveState).toBe("saving");
  });

  it("deux markSaved consécutifs : seul le dernier timer compte", () => {
    const { result } = renderHook(() => useSaveState());
    act(() => result.current.markSaved());
    act(() => vi.advanceTimersByTime(900));
    act(() => result.current.markSaved()); // repart à 0
    act(() => vi.advanceTimersByTime(900));
    expect(result.current.saveState).toBe("saved"); // le 2e timer n'a pas encore expiré
    act(() => vi.advanceTimersByTime(900));
    expect(result.current.saveState).toBe("idle");
  });

  it("setSaveState permet un reset manuel à idle", () => {
    const { result } = renderHook(() => useSaveState());
    act(() => result.current.markSaving());
    act(() => result.current.setSaveState("idle"));
    expect(result.current.saveState).toBe("idle");
  });
});
