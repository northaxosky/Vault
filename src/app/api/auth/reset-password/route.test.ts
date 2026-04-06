import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    passwordResetToken: { findUnique: vi.fn(), delete: vi.fn() },
    user: { update: vi.fn() },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn() },
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

const mockFindUnique = vi.mocked(prisma.passwordResetToken.findUnique);
const mockDelete = vi.mocked(prisma.passwordResetToken.delete);
const mockUserUpdate = vi.mocked(prisma.user.update);
const mockRateLimit = vi.mocked(rateLimit);
const mockHash = vi.mocked(bcrypt.hash);

const VALID_PASSWORD = "NewSecurePass1!";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockReturnValue({ success: true, remaining: 4, resetAt: Date.now() + 900000 });
    mockHash.mockResolvedValue("new-hashed-password" as never);
    mockUserUpdate.mockResolvedValue({} as never);
    mockDelete.mockResolvedValue({} as never);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockReturnValue({ success: false, remaining: 0, resetAt: Date.now() + 900000 });

    const response = await POST(makeRequest({ token: "abc", password: VALID_PASSWORD }));

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe("Too many requests");
  });

  it("returns 400 when token is missing", async () => {
    const response = await POST(makeRequest({ password: VALID_PASSWORD }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Token and password are required");
  });

  it("returns 400 when password is missing", async () => {
    const response = await POST(makeRequest({ token: "valid-token" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Token and password are required");
  });

  it("returns 400 when password fails validation", async () => {
    const response = await POST(makeRequest({ token: "valid-token", password: "weak" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Password must be at least 12 characters");
  });

  it("returns 400 when token does not exist", async () => {
    mockFindUnique.mockResolvedValue(null as never);

    const response = await POST(makeRequest({ token: "nonexistent", password: VALID_PASSWORD }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid or expired reset link");
  });

  it("returns 400 when token is expired", async () => {
    mockFindUnique.mockResolvedValue({
      id: "tok-1",
      email: "user@example.com",
      token: "expired-token",
      expires: new Date(Date.now() - 1000),
    } as never);

    const response = await POST(makeRequest({ token: "expired-token", password: VALID_PASSWORD }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid or expired reset link");
  });

  it("resets password and deletes token on success", async () => {
    const futureDate = new Date(Date.now() + 3600000);
    mockFindUnique.mockResolvedValue({
      id: "tok-1",
      email: "user@example.com",
      token: "valid-token",
      expires: futureDate,
    } as never);

    const response = await POST(makeRequest({ token: "valid-token", password: VALID_PASSWORD }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBe("Password reset successfully");

    expect(mockHash).toHaveBeenCalledWith(VALID_PASSWORD, 12);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
      data: { passwordHash: "new-hashed-password" },
    });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "tok-1" } });
  });

  it("returns 500 when an unexpected error occurs", async () => {
    mockFindUnique.mockRejectedValue(new Error("DB error"));

    const response = await POST(makeRequest({ token: "any", password: VALID_PASSWORD }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Something went wrong");
  });
});
