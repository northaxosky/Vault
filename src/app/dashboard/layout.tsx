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

  return (
    <TooltipProvider>
      <div
        className="bg-mesh flex min-h-screen bg-background"
        style={{ "--accent-hue": String(accentHue) } as React.CSSProperties}
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
