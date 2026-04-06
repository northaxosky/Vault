import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    verificationToken: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn(),
}));

import { POST } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

const mockAuth = vi.mocked(auth);
const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockTransaction = vi.mocked(prisma.$transaction);
const mockSendVerification = vi.mocked(sendVerificationEmail);

describe("POST /api/auth/verify/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockResolvedValue(undefined as never);
    mockSendVerification.mockResolvedValue(undefined as never);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const response = await POST();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when session has no email", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await POST();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when email is already verified", async () => {
    mockAuth.mockResolvedValue({ user: { email: "user@example.com" } } as never);
    mockFindUnique.mockResolvedValue({ emailVerified: new Date() } as never);

    const response = await POST();

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Email already verified");
  });

  it("sends verification email for unverified user", async () => {
    mockAuth.mockResolvedValue({ user: { email: "user@example.com" } } as never);
    mockFindUnique.mockResolvedValue({ emailVerified: null } as never);
    const mockDeleteMany = vi.mocked(prisma.verificationToken.deleteMany);
    const mockTokenCreate = vi.mocked(prisma.verificationToken.create);

    const response = await POST();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBe("Verification email sent");

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { email: "user@example.com" } });
    expect(mockTokenCreate).toHaveBeenCalledWith({
      data: {
        email: "user@example.com",
        token: expect.any(String),
        expires: expect.any(Date),
      },
    });
    expect(mockSendVerification).toHaveBeenCalledWith("user@example.com", expect.any(String));
  });
});
