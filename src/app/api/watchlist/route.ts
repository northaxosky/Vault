import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { rateLimit } from "@/lib/rate-limit";
import { stockProvider } from "@/lib/stock-provider";
import type { StockQuote } from "@/lib/stock-provider";
import { unauthorizedResponse, validationError, errorResponse, successResponse } from "@/lib/api-response";

const MAX_WATCHLIST_ITEMS = 50;

function makeDemoQuote(ticker: string, name: string): StockQuote {
  const prices: Record<string, number> = {
    AAPL: 189.84,
    MSFT: 378.91,
    GOOGL: 141.8,
    AMZN: 178.25,
    TSLA: 248.42,
  };
  const price = prices[ticker] ?? 150;
  const change = +(Math.random() * 6 - 3).toFixed(2);
  return {
    ticker,
    name,
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

const DEMO_ITEMS = [
  { id: "demo-1", ticker: "AAPL", name: "Apple Inc.", addedAt: new Date().toISOString() },
  { id: "demo-2", ticker: "MSFT", name: "Microsoft Corporation", addedAt: new Date().toISOString() },
  { id: "demo-3", ticker: "GOOGL", name: "Alphabet Inc.", addedAt: new Date().toISOString() },
  { id: "demo-4", ticker: "AMZN", name: "Amazon.com Inc.", addedAt: new Date().toISOString() },
  { id: "demo-5", ticker: "TSLA", name: "Tesla Inc.", addedAt: new Date().toISOString() },
];

// --- GET: Fetch watchlist with live quotes ---
export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({
      items: DEMO_ITEMS.map((item) => ({
        ...item,
        quote: makeDemoQuote(item.ticker, item.name),
      })),
    });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const items = await prisma.watchlistItem.findMany({
      where: { userId: session.user.id },
      orderBy: { addedAt: "desc" },
    });

    let quotes: StockQuote[] = [];
    if (items.length > 0) {
      try {
        quotes = await stockProvider.getQuotes(items.map((i) => i.ticker));
      } catch {
        // Quotes may fail — return items without quotes
      }
    }

    const quoteMap = new Map(quotes.map((q) => [q.ticker, q]));

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        ticker: item.ticker,
        name: item.name,
        addedAt: item.addedAt,
        quote: quoteMap.get(item.ticker) ?? null,
      })),
    });
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return errorResponse("Failed to fetch watchlist", 500);
  }
}

// --- POST: Add ticker to watchlist ---
export async function POST(request: Request) {
  if (isDemoMode()) {
    const body = await request.json();
    return NextResponse.json(
      {
        item: {
          id: "demo-new",
          ticker: body.ticker,
          name: body.name,
          addedAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { ticker, name } = body;

    if (!ticker || typeof ticker !== "string") {
      return validationError("Ticker is required");
    }

    if (!name || typeof name !== "string") {
      return validationError("Name is required");
    }

    const { success } = rateLimit(`watchlist:${session.user.id}`, {
      max: 30,
      windowMs: 60_000,
    });
    if (!success) {
      return errorResponse("Too many requests", 429);
    }

    const count = await prisma.watchlistItem.count({
      where: { userId: session.user.id },
    });
    if (count >= MAX_WATCHLIST_ITEMS) {
      return validationError(`Maximum ${MAX_WATCHLIST_ITEMS} watchlist items allowed`);
    }

    const item = await prisma.watchlistItem.create({
      data: {
        userId: session.user.id,
        ticker: ticker.toUpperCase().trim(),
        name: name.trim(),
      },
    });

    return NextResponse.json(
      {
        item: {
          id: item.id,
          ticker: item.ticker,
          name: item.name,
          addedAt: item.addedAt,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return errorResponse("Ticker already in watchlist", 409);
    }
    console.error("Error adding to watchlist:", error);
    return errorResponse("Failed to add to watchlist", 500);
  }
}

// --- DELETE: Remove ticker from watchlist ---
export async function DELETE(request: Request) {
  if (isDemoMode()) {
    return successResponse({ success: true });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { ticker } = body;

    if (!ticker || typeof ticker !== "string") {
      return validationError("Ticker is required");
    }

    await prisma.watchlistItem.deleteMany({
      where: {
        userId: session.user.id,
        ticker: ticker.toUpperCase().trim(),
      },
    });

    return successResponse({ success: true });
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    return errorResponse("Failed to remove from watchlist", 500);
  }
}
