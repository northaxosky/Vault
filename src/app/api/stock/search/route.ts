import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { rateLimit } from "@/lib/rate-limit";
import { stockProvider } from "@/lib/stock-provider";

const DEMO_RESULTS = [
  { ticker: "AAPL", name: "Apple Inc.", type: "Common Stock", exchange: "NASDAQ" },
  { ticker: "AMZN", name: "Amazon.com Inc.", type: "Common Stock", exchange: "NASDAQ" },
  { ticker: "GOOGL", name: "Alphabet Inc.", type: "Common Stock", exchange: "NASDAQ" },
  { ticker: "MSFT", name: "Microsoft Corporation", type: "Common Stock", exchange: "NASDAQ" },
  { ticker: "TSLA", name: "Tesla Inc.", type: "Common Stock", exchange: "NASDAQ" },
];

export async function GET(request: Request) {
  if (isDemoMode()) {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toUpperCase();
    const filtered = q
      ? DEMO_RESULTS.filter(
          (r) => r.ticker.includes(q) || r.name.toUpperCase().includes(q)
        )
      : DEMO_RESULTS;
    return NextResponse.json({ results: filtered });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim();

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const { success } = rateLimit(`stock-search:${session.user.id}`, {
      max: 30,
      windowMs: 60_000,
    });
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    const results = await stockProvider.searchTickers(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error searching tickers:", error);
    return NextResponse.json(
      { error: "Failed to search tickers" },
      { status: 500 }
    );
  }
}
