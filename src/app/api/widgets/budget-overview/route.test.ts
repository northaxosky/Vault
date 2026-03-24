import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    budget: { findMany: vi.fn() },
    transaction: { findMany: vi.fn() },
  },
}));

import { GET } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockBudgetFindMany = vi.mocked(prisma.budget.findMany);
const mockTransactionFindMany = vi.mocked(prisma.transaction.findMany);

describe("GET /api/widgets/budget-overview", () => {
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

  it("returns empty array when no budgets", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockBudgetFindMany.mockResolvedValue([] as never);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.budgets).toEqual([]);
    expect(mockTransactionFindMany).not.toHaveBeenCalled();
  });

  it("returns budgets with correct spending calculation", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    mockBudgetFindMany.mockResolvedValue([
      { id: "b1", userId: "user-1", category: "FOOD_AND_DRINK", amount: 500 },
    ] as never);

    mockTransactionFindMany.mockResolvedValue([
      { amount: 25.5, category: "FOOD_AND_DRINK", userCategory: null },
      { amount: 30.0, category: "FOOD_AND_DRINK", userCategory: null },
      { amount: 15.0, category: "OTHER", userCategory: "FOOD_AND_DRINK" },
    ] as never);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.budgets).toHaveLength(1);
    expect(body.budgets[0]).toEqual({
      category: "FOOD_AND_DRINK",
      label: "Food & Drink",
      spent: 70.5,
      limit: 500,
      percentage: 14,
    });
  });

  it("sorts by percentage descending", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    mockBudgetFindMany.mockResolvedValue([
      { id: "b1", userId: "user-1", category: "FOOD_AND_DRINK", amount: 500 },
      { id: "b2", userId: "user-1", category: "ENTERTAINMENT", amount: 100 },
      { id: "b3", userId: "user-1", category: "TRANSPORTATION", amount: 200 },
    ] as never);

    mockTransactionFindMany.mockResolvedValue([
      { amount: 50, category: "FOOD_AND_DRINK", userCategory: null },
      { amount: 90, category: "ENTERTAINMENT", userCategory: null },
      { amount: 100, category: "TRANSPORTATION", userCategory: null },
    ] as never);

    const response = await GET();
    const body = await response.json();

    expect(body.budgets).toHaveLength(3);
    expect(body.budgets[0].category).toBe("ENTERTAINMENT");
    expect(body.budgets[0].percentage).toBe(90);
    expect(body.budgets[1].category).toBe("TRANSPORTATION");
    expect(body.budgets[1].percentage).toBe(50);
    expect(body.budgets[2].category).toBe("FOOD_AND_DRINK");
    expect(body.budgets[2].percentage).toBe(10);
  });

  it("handles budget with zero spending", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    mockBudgetFindMany.mockResolvedValue([
      { id: "b1", userId: "user-1", category: "TRAVEL", amount: 1000 },
    ] as never);

    mockTransactionFindMany.mockResolvedValue([] as never);

    const response = await GET();
    const body = await response.json();

    expect(body.budgets).toHaveLength(1);
    expect(body.budgets[0]).toEqual({
      category: "TRAVEL",
      label: "Travel",
      spent: 0,
      limit: 1000,
      percentage: 0,
    });
  });
});
