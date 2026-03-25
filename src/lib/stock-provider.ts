export interface StockQuote {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketCap?: number;
  currency: string;
}

export interface TickerSearchResult {
  ticker: string;
  name: string;
  type: string;
  exchange: string;
}

interface StockProvider {
  searchTickers(query: string): Promise<TickerSearchResult[]>;
  getQuote(ticker: string): Promise<StockQuote | null>;
  getQuotes(tickers: string[]): Promise<StockQuote[]>;
}

// In-memory cache with TTL
const cache = new Map<string, { data: unknown; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// Cleanup expired entries every 60s
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) cache.delete(key);
  }
}, 60_000);
cleanup.unref();

// --- Yahoo Finance Provider ---

async function yahooSearch(query: string): Promise<TickerSearchResult[]> {
  const { default: yahooFinance } = await import("yahoo-finance2");
  const results = await yahooFinance.search(query, { newsCount: 0 });
  const quotes = (results as unknown as { quotes: Record<string, string>[] }).quotes || [];
  return quotes
    .filter((q) => q.symbol)
    .slice(0, 10)
    .map((q) => ({
      ticker: q.symbol || "",
      name: q.longname || q.shortname || q.symbol || "Unknown",
      type: q.typeDisp || "Equity",
      exchange: q.exchange || "",
    }));
}

async function yahooQuote(ticker: string): Promise<StockQuote | null> {
  try {
    const { default: yahooFinance } = await import("yahoo-finance2");
    const raw = await yahooFinance.quote(ticker);
    const q = raw as unknown as Record<string, unknown>;
    const price = q.regularMarketPrice as number | undefined;
    if (!q || !price) return null;
    return {
      ticker: (q.symbol as string) || ticker,
      name: (q.longName as string) ?? (q.shortName as string) ?? ticker,
      price,
      change: (q.regularMarketChange as number) ?? 0,
      changePercent: (q.regularMarketChangePercent as number) ?? 0,
      previousClose: (q.regularMarketPreviousClose as number) ?? 0,
      open: (q.regularMarketOpen as number) ?? 0,
      dayHigh: (q.regularMarketDayHigh as number) ?? 0,
      dayLow: (q.regularMarketDayLow as number) ?? 0,
      volume: (q.regularMarketVolume as number) ?? 0,
      marketCap: (q.marketCap as number) ?? undefined,
      currency: (q.currency as string) ?? "USD",
    };
  } catch {
    console.error(`[StockProvider] Yahoo quote failed for ${ticker}`);
    return null;
  }
}

async function yahooQuotes(tickers: string[]): Promise<StockQuote[]> {
  const results = await Promise.all(tickers.map(yahooQuote));
  return results.filter((q): q is StockQuote => q !== null);
}

// --- Finnhub Provider ---

async function finnhubFetch<T>(path: string): Promise<T> {
  const key = process.env.FINNHUB_API_KEY;
  const res = await fetch(`https://finnhub.io/api/v1${path}&token=${key}`);
  if (!res.ok) throw new Error(`Finnhub API error: ${res.status}`);
  return res.json() as Promise<T>;
}

async function finnhubSearch(query: string): Promise<TickerSearchResult[]> {
  const data = await finnhubFetch<{
    result: { symbol: string; description: string; type: string; displaySymbol: string }[];
  }>(`/search?q=${encodeURIComponent(query)}`);
  return (data.result || []).slice(0, 10).map((r) => ({
    ticker: r.symbol,
    name: r.description,
    type: r.type || "Equity",
    exchange: "",
  }));
}

async function finnhubQuote(ticker: string): Promise<StockQuote | null> {
  try {
    const [quote, profile] = await Promise.all([
      finnhubFetch<{ c: number; d: number; dp: number; pc: number; o: number; h: number; l: number }>(
        `/quote?symbol=${encodeURIComponent(ticker)}`
      ),
      finnhubFetch<{ name?: string; marketCapitalization?: number; currency?: string }>(
        `/stock/profile2?symbol=${encodeURIComponent(ticker)}`
      ).catch(() => ({} as { name?: string; marketCapitalization?: number; currency?: string })),
    ]);
    if (!quote || quote.c === 0) return null;
    return {
      ticker,
      name: profile.name ?? ticker,
      price: quote.c,
      change: quote.d ?? 0,
      changePercent: quote.dp ?? 0,
      previousClose: quote.pc ?? 0,
      open: quote.o ?? 0,
      dayHigh: quote.h ?? 0,
      dayLow: quote.l ?? 0,
      volume: 0,
      marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1_000_000 : undefined,
      currency: profile.currency ?? "USD",
    };
  } catch {
    console.error(`[StockProvider] Finnhub quote failed for ${ticker}`);
    return null;
  }
}

async function finnhubQuotes(tickers: string[]): Promise<StockQuote[]> {
  const results = await Promise.all(tickers.map(finnhubQuote));
  return results.filter((q): q is StockQuote => q !== null);
}

// --- Provider Selection ---

function useFinnhub(): boolean {
  return !!process.env.FINNHUB_API_KEY;
}

// --- Cached Public API ---

const QUOTE_TTL = 30_000;  // 30 seconds
const SEARCH_TTL = 300_000; // 5 minutes

const provider: StockProvider = {
  async searchTickers(query: string): Promise<TickerSearchResult[]> {
    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = getCached<TickerSearchResult[]>(cacheKey);
    if (cached) return cached;

    const results = useFinnhub() ? await finnhubSearch(query) : await yahooSearch(query);
    setCache(cacheKey, results, SEARCH_TTL);
    return results;
  },

  async getQuote(ticker: string): Promise<StockQuote | null> {
    const cacheKey = `quote:${ticker.toUpperCase()}`;
    const cached = getCached<StockQuote>(cacheKey);
    if (cached) return cached;

    const quote = useFinnhub() ? await finnhubQuote(ticker) : await yahooQuote(ticker);
    if (quote) setCache(cacheKey, quote, QUOTE_TTL);
    return quote;
  },

  async getQuotes(tickers: string[]): Promise<StockQuote[]> {
    const uncached: string[] = [];
    const results: StockQuote[] = [];

    for (const ticker of tickers) {
      const cached = getCached<StockQuote>(`quote:${ticker.toUpperCase()}`);
      if (cached) {
        results.push(cached);
      } else {
        uncached.push(ticker);
      }
    }

    if (uncached.length > 0) {
      const fresh = useFinnhub() ? await finnhubQuotes(uncached) : await yahooQuotes(uncached);
      for (const quote of fresh) {
        setCache(`quote:${quote.ticker.toUpperCase()}`, quote, QUOTE_TTL);
        results.push(quote);
      }
    }

    return results;
  },
};

export const stockProvider = provider;

// Export for testing
export { cache as _cache };
