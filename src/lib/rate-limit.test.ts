import { describe, it, expect, beforeEach, vi } from "vitest";
import { rateLimit, _resetStore } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    _resetStore();
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const opts = { max: 3, windowMs: 60_000 };

    const r1 = rateLimit("user:1", opts);
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = rateLimit("user:1", opts);
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = rateLimit("user:1", opts);
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    const opts = { max: 2, windowMs: 60_000 };

    rateLimit("user:2", opts);
    rateLimit("user:2", opts);

    const blocked = rateLimit("user:2", opts);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window expires", () => {
    vi.useFakeTimers();
    const opts = { max: 1, windowMs: 1_000 };

    const r1 = rateLimit("user:3", opts);
    expect(r1.success).toBe(true);

    const r2 = rateLimit("user:3", opts);
    expect(r2.success).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(1_001);

    const r3 = rateLimit("user:3", opts);
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("isolates different keys", () => {
    const opts = { max: 1, windowMs: 60_000 };

    const a = rateLimit("key:a", opts);
    expect(a.success).toBe(true);

    const b = rateLimit("key:b", opts);
    expect(b.success).toBe(true);

    // key:a is exhausted, key:b should still be independent
    const a2 = rateLimit("key:a", opts);
    expect(a2.success).toBe(false);
  });

  it("returns correct resetAt timestamp", () => {
    vi.useFakeTimers();
    const now = Date.now();
    const opts = { max: 5, windowMs: 60_000 };

    const result = rateLimit("user:ts", opts);
    expect(result.resetAt).toBe(now + 60_000);
  });
});
