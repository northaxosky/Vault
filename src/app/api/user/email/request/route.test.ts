import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    emailChangeToken: { deleteMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/email", () => ({
  sendEmailChangeVerification: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));

const mockCompare = vi.fn();
vi.mock("bcryptjs", () => ({
  default: { compare: (...args: unknown[]) => mockCompare(...args) },
  compare: (...args: unknown[]) => mockCompare(...args),
}));

import { POST } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailChangeVerification } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/user/email/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/user/email/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockReturnValue({ success: true, remaining: 4, resetAt: 0 });
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const res = await POST(makeRequest({ newEmail: "new@test.com", password: "pass" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when newEmail or password missing", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);

    const res1 = await POST(makeRequest({ newEmail: "", password: "pass" }));
    expect(res1.status).toBe(400);

    const res2 = await POST(makeRequest({ newEmail: "new@test.com", password: "" }));
    expect(res2.status).toBe(400);
  });

  it("returns 400 when newEmail same as current email", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      email: "current@test.com",
      passwordHash: "$2a$10$hashedpassword",
    } as never);

    const res = await POST(makeRequest({ newEmail: "current@test.com", password: "pass" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("different");
  });

  it("returns 409 when newEmail already taken by another user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      email: "current@test.com",
      passwordHash: "$2a$10$hashedpassword",
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "u2",
      email: "taken@test.com",
    } as never);

    mockCompare.mockResolvedValueOnce(true);

    const res = await POST(makeRequest({ newEmail: "taken@test.com", password: "correctpass" }));
    expect(res.status).toBe(409);
  });

  it("returns 401 when password is incorrect", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      email: "current@test.com",
      passwordHash: "$2a$10$hashedpassword",
    } as never);

    mockCompare.mockResolvedValueOnce(false);

    const res = await POST(makeRequest({ newEmail: "new@test.com", password: "wrongpass" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 and sends email on success", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      email: "current@test.com",
      passwordHash: "$2a$10$hashedpassword",
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);

    mockCompare.mockResolvedValueOnce(true);

    vi.mocked(prisma.emailChangeToken.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.emailChangeToken.create).mockResolvedValue({} as never);
    vi.mocked(sendEmailChangeVerification).mockResolvedValue({} as never);

    const res = await POST(makeRequest({ newEmail: "new@test.com", password: "correctpass" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.message).toContain("Verification email sent");

    expect(prisma.emailChangeToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
    expect(prisma.emailChangeToken.create).toHaveBeenCalled();
    expect(sendEmailChangeVerification).toHaveBeenCalledWith("new@test.com", expect.any(String));
  });
});
