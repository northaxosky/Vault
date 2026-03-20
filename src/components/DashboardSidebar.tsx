"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Navigation items — each becomes a link in the sidebar
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/accounts", label: "Accounts", icon: Landmark },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/dashboard/investments", label: "Investments", icon: TrendingUp },
];

interface DashboardSidebarProps {
  userName: string | null;
  userEmail: string;
}

// Get initials from a name ("Kuzey Gok" → "KG")
function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

function SidebarContent({
  userName,
  userEmail,
  pathname,
  onNavigate,
}: {
  userName: string | null;
  userEmail: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="px-4 py-5">
        <h1 className="text-xl font-bold text-primary">Vault</h1>
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section: Settings + User */}
      <div className="border-t border-border px-3 py-3">
        {/* Settings link */}
        <Link
          href="/dashboard/settings"
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname.startsWith("/dashboard/settings")
              ? "bg-accent text-accent-foreground border-l-2 border-primary"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          }`}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>

        {/* User info + sign out */}
        <div className="mt-3 flex items-center gap-3 px-3">
          <Link
            href="/dashboard/settings"
            onClick={onNavigate}
            className="flex flex-1 items-center gap-3 min-w-0 rounded-lg py-1 -ml-1 px-1 transition-colors hover:bg-accent/50"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/20 text-primary text-xs">
                {getInitials(userName, userEmail)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {userName || userEmail}
              </p>
            </div>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardSidebar({
  userName,
  userEmail,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar — always visible on large screens */}
      <aside className="glass-subtle hidden w-64 shrink-0 border-r border-border lg:block">
        <SidebarContent
          userName={userName}
          userEmail={userEmail}
          pathname={pathname}
        />
      </aside>

      {/* Mobile: hamburger button in a sticky top bar */}
      <div className="glass-subtle sticky top-0 z-40 flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger className="text-muted-foreground hover:text-foreground">
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-background p-0">
            <SidebarContent
              userName={userName}
              userEmail={userEmail}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-bold text-primary">Vault</h1>
      </div>
    </>
  );
}
