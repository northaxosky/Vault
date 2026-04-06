import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { rateLimit } from "@/lib/rate-limit";
import { stockProvider } from "@/lib/stock-provider";
import type { StockQuote } from "@/lib/stock-provider";
import { unauthorizedResponse, validationError, errorResponse } from "@/lib/api-response";

const MAX_TICKERS = 20;

function makeDemoQuote(ticker: string): StockQuote {
  const prices: Record<string, number> = {
    AAPL: 189.84,
    MSFT: 378.91,
    GOOGL: 141.8,
    AMZN: 178.25,
    TSLA: 248.42,
  };
  const price = prices[ticker] ?? 100 + Math.random() * 200;
  const change = +(Math.random() * 6 - 3).toFixed(2);
  return {
    ticker,
    name: ticker,
    price,
    change,
    changePercent: +((change / price) * 100).toFixed(2),
    previousClose: +(price - change).toFixed(2),
    open: +(price - change / 2).toFixed(2),
    dayHigh: +(price + Math.abs(change)).toFixed(2),
    dayLow: +(price - Math.abs(change)).toFixed(2),
    volume: Math.floor(Math.random() * 50_000_000),
    currency: "USD",
  };
}

export async function GET(request: Request) {
  if (isDemoMode()) {
    const url = new URL(request.url);
    const raw = (url.searchParams.get("tickers") ?? "").trim();
    const tickers = raw
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, MAX_TICKERS);
    return NextResponse.json({ quotes: tickers.map(makeDemoQuote) });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const url = new URL(request.url);
    const raw = (url.searchParams.get("tickers") ?? "").trim();

    if (!raw) {
      return validationError("Query parameter 'tickers' is required");
    }

    const tickers = raw
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    if (tickers.length > MAX_TICKERS) {
      return validationError(`Maximum ${MAX_TICKERS} tickers per request`);
    }

    const { success } = rateLimit(`stock-quote:${session.user.id}`, {
      max: 30,
      windowMs: 60_000,
    });
    if (!success) {
      return errorResponse("Too many requests", 429);
    }

    const quotes = await stockProvider.getQuotes(tickers);
    return NextResponse.json({ quotes });
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return errorResponse("Failed to fetch quotes", 500);
  }
}
