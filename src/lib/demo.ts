// RISK: Demo mode bypasses authentication entirely. If enabled in production,
// any visitor can access the app without logging in. This exists for the
// public Vercel preview deployment — never enable it on a real instance.
let hasWarnedProduction = false;

export function isDemoMode(): boolean {
  const enabled = process.env.DEMO_MODE === "true";

  if (
    enabled &&
    process.env.NODE_ENV === "production" &&
    !hasWarnedProduction
  ) {
    hasWarnedProduction = true;
    console.warn(
      "[SECURITY WARNING] DEMO_MODE is enabled in production! This bypasses authentication.",
    );
  }

  return enabled;
}
