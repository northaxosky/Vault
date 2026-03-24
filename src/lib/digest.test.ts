import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    transaction: { findMany: vi.fn(), aggregate: vi.fn() },
    recurringStream: { findMany: vi.fn() },
    budget: { findMany: vi.fn() },
    account: { findMany: vi.fn() },
    alert: { count: vi.fn() },
  },
}));

import { generateWeeklyDigest } from "./digest";
import { prisma } from "@/lib/prisma";

describe("generateWeeklyDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct structure with no data", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      name: "Test",
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amount: null },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.recurringStream.findMany).mockResolvedValue([]);
    vi.mocked(prisma.budget.findMany).mockResolvedValue([]);
    vi.mocked(prisma.account.findMany).mockResolvedValue([]);
    vi.mocked(prisma.alert.count).mockResolvedValue(0);

    const digest = await generateWeeklyDigest("user-1");
    expect(digest.userName).toBe("Test");
    expect(digest.totalSpending).toBe(0);
    expect(digest.topCategories).toEqual([]);
    expect(digest.upcomingRecurring).toEqual([]);
    expect(digest.budgetStatus).toEqual([]);
    expect(digest.accountSummary).toEqual([]);
    expect(digest.alertCount).toBe(0);
  });

  it("calculates spending and categories correctly", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      name: "Test",
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { amount: 50.0, category: "FOOD_AND_DRINK" },
      { amount: 30.0, category: "FOOD_AND_DRINK" },
      { amount: 100.0, category: "SHOPPING" },
    ] as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amount: 150 },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.recurringStream.findMany).mockResolvedValue([]);
    vi.mocked(prisma.budget.findMany).mockResolvedValue([]);
    vi.mocked(prisma.account.findMany).mockResolvedValue([]);
    vi.mocked(prisma.alert.count).mockResolvedValue(0);

    const digest = await generateWeeklyDigest("user-1");
    expect(digest.totalSpending).toBe(180);
    expect(digest.topCategories).toHaveLength(2);
    expect(digest.topCategories[0].category).toBe("SHOPPING");
    expect(digest.topCategories[0].total).toBe(100);
  });

  it("calculates spending change percentage", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      name: "Test",
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { amount: 200, category: "SHOPPING" },
    ] as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amount: 100 },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.recurringStream.findMany).mockResolvedValue([]);
    vi.mocked(prisma.budget.findMany).mockResolvedValue([]);
    vi.mocked(prisma.account.findMany).mockResolvedValue([]);
    vi.mocked(prisma.alert.count).mockResolvedValue(0);

    const digest = await generateWeeklyDigest("user-1");
    expect(digest.spendingChange).toBe(100); // 200 is 100% more than 100
  });

  it("includes account summary", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      name: "Test",
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amount: null },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.recurringStream.findMany).mockResolvedValue([]);
    vi.mocked(prisma.budget.findMany).mockResolvedValue([]);
    vi.mocked(prisma.account.findMany).mockResolvedValue([
      { name: "Checking", type: "depository", currentBalance: 5000 },
      { name: "Credit Card", type: "credit", currentBalance: 500 },
    ] as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.alert.count).mockResolvedValue(3);

    const digest = await generateWeeklyDigest("user-1");
    expect(digest.accountSummary).toHaveLength(2);
    expect(digest.alertCount).toBe(3);
  });
});
