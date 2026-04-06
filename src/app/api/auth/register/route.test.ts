import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    verificationToken: { create: vi.fn() },
  },
}));

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn() },
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockCreate = vi.mocked(prisma.user.create);
const mockTokenCreate = vi.mocked(prisma.verificationToken.create);
const mockSendVerification = vi.mocked(sendVerificationEmail);
const mockRateLimit = vi.mocked(rateLimit);
const mockHash = vi.mocked(bcrypt.hash);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

const VALID_PASSWORD = "SecurePass123!";

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockReturnValue({ success: true, remaining: 4, resetAt: Date.now() + 900000 });
    mockHash.mockResolvedValue("hashed-password" as never);
    mockCreate.mockResolvedValue({} as never);
    mockTokenCreate.mockResolvedValue({} as never);
    mockSendVerification.mockResolvedValue(undefined as never);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockReturnValue({ success: false, remaining: 0, resetAt: Date.now() + 900000 });

    const response = await POST(makeRequest({ email: "a@b.com", password: VALID_PASSWORD }));

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe("Too many requests");
    expect(response.headers.get("Retry-After")).toBe("900");
  });

  it("returns 400 when email is missing", async () => {
    const response = await POST(makeRequest({ password: VALID_PASSWORD }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Email and password are required");
  });

  it("returns 400 when password is missing", async () => {
    const response = await POST(makeRequest({ email: "test@example.com" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Email and password are required");
  });

  it("returns 400 when password is too short", async () => {
    const response = await POST(makeRequest({ email: "test@example.com", password: "Short1!" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Password must be at least 12 characters");
  });

  it("returns 400 when password lacks uppercase letter", async () => {
    const response = await POST(makeRequest({ email: "test@example.com", password: "securepass123!" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Password must contain an uppercase letter");
  });

  it("returns 400 when password lacks special character", async () => {
    const response = await POST(makeRequest({ email: "test@example.com", password: "SecurePass1234" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Password must contain a special character");
  });

  it("returns 200 with generic message when user already exists", async () => {
    mockFindUnique.mockResolvedValue({ id: "existing-user" } as never);

    const response = await POST(makeRequest({ email: "existing@example.com", password: VALID_PASSWORD }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain("Registration successful");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates user and sends verification email for new registration", async () => {
    mockFindUnique.mockResolvedValue(null as never);

    const response = await POST(
      makeRequest({ email: "new@example.com", password: VALID_PASSWORD, name: "john doe" })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain("Registration successful");

    expect(mockHash).toHaveBeenCalledWith(VALID_PASSWORD, 12);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        email: "new@example.com",
        name: "John Doe",
        passwordHash: "hashed-password",
      },
    });
    expect(mockTokenCreate).toHaveBeenCalled();
    expect(mockSendVerification).toHaveBeenCalledWith("new@example.com", expect.any(String));
  });

  it("formats name with capitalized words", async () => {
    mockFindUnique.mockResolvedValue(null as never);

    await POST(makeRequest({ email: "a@b.com", password: VALID_PASSWORD, name: "jane smith" }));

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Jane Smith" }),
    });
  });

  it("handles null name gracefully", async () => {
    mockFindUnique.mockResolvedValue(null as never);

    await POST(makeRequest({ email: "a@b.com", password: VALID_PASSWORD }));

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: null }),
    });
  });

  it("succeeds even when verification email fails", async () => {
    mockFindUnique.mockResolvedValue(null as never);
    mockSendVerification.mockRejectedValue(new Error("SMTP down"));

    const response = await POST(makeRequest({ email: "a@b.com", password: VALID_PASSWORD }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain("Registration successful");
  });

  it("returns identical response for existing and new users to prevent enumeration", async () => {
    mockFindUnique.mockResolvedValue({ id: "existing" } as never);
    const existingResponse = await POST(makeRequest({ email: "a@b.com", password: VALID_PASSWORD }));
    const existingBody = await existingResponse.json();

    mockFindUnique.mockResolvedValue(null as never);
    const newResponse = await POST(makeRequest({ email: "b@c.com", password: VALID_PASSWORD }));
    const newBody = await newResponse.json();

    expect(existingResponse.status).toBe(newResponse.status);
    expect(existingBody.message).toBe(newBody.message);
  });
});
