import { describe, it, expect, vi, beforeEach } from "vitest";

// Valid 64-char hex string (32 bytes for AES-256)
const VALID_ENCRYPTION_KEY = "a".repeat(64);

function setRequiredEnv() {
  process.env.DATABASE_URL = "postgresql://localhost:5432/vault";
  process.env.NEXTAUTH_SECRET = "test-secret";
  process.env.ENCRYPTION_KEY = VALID_ENCRYPTION_KEY;
  process.env.PLAID_ENV = "sandbox";
  process.env.PLAID_CLIENT_ID = "test-client-id";
  process.env.PLAID_SECRET = "test-secret-key";
}

function clearAllEnv() {
  delete process.env.DATABASE_URL;
  delete process.env.NEXTAUTH_SECRET;
  delete process.env.ENCRYPTION_KEY;
  delete process.env.PLAID_ENV;
  delete process.env.PLAID_CLIENT_ID;
  delete process.env.PLAID_SECRET;
  delete process.env.PLAID_SECRET_SANDBOX;
  delete process.env.PLAID_SECRET_DEVELOPMENT;
  delete process.env.PLAID_SECRET_PRODUCTION;
  delete process.env.DEMO_MODE;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.NEXTAUTH_URL;
}

describe("validateEnv", () => {
  beforeEach(() => {
    clearAllEnv();
    vi.resetModules();
  });

  it("returns validated config when all required vars are present", async () => {
    setRequiredEnv();
    const { validateEnv } = await import("./env");
    const config = validateEnv();

    expect(config.databaseUrl).toBe("postgresql://localhost:5432/vault");
    expect(config.nextAuthSecret).toBe("test-secret");
    expect(config.encryptionKey).toBe(VALID_ENCRYPTION_KEY);
    expect(config.plaidEnv).toBe("sandbox");
    expect(config.plaidClientId).toBe("test-client-id");
    expect(config.plaidSecret).toBe("test-secret-key");
  });

  it("throws when DATABASE_URL is missing", async () => {
    setRequiredEnv();
    delete process.env.DATABASE_URL;
    const { validateEnv } = await import("./env");

    expect(() => validateEnv()).toThrow("DATABASE_URL");
  });

  it("throws when NEXTAUTH_SECRET is missing", async () => {
    setRequiredEnv();
    delete process.env.NEXTAUTH_SECRET;
    const { validateEnv } = await import("./env");

    expect(() => validateEnv()).toThrow("NEXTAUTH_SECRET");
  });

  it("throws when ENCRYPTION_KEY is missing", async () => {
    setRequiredEnv();
    delete process.env.ENCRYPTION_KEY;
    const { validateEnv } = await import("./env");

    expect(() => validateEnv()).toThrow("ENCRYPTION_KEY");
  });

  it("throws when ENCRYPTION_KEY is not exactly 64 hex characters", async () => {
    setRequiredEnv();
    process.env.ENCRYPTION_KEY = "abc123";
    const { validateEnv } = await import("./env");

    expect(() => validateEnv()).toThrow("64 hex characters");
  });

  it("throws when ENCRYPTION_KEY contains non-hex characters", async () => {
    setRequiredEnv();
    process.env.ENCRYPTION_KEY = "g".repeat(64);
    const { validateEnv } = await import("./env");

    expect(() => validateEnv()).toThrow("64 hex characters");
  });

  it("throws when PLAID_CLIENT_ID is missing and PLAID_ENV is set", async () => {
    setRequiredEnv();
    delete process.env.PLAID_CLIENT_ID;
    const { validateEnv } = await import("./env");

    expect(() => validateEnv()).toThrow("PLAID_CLIENT_ID");
  });

  it("throws when no Plaid secret is provided for the environment", async () => {
    setRequiredEnv();
    delete process.env.PLAID_SECRET;
    const { validateEnv } = await import("./env");

    expect(() => validateEnv()).toThrow(/PLAID_SECRET/);
  });

  it("accepts PLAID_SECRET_SANDBOX as a valid secret for sandbox env", async () => {
    setRequiredEnv();
    delete process.env.PLAID_SECRET;
    process.env.PLAID_SECRET_SANDBOX = "sandbox-secret";
    const { validateEnv } = await import("./env");

    const config = validateEnv();
    expect(config.plaidSecret).toBe("sandbox-secret");
  });

  it("accepts PLAID_SECRET_DEVELOPMENT for development env", async () => {
    setRequiredEnv();
    delete process.env.PLAID_SECRET;
    process.env.PLAID_ENV = "development";
    process.env.PLAID_SECRET_DEVELOPMENT = "dev-secret";
    const { validateEnv } = await import("./env");

    const config = validateEnv();
    expect(config.plaidSecret).toBe("dev-secret");
  });

  it("accepts PLAID_SECRET_PRODUCTION for production env", async () => {
    setRequiredEnv();
    delete process.env.PLAID_SECRET;
    process.env.PLAID_ENV = "production";
    process.env.PLAID_SECRET_PRODUCTION = "prod-secret";
    const { validateEnv } = await import("./env");

    const config = validateEnv();
    expect(config.plaidSecret).toBe("prod-secret");
  });

  it("skips all validation when DEMO_MODE is true", async () => {
    process.env.DEMO_MODE = "true";
    const { validateEnv } = await import("./env");

    const config = validateEnv();
    expect(config.demoMode).toBe(true);
  });

  it("logs warnings for missing optional vars", async () => {
    setRequiredEnv();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { validateEnv } = await import("./env");

    validateEnv();

    const warnings = warnSpy.mock.calls.map((call) => call.join(" "));
    expect(warnings.some((w) => w.includes("GOOGLE_CLIENT_ID"))).toBe(true);
    expect(warnings.some((w) => w.includes("GOOGLE_CLIENT_SECRET"))).toBe(true);
    expect(warnings.some((w) => w.includes("RESEND_API_KEY"))).toBe(true);

    warnSpy.mockRestore();
  });

  it("does not warn for optional vars that are set", async () => {
    setRequiredEnv();
    process.env.GOOGLE_CLIENT_ID = "gid";
    process.env.GOOGLE_CLIENT_SECRET = "gsec";
    process.env.RESEND_API_KEY = "rkey";
    process.env.EMAIL_FROM = "noreply@test.com";
    process.env.NEXTAUTH_URL = "http://localhost:3000";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { validateEnv } = await import("./env");

    validateEnv();

    const warnings = warnSpy.mock.calls.map((call) => call.join(" "));
    expect(warnings.some((w) => w.includes("GOOGLE_CLIENT_ID"))).toBe(false);

    warnSpy.mockRestore();
  });
});
