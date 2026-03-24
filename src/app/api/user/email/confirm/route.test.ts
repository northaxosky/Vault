import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailChangeToken: { findUnique: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";

function makeRequest(token?: string) {
  const url = token
    ? `http://localhost/api/user/email/confirm?token=${token}`
    : "http://localhost/api/user/email/confirm";
  return new Request(url, { method: "GET" });
}

describe("GET /api/user/email/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to error when no token provided", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("email-error=true");
  });

  it("redirects to error when token is invalid/not found", async () => {
    vi.mocked(prisma.emailChangeToken.findUnique).mockResolvedValue(null as never);

    const res = await GET(makeRequest("invalid-token"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("email-error=true");
  });

  it("redirects to error when token is expired", async () => {
    vi.mocked(prisma.emailChangeToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      newEmail: "new@test.com",
      token: "expired-token",
      expires: new Date(Date.now() - 1000), // expired
    } as never);

    const res = await GET(makeRequest("expired-token"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("email-error=true");
    expect(prisma.emailChangeToken.delete).toHaveBeenCalledWith({
      where: { id: "t1" },
    });
  });

  it("redirects to success when token is valid", async () => {
    vi.mocked(prisma.emailChangeToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      newEmail: "new@test.com",
      token: "valid-token",
      expires: new Date(Date.now() + 3600000), // 1 hour from now
    } as never);
    // newEmail not taken
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    vi.mocked(prisma.emailChangeToken.delete).mockResolvedValue({} as never);

    const res = await GET(makeRequest("valid-token"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("email-changed=true");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        email: "new@test.com",
        emailVerified: expect.any(Date),
      },
    });
  });
});
