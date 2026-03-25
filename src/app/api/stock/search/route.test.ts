import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/stock-provider", () => ({
  stockProvider: { searchTickers: vi.fn() },
}));

import { GET } from "./route";
import { auth } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { rateLimit } from "@/lib/rate-limit";
import { stockProvider } from "@/lib/stock-provider";

const mockAuth = vi.mocked(auth);
const mockIsDemoMode = vi.mocked(isDemoMode);
const mockRateLimit = vi.mocked(rateLimit);
const mockSearchTickers = vi.mocked(stockProvider.searchTickers);

function makeRequest(query?: string) {
  const url = query
    ? `http://localhost/api/stock/search?q=${encodeURIComponent(query)}`
    : "http://localhost/api/stock/search";
  return new Request(url);
}

describe("GET /api/stock/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
    mockRateLimit.mockReturnValue({ success: true, remaining: 29, resetAt: 0 });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(makeRequest("AAPL"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} } as never);
    const res = await GET(makeRequest("AAPL"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when query is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Query parameter 'q' is required",
    });
  });

  it("returns 400 when query is empty", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const res = await GET(makeRequest("  "));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockRateLimit.mockReturnValue({ success: false, remaining: 0, resetAt: 0 });
    const res = await GET(makeRequest("AAPL"));
    expect(res.status).toBe(429);
  });

  it("returns search results for valid query", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const mockResults = [
      { ticker: "AAPL", name: "Apple Inc.", type: "Common Stock", exchange: "NASDAQ" },
    ];
    mockSearchTickers.mockResolvedValue(mockResults);

    const res = await GET(makeRequest("AAPL"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: mockResults });
    expect(mockSearchTickers).toHaveBeenCalledWith("AAPL");
  });

  it("returns demo results in demo mode", async () => {
    mockIsDemoMode.mockReturnValue(true);
    const res = await GET(makeRequest("AAPL"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toBeDefined();
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0].ticker).toBe("AAPL");
    // Should not call stockProvider in demo mode
    expect(mockSearchTickers).not.toHaveBeenCalled();
  });

  it("demo mode does not require auth", async () => {
    mockIsDemoMode.mockReturnValue(true);
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(makeRequest("MSFT"));
    expect(res.status).toBe(200);
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("returns 500 when provider throws", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockSearchTickers.mockRejectedValue(new Error("API failure"));
    const res = await GET(makeRequest("AAPL"));
    expect(res.status).toBe(500);
  });
});
