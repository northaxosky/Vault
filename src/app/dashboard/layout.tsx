import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardSidebar from "@/components/DashboardSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth check — all /dashboard/* routes require login
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Read the user's accent hue from their settings (if any).
  // This is applied as an inline style on the wrapper so the correct
  // theme color is rendered immediately — no flash of wrong color.
  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
    select: { accentHue: true },
  });

  const accentHue = settings?.accentHue ?? 195;

  // We set ALL accent-derived CSS variables directly on this wrapper element
  // as pre-computed values rather than relying on var(--accent-hue).
  //
  // Why? CSS custom properties resolve at the element where they're defined.
  // The .dark class on <html> defines --primary: oklch(0.75 0.15 var(--accent-hue)),
  // which resolves --accent-hue at the <html> level (always 195, the default).
  // Setting --accent-hue on a child div does NOT cause --primary to recompute.
  //
  // By setting the final computed values here, everything under this wrapper
  // inherits the correct accent color — both bg-mesh gradients AND semantic
  // tokens like --primary, --ring, etc.
  const accentStyle = {
    "--accent-hue": String(accentHue),
    "--primary": `oklch(0.75 0.15 ${accentHue})`,
    "--accent": `oklch(0.25 0.03 ${accentHue})`,
    "--ring": `oklch(0.75 0.15 ${accentHue})`,
    "--chart-1": `oklch(0.75 0.15 ${accentHue})`,
    "--chart-2": `oklch(0.7 0.15 ${accentHue + 105})`,
    "--chart-3": `oklch(0.72 0.15 ${accentHue - 30})`,
    "--chart-4": `oklch(0.65 0.15 ${accentHue + 60})`,
    "--chart-5": `oklch(0.7 0.15 ${accentHue + 145})`,
    "--sidebar-primary": `oklch(0.75 0.15 ${accentHue})`,
    "--sidebar-ring": `oklch(0.75 0.15 ${accentHue})`,
  } as React.CSSProperties;

  return (
    <TooltipProvider>
      <div
        className="bg-mesh flex min-h-screen flex-col bg-background lg:flex-row"
        data-accent-root
        style={accentStyle}
      >
        <DashboardSidebar
          userName={session.user.name ?? null}
          userEmail={session.user.email ?? ""}
        />

        {/* Main content area — flex-1 takes remaining width */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
