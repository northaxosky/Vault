import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth and prisma before importing the route
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    account: { findMany: vi.fn() },
    recurringStream: { findMany: vi.fn() },
    transaction: { count: vi.fn() },
  },
}));

import { GET } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockAccountFindMany = vi.mocked(prisma.account.findMany);
const mockRecurringFindMany = vi.mocked(prisma.recurringStream.findMany);
const mockTransactionCount = vi.mocked(prisma.transaction.count);

describe("GET /api/credit-score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} } as never);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns valid credit score when authenticated", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1" },
    } as never);

    mockAccountFindMany.mockResolvedValue([
      {
        type: "depository",
        currentBalance: 5000,
        availableBalance: 5000,
        createdAt: new Date("2023-01-01"),
      },
      {
        type: "credit",
        currentBalance: 1000,
        availableBalance: 4000,
        createdAt: new Date("2023-06-01"),
      },
    ] as never);

    mockRecurringFindMany.mockResolvedValue([
      { isActive: true, cancelledByUser: false },
      { isActive: true, cancelledByUser: false },
      { isActive: false, cancelledByUser: false },
    ] as never);

    mockTransactionCount.mockResolvedValue(45 as never);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.score).toBeGreaterThanOrEqual(300);
    expect(body.score).toBeLessThanOrEqual(850);
    expect(body.rating).toBeDefined();
    expect(body.factors).toHaveLength(5);
    expect(body.factors[0]).toHaveProperty("name");
    expect(body.factors[0]).toHaveProperty("score");
    expect(body.factors[0]).toHaveProperty("weight");
    expect(body.factors[0]).toHaveProperty("impact");
    expect(body.factors[0]).toHaveProperty("detail");
  });
});
