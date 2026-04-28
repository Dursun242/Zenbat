import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./supabase.js", () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

import { getToken } from "./getToken.js";
import { supabase } from "./supabase.js";

describe("getToken", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("retourne le access_token quand une session existe", async () => {
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: { access_token: "tok-123" } },
    });
    expect(await getToken()).toBe("tok-123");
  });

  it("retourne null quand la session est absente", async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    expect(await getToken()).toBeNull();
  });

  it("retourne null quand session.access_token est absent", async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: {} } });
    expect(await getToken()).toBeNull();
  });

  it("interroge bien supabase à chaque appel (anti-cache state React)", async () => {
    supabase.auth.getSession
      .mockResolvedValueOnce({ data: { session: { access_token: "a" } } })
      .mockResolvedValueOnce({ data: { session: { access_token: "b" } } });

    expect(await getToken()).toBe("a");
    expect(await getToken()).toBe("b");
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(2);
  });
});
