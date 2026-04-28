import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logError, logInfo, getSessionId } from "./logger.js";

describe("logger", () => {
  beforeEach(() => { window.AppLogger = undefined; });
  afterEach(()  => { window.AppLogger = undefined; });

  describe("logError", () => {
    it("appelle window.AppLogger.logError avec les arguments", () => {
      const fn = vi.fn();
      window.AppLogger = { logError: fn };
      logError("oops", "stack", { ctx: 1 });
      expect(fn).toHaveBeenCalledWith("oops", "stack", { ctx: 1 });
    });

    it("ne crash pas si AppLogger est absent", () => {
      expect(() => logError("oops")).not.toThrow();
    });

    it("ne crash pas si logError est absent sur AppLogger", () => {
      window.AppLogger = {};
      expect(() => logError("oops")).not.toThrow();
    });
  });

  describe("logInfo", () => {
    it("appelle window.AppLogger.logInfo avec les arguments", () => {
      const fn = vi.fn();
      window.AppLogger = { logInfo: fn };
      logInfo("ok", { ctx: 2 });
      expect(fn).toHaveBeenCalledWith("ok", { ctx: 2 });
    });

    it("ne crash pas si AppLogger est absent", () => {
      expect(() => logInfo("ok")).not.toThrow();
    });
  });

  describe("getSessionId", () => {
    it("retourne sessionId depuis AppLogger", () => {
      window.AppLogger = { sessionId: "sess-42" };
      expect(getSessionId()).toBe("sess-42");
    });

    it("retourne null si AppLogger absent", () => {
      expect(getSessionId()).toBeNull();
    });

    it("retourne null si sessionId absent sur AppLogger", () => {
      window.AppLogger = {};
      expect(getSessionId()).toBeNull();
    });
  });
});
