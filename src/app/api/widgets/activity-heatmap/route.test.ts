import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/demo", () => ({
  isDemoMode: vi.fn(() => false),
}));

import { GET } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

const mockAuth = vi.mocked(auth);
const mockFindMany = vi.mocked(prisma.transaction.findMany);
const mockIsDemoMode = vi.mocked(isDemoMode);

describe("GET /api/widgets/activity-heatmap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const response = await GET();
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns array of day objects in demo mode", async () => {
    mockIsDemoMode.mockReturnValue(true);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.days)).toBe(true);
    expect(body.days.length).toBe(90);
  });

  it("each day has date and count fields", async () => {
    mockIsDemoMode.mockReturnValue(true);

    const response = await GET();
    const body = await response.json();

    for (const day of body.days) {
      expect(day).toHaveProperty("date");
      expect(day).toHaveProperty("count");
      expect(typeof day.date).toBe("string");
      expect(typeof day.count).toBe("number");
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day.count).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns 90 days of data", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindMany.mockResolvedValue([] as never);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.days).toHaveLength(90);
  });

  it("demo mode returns deterministic data", async () => {
    mockIsDemoMode.mockReturnValue(true);

    const res1 = await GET();
    const body1 = await res1.json();

    const res2 = await GET();
    const body2 = await res2.json();

    expect(body1.days).toEqual(body2.days);
  });

  it("counts transactions per day correctly", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    mockFindMany.mockResolvedValue([
      { date: new Date(todayStr) },
      { date: new Date(todayStr) },
      { date: new Date(todayStr) },
    ] as never);

    const response = await GET();
    const body = await response.json();

    const todayEntry = body.days.find(
      (d: { date: string }) => d.date === todayStr
    );
    expect(todayEntry).toBeDefined();
    expect(todayEntry.count).toBe(3);
  });
});
