import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    debtAccount: { findMany: vi.fn() },
  },
}));

import { GET } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockFindMany = vi.mocked(prisma.debtAccount.findMany);

describe("GET /api/widgets/debt-summary", () => {
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

  it("returns zeros when no debts", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindMany.mockResolvedValue([] as never);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.debts).toEqual([]);
    expect(body.totalDebt).toBe(0);
    expect(body.averageRate).toBe(0);
    expect(body.totalMinPayment).toBe(0);
  });

  it("calculates totalDebt correctly", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindMany.mockResolvedValue([
      { name: "Card A", balance: 5000, interestRate: 20, minimumPayment: 100 },
      { name: "Card B", balance: 3000, interestRate: 15, minimumPayment: 60 },
    ] as never);

    const response = await GET();
    const body = await response.json();

    expect(body.totalDebt).toBe(8000);
    expect(body.totalMinPayment).toBe(160);
  });

  it("calculates weighted average rate correctly", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    // weighted avg = (5000*20 + 3000*15) / (5000+3000) = (100000+45000)/8000 = 18.125
    mockFindMany.mockResolvedValue([
      { name: "Card A", balance: 5000, interestRate: 20, minimumPayment: 100 },
      { name: "Card B", balance: 3000, interestRate: 15, minimumPayment: 60 },
    ] as never);

    const response = await GET();
    const body = await response.json();

    expect(body.averageRate).toBe(18.13);
  });

  it("sorts debts by balance descending", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindMany.mockResolvedValue([
      { name: "Big Loan", balance: 10000, interestRate: 5, minimumPayment: 200 },
      { name: "Small Card", balance: 500, interestRate: 25, minimumPayment: 25 },
    ] as never);

    const response = await GET();
    const body = await response.json();

    expect(body.debts[0].name).toBe("Big Loan");
    expect(body.debts[0].balance).toBe(10000);
    expect(body.debts[1].name).toBe("Small Card");
    expect(body.debts[1].balance).toBe(500);

    // Verify findMany was called with descending balance order
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { balance: "desc" },
      }),
    );
  });
});
