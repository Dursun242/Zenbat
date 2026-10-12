import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("../lib/api", () => ({
  listClients: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
}));
vi.mock("../lib/logger.js", () => ({ logError: vi.fn() }));

import { listClients } from "../lib/api";
import { useClients } from "./useClients.js";

const cbs = () => ({ markSaving: vi.fn(), markSaved: vi.fn(), setSaveState: vi.fn(), showErr: vi.fn() });

describe("useClients : état du chargement", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); });

  it("connecté : pas de clients d'exemple, `loaded` passe à true au succès", async () => {
    listClients.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useClients({ id: "u1" }, cbs()));
    expect(result.current.clients).toEqual([]);
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.loadError).toBeNull();
  });

  it("échec puis reload : l'erreur est exposée, puis effacée au succès", async () => {
    const callbacks = cbs();
    listClients.mockRejectedValueOnce(new Error("réseau"));
    const { result } = renderHook(() => useClients({ id: "u1" }, callbacks));
    await waitFor(() => expect(result.current.loadError).toBeTruthy());
    expect(result.current.loaded).toBe(false);
    expect(callbacks.showErr).toHaveBeenCalled();

    listClients.mockResolvedValueOnce([{ id: "c1", nom: "Durand" }]);
    act(() => result.current.reload());
    expect(result.current.loadError).toBeNull();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.clients).toEqual([{ id: "c1", nom: "Durand" }]);
    expect(listClients).toHaveBeenCalledTimes(2);
  });
});
