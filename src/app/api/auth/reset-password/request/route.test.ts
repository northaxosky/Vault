import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockDeleteMany = vi.mocked(prisma.passwordResetToken.deleteMany);
const mockTokenCreate = vi.mocked(prisma.passwordResetToken.create);
const mockSendReset = vi.mocked(sendPasswordResetEmail);
const mockRateLimit = vi.mocked(rateLimit);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/reset-password/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/reset-password/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockReturnValue({ success: true, remaining: 4, resetAt: Date.now() + 900000 });
    mockDeleteMany.mockResolvedValue({ count: 0 } as never);
    mockTokenCreate.mockResolvedValue({} as never);
    mockSendReset.mockResolvedValue(undefined as never);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockReturnValue({ success: false, remaining: 0, resetAt: Date.now() + 900000 });

    const response = await POST(makeRequest({ email: "test@example.com" }));

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe("Too many requests");
  });

  it("returns 200 with generic message when email is missing", async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain("If an account exists");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 200 with generic message when user does not exist", async () => {
    mockFindUnique.mockResolvedValue(null as never);

    const response = await POST(makeRequest({ email: "nobody@example.com" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain("If an account exists");
    expect(mockTokenCreate).not.toHaveBeenCalled();
    expect(mockSendReset).not.toHaveBeenCalled();
  });

  it("creates token and sends reset email for existing user", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" } as never);

    const response = await POST(makeRequest({ email: "user@example.com" }));

    expect(response.status).toBe(200);
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { email: "user@example.com" } });
    expect(mockTokenCreate).toHaveBeenCalledWith({
      data: {
        email: "user@example.com",
        token: expect.any(String),
        expires: expect.any(Date),
      },
    });
    expect(mockSendReset).toHaveBeenCalledWith("user@example.com", expect.any(String));
  });

  it("deletes existing tokens before creating new one", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" } as never);

    await POST(makeRequest({ email: "user@example.com" }));

    const deleteOrder = mockDeleteMany.mock.invocationCallOrder[0];
    const createOrder = mockTokenCreate.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });

  it("returns identical response regardless of email existence to prevent enumeration", async () => {
    mockFindUnique.mockResolvedValue(null as never);
    const nonExistentResponse = await POST(makeRequest({ email: "nobody@example.com" }));
    const nonExistentBody = await nonExistentResponse.json();

    mockFindUnique.mockResolvedValue({ id: "user-1" } as never);
    const existingResponse = await POST(makeRequest({ email: "exists@example.com" }));
    const existingBody = await existingResponse.json();

    expect(nonExistentResponse.status).toBe(existingResponse.status);
    expect(nonExistentBody.message).toBe(existingBody.message);
  });

  it("returns 200 even when an internal error occurs", async () => {
    mockFindUnique.mockRejectedValue(new Error("DB connection failed"));

    const response = await POST(makeRequest({ email: "user@example.com" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain("If an account exists");
  });
});
