import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardSidebar from "@/components/DashboardSidebar";
import CommandPalette from "@/components/CommandPalette";
import { Toaster } from "sonner";
import VerificationBanner from "@/components/VerificationBanner";
import { isDemoMode } from "@/lib/demo";
import { DEMO_USER, DEMO_SETTINGS } from "@/lib/demo-data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = (await auth())!;

  // If user was deleted but session cookie persists, redirect to login
  if (!isDemoMode() && (!session?.user?.id || session.user.id === "")) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }

  let accentHue = 195;
  let emailVerified = true;

  if (isDemoMode()) {
    accentHue = DEMO_SETTINGS.accentHue;
    emailVerified = DEMO_USER.emailVerified;
  } else {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { accentHue: true },
    });
    accentHue = settings?.accentHue ?? 195;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true },
    });
    emailVerified = !!user?.emailVerified;
  }

  // Read theme to apply correct lightness for accent colors
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value ?? "dark";
  const isDark = theme === "dark";

  // We set ALL accent-derived CSS variables directly on this wrapper element
  // as pre-computed values rather than relying on var(--accent-hue).
  //
  // Why? CSS custom properties resolve at the element where they're defined.
  // The .dark class on <html> defines --primary: oklch(0.75 0.15 var(--accent-hue)),
  // which resolves --accent-hue at the <html> level (always 195, the default).
  // Setting --accent-hue on a child div does NOT cause --primary to recompute.
  //
  // Dark and light modes use different lightness values for the same accent hue.
  const accentStyle = (isDark
    ? {
        "--accent-hue": String(accentHue),
        "--primary": `oklch(0.75 0.15 ${accentHue})`,
        "--primary-foreground": `oklch(0.13 0.015 260)`,
        "--accent": `oklch(0.25 0.03 ${accentHue})`,
        "--ring": `oklch(0.75 0.15 ${accentHue})`,
        "--chart-1": `oklch(0.75 0.15 ${accentHue})`,
        "--chart-2": `oklch(0.7 0.15 ${accentHue + 105})`,
        "--chart-3": `oklch(0.72 0.15 ${accentHue - 30})`,
        "--chart-4": `oklch(0.65 0.15 ${accentHue + 60})`,
        "--chart-5": `oklch(0.7 0.15 ${accentHue + 145})`,
        "--sidebar-primary": `oklch(0.75 0.15 ${accentHue})`,
        "--sidebar-ring": `oklch(0.75 0.15 ${accentHue})`,
      }
    : {
        "--accent-hue": String(accentHue),
        "--primary": `oklch(0.5 0.15 ${accentHue})`,
        "--primary-foreground": `oklch(0.98 0 0)`,
        "--accent": `oklch(0.94 0.01 ${accentHue})`,
        "--ring": `oklch(0.5 0.15 ${accentHue})`,
        "--chart-1": `oklch(0.5 0.15 ${accentHue})`,
        "--chart-2": `oklch(0.48 0.15 ${accentHue + 105})`,
        "--chart-3": `oklch(0.5 0.15 ${accentHue - 30})`,
        "--chart-4": `oklch(0.45 0.15 ${accentHue + 60})`,
        "--chart-5": `oklch(0.48 0.15 ${accentHue + 145})`,
        "--sidebar-primary": `oklch(0.5 0.15 ${accentHue})`,
        "--sidebar-ring": `oklch(0.5 0.15 ${accentHue})`,
      }) as React.CSSProperties;

  return (
    <TooltipProvider>
      <div
        className="bg-mesh flex h-screen flex-col overflow-hidden bg-background lg:flex-row"
        data-accent-root
        style={accentStyle}
      >
        <DashboardSidebar
          userName={session.user.name ?? null}
          userEmail={session.user.email ?? ""}
        />

        {/* Main content area — flex-1 takes remaining width */}
        <main className="flex-1 overflow-auto">
          <VerificationBanner emailVerified={emailVerified} />
          {children}
        </main>
      </div>
      <CommandPalette />
      <Toaster position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}
