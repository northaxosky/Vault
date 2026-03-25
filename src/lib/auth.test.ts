import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock encryption module before importing auth
const mockEncrypt = vi.fn((value: string) => `encrypted:${value}`);
vi.mock("./encryption", () => ({
  encrypt: (value: string) => mockEncrypt(value),
}));

// Mock prisma
const mockPrismaOAuthAccountUpdate = vi.fn();
const mockPrismaOAuthAccountCreate = vi.fn();
const mockPrismaOAuthAccountFindUnique = vi.fn();
const mockPrismaUserFindUnique = vi.fn();
const mockPrismaUserCreate = vi.fn();
const mockPrismaUserUpdate = vi.fn();

vi.mock("./prisma", () => ({
  prisma: {
    oAuthAccount: {
      findUnique: (...args: unknown[]) => mockPrismaOAuthAccountFindUnique(...args),
      update: (...args: unknown[]) => mockPrismaOAuthAccountUpdate(...args),
      create: (...args: unknown[]) => mockPrismaOAuthAccountCreate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockPrismaUserFindUnique(...args),
      create: (...args: unknown[]) => mockPrismaUserCreate(...args),
      update: (...args: unknown[]) => mockPrismaUserUpdate(...args),
    },
  },
}));

// Mock other dependencies
vi.mock("./auth.config", () => ({ default: { callbacks: {} } }));
vi.mock("./demo", () => ({ isDemoMode: () => false }));
vi.mock("./demo-auth", () => ({ getDemoSession: () => null }));
vi.mock("next-auth/providers/credentials", () => ({ default: (cfg: unknown) => cfg }));
vi.mock("next-auth/providers/google", () => ({ default: (cfg: unknown) => cfg }));

// Capture the signIn callback from the NextAuth config
let capturedSignIn: (params: { user: Record<string, unknown>; account: Record<string, unknown> | null }) => Promise<boolean>;

vi.mock("next-auth", () => ({
  default: (config: { callbacks: { signIn: typeof capturedSignIn } }) => {
    capturedSignIn = config.callbacks.signIn;
    return {
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      handlers: { GET: vi.fn(), POST: vi.fn() },
    };
  },
}));

// Force module initialization by importing auth (triggers getNextAuth via proxy)
import "./auth";
import { handlers } from "./auth";

function triggerLazyInit() {
  // Access a handler property to trigger getNextAuth() and capture callbacks
  try { void (handlers as Record<string, unknown>).GET; } catch { /* ignore */ }
}

const baseAccount = {
  provider: "google",
  providerAccountId: "goog-123",
  type: "oidc",
  access_token: "at_secret",
  refresh_token: "rt_secret",
  id_token: "idt_secret",
  expires_at: 1700000000,
  token_type: "bearer",
  scope: "openid email",
};

describe("OAuth token encryption in signIn callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    triggerLazyInit();
  });

  it("encrypts tokens when updating an existing OAuth account", async () => {
    mockPrismaOAuthAccountFindUnique.mockResolvedValue({
      id: "oauth-1",
      user: { id: "user-1" },
    });

    const user = { email: "test@example.com" } as Record<string, unknown>;
    const result = await capturedSignIn({ user, account: { ...baseAccount } });

    expect(result).toBe(true);
    expect(mockPrismaOAuthAccountUpdate).toHaveBeenCalledOnce();

    const updateCall = mockPrismaOAuthAccountUpdate.mock.calls[0][0];
    expect(updateCall.data.accessToken).toBe("encrypted:at_secret");
    expect(updateCall.data.refreshToken).toBe("encrypted:rt_secret");
    expect(updateCall.data.idToken).toBe("encrypted:idt_secret");
    expect(mockEncrypt).toHaveBeenCalledWith("at_secret");
    expect(mockEncrypt).toHaveBeenCalledWith("rt_secret");
    expect(mockEncrypt).toHaveBeenCalledWith("idt_secret");
  });

  it("encrypts tokens when creating OAuth account for existing user", async () => {
    mockPrismaOAuthAccountFindUnique.mockResolvedValue(null);
    mockPrismaUserFindUnique.mockResolvedValue({
      id: "user-2",
      emailVerified: new Date(),
    });

    const user = { email: "existing@example.com" } as Record<string, unknown>;
    const result = await capturedSignIn({ user, account: { ...baseAccount } });

    expect(result).toBe(true);
    expect(mockPrismaOAuthAccountCreate).toHaveBeenCalledOnce();

    const createCall = mockPrismaOAuthAccountCreate.mock.calls[0][0];
    expect(createCall.data.accessToken).toBe("encrypted:at_secret");
    expect(createCall.data.refreshToken).toBe("encrypted:rt_secret");
    expect(createCall.data.idToken).toBe("encrypted:idt_secret");
  });

  it("encrypts tokens when creating new user with OAuth account", async () => {
    mockPrismaOAuthAccountFindUnique.mockResolvedValue(null);
    mockPrismaUserFindUnique.mockResolvedValue(null);
    mockPrismaUserCreate.mockResolvedValue({ id: "user-3" });

    const user = { email: "new@example.com", name: "New User" } as Record<string, unknown>;
    const result = await capturedSignIn({ user, account: { ...baseAccount } });

    expect(result).toBe(true);
    expect(mockPrismaUserCreate).toHaveBeenCalledOnce();

    const createCall = mockPrismaUserCreate.mock.calls[0][0];
    const oauthData = createCall.data.oauthAccounts.create;
    expect(oauthData.accessToken).toBe("encrypted:at_secret");
    expect(oauthData.refreshToken).toBe("encrypted:rt_secret");
    expect(oauthData.idToken).toBe("encrypted:idt_secret");
  });

  it("handles null tokens without calling encrypt", async () => {
    mockPrismaOAuthAccountFindUnique.mockResolvedValue({
      id: "oauth-1",
      user: { id: "user-1" },
    });

    const nullTokenAccount = {
      ...baseAccount,
      access_token: undefined,
      refresh_token: null,
      id_token: undefined,
    };

    const user = { email: "test@example.com" } as Record<string, unknown>;
    await capturedSignIn({ user, account: nullTokenAccount });

    const updateCall = mockPrismaOAuthAccountUpdate.mock.calls[0][0];
    expect(updateCall.data.accessToken).toBeNull();
    expect(updateCall.data.refreshToken).toBeNull();
    expect(updateCall.data.idToken).toBeNull();
    // encrypt should not be called for null/undefined tokens
    expect(mockEncrypt).not.toHaveBeenCalled();
  });

  it("does not encrypt non-sensitive fields like scope and tokenType", async () => {
    mockPrismaOAuthAccountFindUnique.mockResolvedValue(null);
    mockPrismaUserFindUnique.mockResolvedValue({
      id: "user-2",
      emailVerified: new Date(),
    });

    const user = { email: "test@example.com" } as Record<string, unknown>;
    await capturedSignIn({ user, account: { ...baseAccount } });

    const createCall = mockPrismaOAuthAccountCreate.mock.calls[0][0];
    expect(createCall.data.scope).toBe("openid email");
    expect(createCall.data.tokenType).toBe("bearer");
    expect(createCall.data.expiresAt).toBe(1700000000);
  });
});
