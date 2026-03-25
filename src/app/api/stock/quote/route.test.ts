import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/stock-provider", () => ({
  stockProvider: { getQuotes: vi.fn() },
}));

import { GET } from "./route";
import { auth } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { rateLimit } from "@/lib/rate-limit";
import { stockProvider } from "@/lib/stock-provider";

const mockAuth = vi.mocked(auth);
const mockIsDemoMode = vi.mocked(isDemoMode);
const mockRateLimit = vi.mocked(rateLimit);
const mockGetQuotes = vi.mocked(stockProvider.getQuotes);

function makeRequest(tickers?: string) {
  const url = tickers
    ? `http://localhost/api/stock/quote?tickers=${encodeURIComponent(tickers)}`
    : "http://localhost/api/stock/quote";
  return new Request(url);
}

describe("GET /api/stock/quote", () => {
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

  it("returns 400 when tickers param is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Query parameter 'tickers' is required",
    });
  });

  it("returns 400 when more than 20 tickers", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const tickers = Array.from({ length: 21 }, (_, i) => `T${i}`).join(",");
    const res = await GET(makeRequest(tickers));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Maximum 20 tickers per request",
    });
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockRateLimit.mockReturnValue({ success: false, remaining: 0, resetAt: 0 });
    const res = await GET(makeRequest("AAPL"));
    expect(res.status).toBe(429);
  });

  it("returns quotes for valid tickers", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    const mockQuotes = [
      {
        ticker: "AAPL",
        name: "Apple Inc.",
        price: 189.84,
        change: 1.2,
        changePercent: 0.63,
        previousClose: 188.64,
        open: 189.0,
        dayHigh: 190.5,
        dayLow: 188.2,
        volume: 45000000,
        currency: "USD",
      },
    ];
    mockGetQuotes.mockResolvedValue(mockQuotes);

    const res = await GET(makeRequest("AAPL,MSFT"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ quotes: mockQuotes });
    expect(mockGetQuotes).toHaveBeenCalledWith(["AAPL", "MSFT"]);
  });

  it("uppercases and trims tickers", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockGetQuotes.mockResolvedValue([]);

    await GET(makeRequest(" aapl , msft "));
    expect(mockGetQuotes).toHaveBeenCalledWith(["AAPL", "MSFT"]);
  });

  it("returns demo quotes in demo mode", async () => {
    mockIsDemoMode.mockReturnValue(true);
    const res = await GET(makeRequest("AAPL,MSFT"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quotes).toHaveLength(2);
    expect(body.quotes[0].ticker).toBe("AAPL");
    expect(body.quotes[1].ticker).toBe("MSFT");
    expect(mockGetQuotes).not.toHaveBeenCalled();
  });

  it("demo mode does not require auth", async () => {
    mockIsDemoMode.mockReturnValue(true);
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(makeRequest("AAPL"));
    expect(res.status).toBe(200);
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("returns 500 when provider throws", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockGetQuotes.mockRejectedValue(new Error("API down"));
    const res = await GET(makeRequest("AAPL"));
    expect(res.status).toBe(500);
  });
});
