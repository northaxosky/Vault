import { describe, it, expect, beforeEach, vi } from "vitest";

describe("isDemoMode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("returns false when DEMO_MODE is not set", async () => {
    vi.stubEnv("DEMO_MODE", "");
    const { isDemoMode } = await import("./demo");
    expect(isDemoMode()).toBe(false);
  });

  it("returns true when DEMO_MODE is 'true'", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const { isDemoMode } = await import("./demo");
    expect(isDemoMode()).toBe(true);
  });

  it("logs a security warning when DEMO_MODE is enabled in production", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { isDemoMode } = await import("./demo");
    isDemoMode();

    expect(warnSpy).toHaveBeenCalledWith(
      "[SECURITY WARNING] DEMO_MODE is enabled in production! This bypasses authentication.",
    );
  });

  it("only logs the production warning once (debounced)", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { isDemoMode } = await import("./demo");
    isDemoMode();
    isDemoMode();
    isDemoMode();

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("does not log a warning in development mode", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { isDemoMode } = await import("./demo");
    isDemoMode();

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
