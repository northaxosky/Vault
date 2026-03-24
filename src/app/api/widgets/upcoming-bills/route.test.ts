import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { recurringStream: { findMany: vi.fn() } },
}));

import { GET } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockFindMany = vi.mocked(prisma.recurringStream.findMany);

describe("GET /api/widgets/upcoming-bills", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns empty array when no upcoming bills", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindMany.mockResolvedValue([] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bills).toEqual([]);
  });

  it("returns bills sorted by date", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    mockFindMany.mockResolvedValue([
      {
        merchantName: "Netflix",
        description: "NETFLIX.COM",
        lastAmount: 15.99,
        predictedNextDate: tomorrow,
        frequency: "MONTHLY",
      },
      {
        merchantName: "Spotify",
        description: "SPOTIFY USA",
        lastAmount: 9.99,
        predictedNextDate: nextWeek,
        frequency: "MONTHLY",
      },
    ] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.bills).toHaveLength(2);
    expect(body.bills[0].name).toBe("Netflix");
    expect(body.bills[0].amount).toBe(15.99);
    expect(body.bills[1].name).toBe("Spotify");
    expect(body.bills[1].amount).toBe(9.99);

    // Verify ascending date order
    expect(new Date(body.bills[0].date).getTime()).toBeLessThan(
      new Date(body.bills[1].date).getTime(),
    );
  });

  it("filters out cancelled streams", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindMany.mockResolvedValue([] as never);

    await GET();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          cancelledByUser: false,
        }),
        orderBy: { predictedNextDate: "asc" },
      }),
    );
  });

  it("uses description as fallback when merchantName is null", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    mockFindMany.mockResolvedValue([
      {
        merchantName: null,
        description: "ACH PAYMENT ELECTRIC CO",
        lastAmount: 120.0,
        predictedNextDate: tomorrow,
        frequency: "MONTHLY",
      },
    ] as never);

    const res = await GET();
    const body = await res.json();

    expect(body.bills[0].name).toBe("ACH PAYMENT ELECTRIC CO");
  });

  it("includes frequency in the response", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    mockFindMany.mockResolvedValue([
      {
        merchantName: "Gym",
        description: "GYM MEMBERSHIP",
        lastAmount: 49.99,
        predictedNextDate: tomorrow,
        frequency: "BIWEEKLY",
      },
    ] as never);

    const res = await GET();
    const body = await res.json();

    expect(body.bills[0].frequency).toBe("BIWEEKLY");
  });
});
