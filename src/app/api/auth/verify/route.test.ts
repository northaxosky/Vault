import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationToken: { findUnique: vi.fn(), delete: vi.fn() },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";

const mockFindUnique = vi.mocked(prisma.verificationToken.findUnique);
const mockDelete = vi.mocked(prisma.verificationToken.delete);
const mockTransaction = vi.mocked(prisma.$transaction);

function makeRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost/api/auth/verify?token=${token}`
    : "http://localhost/api/auth/verify";
  return new NextRequest(url);
}

describe("GET /api/auth/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockResolvedValue(undefined as never);
  });

  it("redirects to login with error when token is missing", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toContain("/login?error=invalid-token");
  });

  it("redirects to login with error when token does not exist", async () => {
    mockFindUnique.mockResolvedValue(null as never);

    const response = await GET(makeRequest("nonexistent"));

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toContain("/login?error=invalid-token");
  });

  it("redirects to login with error and deletes expired token", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vt-1",
      email: "user@example.com",
      token: "expired-token",
      expires: new Date(Date.now() - 1000),
    } as never);
    mockDelete.mockResolvedValue({} as never);

    const response = await GET(makeRequest("expired-token"));

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toContain("/login?error=invalid-token");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "vt-1" } });
  });

  it("verifies email and redirects to dashboard on success", async () => {
    const futureDate = new Date(Date.now() + 86400000);
    mockFindUnique.mockResolvedValue({
      id: "vt-1",
      email: "user@example.com",
      token: "valid-token",
      expires: futureDate,
    } as never);
    const mockUserUpdate = vi.mocked(prisma.user.update);

    const response = await GET(makeRequest("valid-token"));

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toContain("/dashboard?verified=true");

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
      data: { emailVerified: expect.any(Date) },
    });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "vt-1" } });
  });
});
