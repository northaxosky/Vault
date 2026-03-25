import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    watchlistItem: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));
vi.mock("@/lib/stock-provider", () => ({
  stockProvider: { getQuotes: vi.fn() },
}));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));

import { GET, POST, DELETE } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stockProvider } from "@/lib/stock-provider";
import { isDemoMode } from "@/lib/demo";
import { rateLimit } from "@/lib/rate-limit";

const mockAuth = vi.mocked(auth);
const mockIsDemoMode = vi.mocked(isDemoMode);
const mockRateLimit = vi.mocked(rateLimit);
const mockFindMany = vi.mocked(prisma.watchlistItem.findMany);
const mockCreate = vi.mocked(prisma.watchlistItem.create);
const mockDeleteMany = vi.mocked(prisma.watchlistItem.deleteMany);
const mockCount = vi.mocked(prisma.watchlistItem.count);
const mockGetQuotes = vi.mocked(stockProvider.getQuotes);

function jsonRequest(body: unknown, method = "POST") {
  return new Request("http://localhost/api/watchlist", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
    mockRateLimit.mockReturnValue({ success: true, remaining: 29, resetAt: 0 });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns watchlist items with quotes", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const items = [
      { id: "w1", userId: "u1", ticker: "AAPL", name: "Apple Inc.", addedAt: new Date("2024-01-01") },
      { id: "w2", userId: "u1", ticker: "MSFT", name: "Microsoft Corporation", addedAt: new Date("2024-01-02") },
    ];
    mockFindMany.mockResolvedValue(items as never);
    const quotes = [
      { ticker: "AAPL", name: "Apple Inc.", price: 189, change: 1, changePercent: 0.5, previousClose: 188, open: 188.5, dayHigh: 190, dayLow: 188, volume: 1000000, currency: "USD" },
      { ticker: "MSFT", name: "Microsoft", price: 378, change: 2, changePercent: 0.5, previousClose: 376, open: 377, dayHigh: 380, dayLow: 376, volume: 2000000, currency: "USD" },
    ];
    mockGetQuotes.mockResolvedValue(quotes);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].ticker).toBe("AAPL");
    expect(body.items[0].quote).toBeDefined();
    expect(body.items[0].quote.price).toBe(189);
    expect(body.items[1].ticker).toBe("MSFT");
  });

  it("returns items with null quotes when provider fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const items = [
      { id: "w1", userId: "u1", ticker: "AAPL", name: "Apple Inc.", addedAt: new Date("2024-01-01") },
    ];
    mockFindMany.mockResolvedValue(items as never);
    mockGetQuotes.mockRejectedValue(new Error("API down"));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quote).toBeNull();
  });

  it("returns empty array when no items", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockFindMany.mockResolvedValue([] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(mockGetQuotes).not.toHaveBeenCalled();
  });

  it("returns demo items in demo mode", async () => {
    mockIsDemoMode.mockReturnValue(true);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(5);
    expect(body.items[0]).toHaveProperty("ticker");
    expect(body.items[0]).toHaveProperty("quote");
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
    mockRateLimit.mockReturnValue({ success: true, remaining: 29, resetAt: 0 });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(jsonRequest({ ticker: "AAPL", name: "Apple" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when ticker is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const res = await POST(jsonRequest({ name: "Apple" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Ticker is required" });
  });

  it("returns 400 when name is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const res = await POST(jsonRequest({ ticker: "AAPL" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Name is required" });
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockRateLimit.mockReturnValue({ success: false, remaining: 0, resetAt: 0 });
    const res = await POST(jsonRequest({ ticker: "AAPL", name: "Apple" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 when max items reached", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockCount.mockResolvedValue(50 as never);
    const res = await POST(jsonRequest({ ticker: "AAPL", name: "Apple" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Maximum");
  });

  it("creates item and returns 201", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockCount.mockResolvedValue(5 as never);
    const created = {
      id: "new-id",
      userId: "u1",
      ticker: "AAPL",
      name: "Apple Inc.",
      addedAt: new Date("2024-06-01"),
    };
    mockCreate.mockResolvedValue(created as never);

    const res = await POST(jsonRequest({ ticker: "aapl", name: "Apple Inc." }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.id).toBe("new-id");
    expect(body.item.ticker).toBe("AAPL");
    expect(mockCreate).toHaveBeenCalledWith({
      data: { userId: "u1", ticker: "AAPL", name: "Apple Inc." },
    });
  });

  it("returns 409 on duplicate ticker", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockCount.mockResolvedValue(5 as never);
    mockCreate.mockRejectedValue(new Error("Unique constraint failed on the fields: (`userId`,`ticker`)"));

    const res = await POST(jsonRequest({ ticker: "AAPL", name: "Apple" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Ticker already in watchlist" });
  });

  it("returns demo response in demo mode", async () => {
    mockIsDemoMode.mockReturnValue(true);
    const res = await POST(jsonRequest({ ticker: "AAPL", name: "Apple" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.ticker).toBe("AAPL");
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
    mockRateLimit.mockReturnValue({ success: true, remaining: 29, resetAt: 0 });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await DELETE(jsonRequest({ ticker: "AAPL" }, "DELETE"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when ticker is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const res = await DELETE(jsonRequest({}, "DELETE"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Ticker is required" });
  });

  it("deletes item and returns success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockDeleteMany.mockResolvedValue({ count: 1 } as never);

    const res = await DELETE(jsonRequest({ ticker: "aapl" }, "DELETE"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", ticker: "AAPL" },
    });
  });

  it("returns success even when no item found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockDeleteMany.mockResolvedValue({ count: 0 } as never);

    const res = await DELETE(jsonRequest({ ticker: "XYZ" }, "DELETE"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("returns demo response in demo mode", async () => {
    mockIsDemoMode.mockReturnValue(true);
    const res = await DELETE(jsonRequest({ ticker: "AAPL" }, "DELETE"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });
});
