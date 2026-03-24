import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savingsGoal: { findMany: vi.fn() },
  },
}));

import { GET } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockFindMany = vi.mocked(prisma.savingsGoal.findMany);

describe("GET /api/widgets/savings-goals", () => {
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

  it("returns empty array when no goals", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindMany.mockResolvedValue([] as never);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.goals).toEqual([]);
  });

  it("returns goals with correct percentage calculation", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindMany.mockResolvedValue([
      {
        name: "Emergency Fund",
        targetAmount: 10000,
        currentAmount: 7500,
        deadline: new Date("2025-12-31"),
      },
      {
        name: "Vacation",
        targetAmount: 3000,
        currentAmount: 1200,
        deadline: null,
      },
    ] as never);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.goals).toHaveLength(2);

    expect(body.goals[0]).toEqual({
      name: "Emergency Fund",
      target: 10000,
      current: 7500,
      percentage: 75,
      deadline: "2025-12-31T00:00:00.000Z",
    });

    expect(body.goals[1]).toEqual({
      name: "Vacation",
      target: 3000,
      current: 1200,
      percentage: 40,
      deadline: null,
    });
  });

  it("caps percentage at 100 when currentAmount exceeds targetAmount", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindMany.mockResolvedValue([
      {
        name: "Overfunded Goal",
        targetAmount: 5000,
        currentAmount: 7000,
        deadline: null,
      },
    ] as never);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.goals[0].percentage).toBe(100);
    expect(body.goals[0].current).toBe(7000);
  });
});
