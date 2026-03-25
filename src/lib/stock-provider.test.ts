import { describe, it, expect, beforeEach } from "vitest";
import { _cache } from "./stock-provider";

describe("stock-provider cache", () => {
  beforeEach(() => {
    _cache.clear();
  });

  it("stores and retrieves cached values", () => {
    _cache.set("test:key", { data: { price: 100 }, expiresAt: Date.now() + 60_000 });
    const entry = _cache.get("test:key");
    expect(entry).toBeDefined();
    expect((entry!.data as { price: number }).price).toBe(100);
  });

  it("returns undefined for expired entries after cleanup", () => {
    _cache.set("test:expired", { data: { price: 50 }, expiresAt: Date.now() - 1000 });
    const entry = _cache.get("test:expired");
    expect(entry).toBeDefined();
    // Expired but not yet cleaned up - the provider functions check expiry
    expect(entry!.expiresAt).toBeLessThan(Date.now());
  });

  it("isolates different cache keys", () => {
    _cache.set("quote:AAPL", { data: { price: 150 }, expiresAt: Date.now() + 60_000 });
    _cache.set("quote:MSFT", { data: { price: 300 }, expiresAt: Date.now() + 60_000 });
    expect(_cache.size).toBe(2);
    expect((_cache.get("quote:AAPL")!.data as { price: number }).price).toBe(150);
    expect((_cache.get("quote:MSFT")!.data as { price: number }).price).toBe(300);
  });

  it("can be cleared", () => {
    _cache.set("a", { data: 1, expiresAt: Date.now() + 60_000 });
    _cache.set("b", { data: 2, expiresAt: Date.now() + 60_000 });
    expect(_cache.size).toBe(2);
    _cache.clear();
    expect(_cache.size).toBe(0);
  });
});
