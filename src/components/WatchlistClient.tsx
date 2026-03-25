"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Plus,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// --- Types ---

interface Quote {
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  currency: string;
}

interface WatchlistItem {
  ticker: string;
  name: string;
  addedAt: string;
  quote: Quote | null;
}

interface SearchResult {
  ticker: string;
  name: string;
  type: string;
  exchange: string;
}

type SortKey = "ticker" | "price" | "changePercent" | "volume";
type SortDir = "asc" | "desc";

// --- Helpers ---

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(1)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`;
  return volume.toLocaleString();
}

function sortItems(
  items: WatchlistItem[],
  key: SortKey,
  dir: SortDir,
): WatchlistItem[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "ticker":
        cmp = a.ticker.localeCompare(b.ticker);
        break;
      case "price":
        cmp = (a.quote?.price ?? 0) - (b.quote?.price ?? 0);
        break;
      case "changePercent":
        cmp = (a.quote?.changePercent ?? 0) - (b.quote?.changePercent ?? 0);
        break;
      case "volume":
        cmp = (a.quote?.volume ?? 0) - (b.quote?.volume ?? 0);
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// --- Component ---

export default function WatchlistClient() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // --- Data fetching ---

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) throw new Error("Failed to load watchlist");
      const data = await res.json();
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  // Auto-refresh every 30s when page is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchWatchlist();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchWatchlist]);

  // --- Search ---

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchOpen(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/stock/search?q=${encodeURIComponent(query.trim())}`,
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setResults(data.results ?? []);
        setSearchOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // --- Actions ---

  async function addToWatchlist(result: SearchResult) {
    setAdding(result.ticker);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: result.ticker, name: result.name }),
      });
      if (res.status === 409) {
        // Already in watchlist — just close search
        setQuery("");
        setSearchOpen(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to add");
      setQuery("");
      setSearchOpen(false);
      await fetchWatchlist();
    } catch {
      // Silently fail — user can retry
    } finally {
      setAdding(null);
    }
  }

  async function removeFromWatchlist(ticker: string) {
    // Optimistic removal
    setItems((prev) => prev.filter((i) => i.ticker !== ticker));
    try {
      const res = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (!res.ok) {
        // Revert on failure
        await fetchWatchlist();
      }
    } catch {
      await fetchWatchlist();
    }
  }

  // --- Sort handler ---

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column)
      return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  }

  const sorted = sortItems(items, sortKey, sortDir);

  // --- Render ---

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Stock Watchlist
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${items.length} stock${items.length !== 1 ? "s" : ""} tracked`}
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mt-6" ref={searchRef}>
        <div className="glass flex items-center gap-3 rounded-xl px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tickers or company names…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {searching && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Search dropdown */}
        {searchOpen && results.length > 0 && (
          <div className="glass absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-auto rounded-xl border border-border p-2">
            {results.map((r) => {
              const alreadyAdded = items.some((i) => i.ticker === r.ticker);
              return (
                <button
                  key={r.ticker}
                  onClick={() => !alreadyAdded && addToWatchlist(r)}
                  disabled={alreadyAdded || adding === r.ticker}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50 disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">
                        {r.ticker}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {r.type}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.name} · {r.exchange}
                    </p>
                  </div>
                  {alreadyAdded ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Added
                    </span>
                  ) : adding === r.ticker ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {searchOpen && query.trim() && results.length === 0 && !searching && (
          <div className="glass absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">
            No results found for &ldquo;{query.trim()}&rdquo;
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="mt-6 glass rounded-xl p-6 animate-pulse">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="flex-1 h-4 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="mt-6 glass rounded-xl p-8 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchWatchlist();
            }}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div className="mt-8 glass rounded-xl p-12 text-center">
          <Eye className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            Your watchlist is empty
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Search for stocks above to start building your watchlist.
          </p>
        </div>
      )}

      {/* Watchlist table — desktop */}
      {!loading && !error && sorted.length > 0 && (
        <>
          <div className="mt-6 hidden md:block">
            <div className="glass rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3">
                      <button
                        onClick={() => handleSort("ticker")}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Ticker
                        <SortIcon column="ticker" />
                      </button>
                    </th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort("price")}
                        className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Price
                        <SortIcon column="price" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort("changePercent")}
                        className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Change
                        <SortIcon column="changePercent" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">Day Range</th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort("volume")}
                        className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Volume
                        <SortIcon column="volume" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.map((item) => {
                    const q = item.quote;
                    const isPositive = q ? q.change >= 0 : true;

                    return (
                      <tr
                        key={item.ticker}
                        className="transition-colors hover:bg-accent/30"
                      >
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {item.ticker}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">
                          {q ? formatPrice(q.price) : "—"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums ${
                            q
                              ? isPositive
                                ? "text-emerald-400"
                                : "text-red-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {q ? (
                            <>
                              {isPositive ? "+" : ""}
                              {q.change.toFixed(2)}{" "}
                              <span className="text-xs">
                                ({isPositive ? "+" : ""}
                                {q.changePercent.toFixed(2)}%)
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                          {q
                            ? `${formatPrice(q.dayLow)} — ${formatPrice(q.dayHigh)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {q ? formatVolume(q.volume) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => removeFromWatchlist(item.ticker)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-400/10 hover:text-red-400"
                            title={`Remove ${item.ticker}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Watchlist cards — mobile */}
          <div className="mt-6 space-y-3 md:hidden">
            {sorted.map((item) => {
              const q = item.quote;
              const isPositive = q ? q.change >= 0 : true;

              return (
                <div
                  key={item.ticker}
                  className="glass rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {item.ticker}
                        </span>
                        {q && (
                          <span className="text-lg font-semibold text-foreground tabular-nums">
                            {formatPrice(q.price)}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.name}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromWatchlist(item.ticker)}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-400/10 hover:text-red-400"
                      title={`Remove ${item.ticker}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {q && (
                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Change</p>
                        <p
                          className={`mt-0.5 font-medium tabular-nums ${
                            isPositive ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {q.change.toFixed(2)} ({isPositive ? "+" : ""}
                          {q.changePercent.toFixed(2)}%)
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Day Range</p>
                        <p className="mt-0.5 tabular-nums text-foreground">
                          {formatPrice(q.dayLow)} — {formatPrice(q.dayHigh)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Volume</p>
                        <p className="mt-0.5 tabular-nums text-foreground">
                          {formatVolume(q.volume)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
