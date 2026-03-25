const store = new Map<string, { count: number; resetAt: number }>();

// Periodically clean up expired entries
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000);
cleanup.unref();

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // Window expired or first request — start fresh
  if (!entry || now >= entry.resetAt) {
    const resetAt = now + options.windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, remaining: options.max - 1, resetAt };
  }

  // Within window — check limit
  if (entry.count < options.max) {
    entry.count++;
    return {
      success: true,
      remaining: options.max - entry.count,
      resetAt: entry.resetAt,
    };
  }

  // Over limit
  return { success: false, remaining: 0, resetAt: entry.resetAt };
}

/** Visible for testing only. */
export function _resetStore(): void {
  store.clear();
}
