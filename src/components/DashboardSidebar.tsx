"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/navigation";
import AlertBell from "@/components/AlertBell";

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
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5 px-4 py-5 transition-colors hover:opacity-80">
        <Image
          src="/VaultIcon.png"
          alt=""
          width={24}
          height={24}
          className="dark:invert opacity-90"
        />
        <h1 className="text-xl font-bold text-primary">Vault</h1>
      </Link>

      {/* Main nav */}
      <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
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
              aria-current={isActive ? "page" : undefined}
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

      {/* Bottom section: Settings + Alerts + User */}
      <div className="border-t border-border px-3 py-3">
        {/* Settings + Alerts row */}
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard/settings"
            onClick={onNavigate}
            className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname.startsWith("/dashboard/settings")
                ? "bg-accent text-accent-foreground border-l-2 border-primary"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <AlertBell />
        </div>

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
          <Dialog>
            <DialogTrigger
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sign out</DialogTitle>
                <DialogDescription>
                  Are you sure you want to sign out of Vault?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  Sign out
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
          <SheetTrigger
            className="text-muted-foreground hover:text-foreground"
            aria-label="Open navigation menu"
          >
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
        <Link href="/dashboard" className="flex flex-1 items-center gap-2">
          <Image src="/VaultIcon.png" alt="" width={20} height={20} className="dark:invert opacity-90" />
          <h1 className="text-lg font-bold text-primary">Vault</h1>
        </Link>
        <AlertBell />
      </div>
    </>
  );
}
