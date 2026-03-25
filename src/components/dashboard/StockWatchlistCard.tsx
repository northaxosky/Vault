"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Quote {
  price: number;
  change: number;
  changePercent: number;
}

interface WatchlistItem {
  ticker: string;
  name: string;
  addedAt: string;
  quote: Quote | null;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatChange(change: number, changePercent: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
}

export default function StockWatchlistCard() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load watchlist");
        return res.json();
      })
      .then((data) => setItems(data.items ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-3 w-16 bg-muted rounded" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
              <div className="h-3 bg-muted rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Watchlist
        </h3>
        <p className="text-sm text-muted-foreground">
          Unable to load watchlist
        </p>
      </div>
    );
  }

  const displayed = items.slice(0, 5);

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Watchlist
        </h3>
        <Link
          href="/dashboard/watchlist"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View All →
        </Link>
      </div>

      {displayed.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No stocks in watchlist.{" "}
          <Link
            href="/dashboard/watchlist"
            className="underline hover:text-foreground transition-colors"
          >
            Add some
          </Link>
        </p>
      ) : (
        <div className="space-y-2">
          {displayed.map((item) => (
            <div
              key={item.ticker}
              className="flex items-center gap-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-foreground">
                  {item.ticker}
                </span>
                <span className="ml-2 text-xs text-muted-foreground truncate">
                  {item.name}
                </span>
              </div>
              {item.quote ? (
                <div className="flex items-center gap-3 shrink-0 tabular-nums text-right">
                  <span className="font-medium text-foreground">
                    {formatPrice(item.quote.price)}
                  </span>
                  <span
                    className={
                      item.quote.change >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }
                  >
                    {formatChange(item.quote.change, item.quote.changePercent)}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">
                  No quote
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
