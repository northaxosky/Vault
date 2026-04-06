import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    recurringStream: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn() }));

import { GET, PATCH, DELETE } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

const mockAuth = vi.mocked(auth);
const mockIsDemoMode = vi.mocked(isDemoMode);
const mockFindMany = vi.mocked(prisma.recurringStream.findMany);
const mockFindUnique = vi.mocked(prisma.recurringStream.findUnique);
const mockUpdate = vi.mocked(prisma.recurringStream.update);
const mockDelete = vi.mocked(prisma.recurringStream.delete);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeStream(overrides = {}) {
  return {
    id: "stream-1",
    plaidStreamId: "plaid-s1",
    merchantName: "Netflix",
    description: "Monthly subscription",
    category: "ENTERTAINMENT",
    subcategory: null,
    firstDate: new Date("2024-01-01"),
    lastDate: new Date("2024-06-01"),
    lastAmount: 15.99,
    averageAmount: 15.99,
    predictedNextDate: new Date("2024-07-01"),
    frequency: "MONTHLY",
    isActive: true,
    status: "MATURE",
    streamType: "EXPENSE",
    currency: "USD",
    cancelledByUser: false,
    cancelledAt: null,
    account: { name: "Checking" },
    ...overrides,
  };
}

describe("/api/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  // --- GET ---
  describe("GET", () => {
    it("returns empty streams in demo mode", async () => {
      mockIsDemoMode.mockReturnValue(true);

      const res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ streams: [] });
      expect(mockFindMany).not.toHaveBeenCalled();
    });

    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await GET();
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns recurring streams for the user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockResolvedValue([makeStream()] as never);

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.streams).toHaveLength(1);
      expect(body.streams[0].id).toBe("stream-1");
      expect(body.streams[0].merchantName).toBe("Netflix");
      expect(body.streams[0].lastAmount).toBe(15.99);
      expect(body.streams[0].accountName).toBe("Checking");
      expect(body.streams[0].firstDate).toBe("2024-01-01T00:00:00.000Z");
      expect(body.streams[0].predictedNextDate).toBe(
        "2024-07-01T00:00:00.000Z",
      );

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          account: { plaidItem: { userId: "user-1" } },
        },
        include: {
          account: { select: { name: true } },
        },
        orderBy: [{ isActive: "desc" }, { merchantName: "asc" }],
      });
    });

    it("returns null for missing predictedNextDate", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockResolvedValue([
        makeStream({ predictedNextDate: null }),
      ] as never);

      const res = await GET();
      const body = await res.json();
      expect(body.streams[0].predictedNextDate).toBeNull();
    });

    it("returns null for missing cancelledAt", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockResolvedValue([
        makeStream({ cancelledAt: null }),
      ] as never);

      const res = await GET();
      const body = await res.json();
      expect(body.streams[0].cancelledAt).toBeNull();
    });

    it("returns empty array when no streams", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockResolvedValue([] as never);

      const res = await GET();
      const body = await res.json();
      expect(body.streams).toEqual([]);
    });

    it("returns 500 when database throws", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockRejectedValue(new Error("DB error"));

      const res = await GET();
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: "Failed to fetch subscriptions",
      });
    });
  });

  // --- PATCH ---
  describe("PATCH", () => {
    it("returns success in demo mode", async () => {
      mockIsDemoMode.mockReturnValue(true);

      const res = await PATCH(makeRequest({ id: "stream-1" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });

    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await PATCH(
        makeRequest({ id: "stream-1", cancelledByUser: true }),
      );
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 400 when ID is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await PATCH(makeRequest({ cancelledByUser: true }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "ID is required" });
    });

    it("returns 404 when subscription does not exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue(null as never);

      const res = await PATCH(
        makeRequest({ id: "missing", cancelledByUser: true }),
      );
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Subscription not found" });
    });

    it("returns 404 when subscription belongs to another user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "stream-1",
        account: { plaidItem: { userId: "other-user" } },
      } as never);

      const res = await PATCH(
        makeRequest({ id: "stream-1", cancelledByUser: true }),
      );
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Subscription not found" });
    });

    it("returns 400 for invalid frequency", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "stream-1",
        account: { plaidItem: { userId: "user-1" } },
      } as never);

      const res = await PATCH(
        makeRequest({ id: "stream-1", frequency: "DAILY" }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid frequency" });
    });

    it("returns 400 when no fields to update", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "stream-1",
        account: { plaidItem: { userId: "user-1" } },
      } as never);

      const res = await PATCH(makeRequest({ id: "stream-1" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "No fields to update" });
    });

    it("successfully toggles cancelledByUser to true", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "stream-1",
        account: { plaidItem: { userId: "user-1" } },
      } as never);

      const cancelledAt = new Date("2024-06-15T00:00:00.000Z");
      mockUpdate.mockResolvedValue({
        id: "stream-1",
        merchantName: "Netflix",
        lastAmount: 15.99,
        frequency: "MONTHLY",
        cancelledByUser: true,
        cancelledAt,
      } as never);

      const res = await PATCH(
        makeRequest({ id: "stream-1", cancelledByUser: true }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.stream.cancelledByUser).toBe(true);
      expect(body.stream.cancelledAt).toBe(cancelledAt.toISOString());

      const call = mockUpdate.mock.calls[0][0];
      expect(call.data).toHaveProperty("cancelledByUser", true);
      expect(call.data).toHaveProperty("cancelledAt");
    });

    it("clears cancelledAt when toggling cancelledByUser to false", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "stream-1",
        account: { plaidItem: { userId: "user-1" } },
      } as never);
      mockUpdate.mockResolvedValue({
        id: "stream-1",
        merchantName: "Netflix",
        lastAmount: 15.99,
        frequency: "MONTHLY",
        cancelledByUser: false,
        cancelledAt: null,
      } as never);

      const res = await PATCH(
        makeRequest({ id: "stream-1", cancelledByUser: false }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.stream.cancelledByUser).toBe(false);
      expect(body.stream.cancelledAt).toBeNull();

      const call = mockUpdate.mock.calls[0][0];
      expect(call.data).toHaveProperty("cancelledByUser", false);
      expect(call.data).toHaveProperty("cancelledAt", null);
    });

    it("successfully updates merchantName", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "stream-1",
        account: { plaidItem: { userId: "user-1" } },
      } as never);
      mockUpdate.mockResolvedValue({
        id: "stream-1",
        merchantName: "Disney+",
        lastAmount: 15.99,
        frequency: "MONTHLY",
        cancelledByUser: false,
        cancelledAt: null,
      } as never);

      const res = await PATCH(
        makeRequest({ id: "stream-1", merchantName: "Disney+" }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.stream.merchantName).toBe("Disney+");
    });

    it("successfully updates lastAmount", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "stream-1",
        account: { plaidItem: { userId: "user-1" } },
      } as never);
      mockUpdate.mockResolvedValue({
        id: "stream-1",
        merchantName: "Netflix",
        lastAmount: 22.99,
        frequency: "MONTHLY",
        cancelledByUser: false,
        cancelledAt: null,
      } as never);

      const res = await PATCH(
        makeRequest({ id: "stream-1", lastAmount: "22.99" }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.stream.lastAmount).toBe(22.99);

      const call = mockUpdate.mock.calls[0][0];
      expect(call.data).toHaveProperty("lastAmount", 22.99);
    });

    it("successfully updates frequency with valid value", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "stream-1",
        account: { plaidItem: { userId: "user-1" } },
      } as never);
      mockUpdate.mockResolvedValue({
        id: "stream-1",
        merchantName: "Netflix",
        lastAmount: 15.99,
        frequency: "ANNUALLY",
        cancelledByUser: false,
        cancelledAt: null,
      } as never);

      const res = await PATCH(
        makeRequest({ id: "stream-1", frequency: "ANNUALLY" }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.stream.frequency).toBe("ANNUALLY");
    });

    it("returns 500 when database throws", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockRejectedValue(new Error("DB error"));

      const res = await PATCH(
        makeRequest({ id: "stream-1", cancelledByUser: true }),
      );
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: "Failed to update subscription",
      });
    });
  });

  // --- DELETE ---
  describe("DELETE", () => {
    it("returns success in demo mode", async () => {
      mockIsDemoMode.mockReturnValue(true);

      const res = await DELETE(makeRequest({ id: "stream-1" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });

    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await DELETE(makeRequest({ id: "stream-1" }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 400 when ID is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await DELETE(makeRequest({}));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "ID is required" });
    });

    it("returns 404 when subscription does not exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue(null as never);

      const res = await DELETE(makeRequest({ id: "missing" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Subscription not found" });
    });

    it("returns 404 when subscription belongs to another user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "stream-1",
        account: { plaidItem: { userId: "other-user" } },
      } as never);

      const res = await DELETE(makeRequest({ id: "stream-1" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Subscription not found" });
    });

    it("successfully deletes a subscription", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "stream-1",
        account: { plaidItem: { userId: "user-1" } },
      } as never);
      mockDelete.mockResolvedValue({} as never);

      const res = await DELETE(makeRequest({ id: "stream-1" }));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.message).toBe("Subscription deleted successfully");
      expect(body.id).toBe("stream-1");

      expect(mockDelete).toHaveBeenCalledWith({
        where: { id: "stream-1" },
      });
    });

    it("returns 500 when database throws", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockRejectedValue(new Error("DB error"));

      const res = await DELETE(makeRequest({ id: "stream-1" }));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: "Failed to delete subscription",
      });
    });
  });
});
