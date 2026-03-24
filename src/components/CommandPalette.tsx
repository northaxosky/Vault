"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandSeparator,
} from "@/components/ui/command";
import {
  RefreshCw,
  Sun,
  Moon,
  LogOut,
  ArrowLeftRight,
  Landmark,
} from "lucide-react";
import { navItems, settingsNavItem } from "@/lib/navigation";
import { getCurrentTheme, setTheme } from "@/lib/theme";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency } from "@/lib/categories";

// --- Types ---

interface TransactionResult {
  id: string;
  name: string;
  merchantName: string | null;
  amount: number;
  date: string;
  category: string | null;
  currency: string;
  accountName: string;
}

interface AccountResult {
  id: string;
  name: string;
  officialName: string | null;
  type: string;
  currentBalance: number | null;
  currency: string;
}

// --- Component ---

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [transactions, setTransactions] = useState<TransactionResult[]>([]);
  const [accounts, setAccounts] = useState<AccountResult[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();

  const debouncedQuery = useDebounce(query, 300);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Server search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      return;
    }

    let cancelled = false;

    (async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
        const data = await res.json();
        if (!cancelled) {
          setTransactions(data.transactions ?? []);
          setAccounts(data.accounts ?? []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Reset state when dialog closes
  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setQuery("");
      setTransactions([]);
      setAccounts([]);
    }
  }, []);

  // Action handlers
  const navigateTo = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const handleSync = useCallback(async () => {
    setOpen(false);
    await fetch("/api/plaid/sync", { method: "POST" });
    router.refresh();
  }, [router]);

  const handleToggleTheme = useCallback(() => {
    const current = getCurrentTheme();
    setTheme(current === "dark" ? "light" : "dark");
    setOpen(false);
  }, []);

  const handleSignOut = useCallback(() => {
    setOpen(false);
    signOut({ callbackUrl: "/login" });
  }, []);

  const isDark =
    typeof document !== "undefined" ? getCurrentTheme() === "dark" : true;

  const displayTransactions = debouncedQuery.length < 2 ? [] : transactions;
  const displayAccounts = debouncedQuery.length < 2 ? [] : accounts;

  const allPages = [...navItems, settingsNavItem];

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <Command shouldFilter={true} loop>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search pages, transactions, accounts..."
        />
        <CommandList>
          <CommandEmpty>
            {searching ? "Searching..." : "No results found."}
          </CommandEmpty>

          {/* Pages */}
          <CommandGroup heading="Pages">
            {allPages.map((item) => (
              <CommandItem
                key={item.href}
                value={`page ${item.label}`}
                onSelect={() => navigateTo(item.href)}
              >
                <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          {/* Quick Actions */}
          <CommandGroup heading="Actions">
            <CommandItem
              value="action sync accounts refresh data"
              onSelect={handleSync}
            >
              <RefreshCw className="mr-2 h-4 w-4 text-muted-foreground" />
              Sync accounts
            </CommandItem>
            <CommandItem
              value="action toggle theme dark light mode"
              onSelect={handleToggleTheme}
            >
              {isDark ? (
                <Sun className="mr-2 h-4 w-4 text-muted-foreground" />
              ) : (
                <Moon className="mr-2 h-4 w-4 text-muted-foreground" />
              )}
              {isDark ? "Switch to light mode" : "Switch to dark mode"}
            </CommandItem>
            <CommandItem
              value="action sign out log out"
              onSelect={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4 text-muted-foreground" />
              Sign out
            </CommandItem>
          </CommandGroup>

          {/* Transactions (server search results) */}
          {displayTransactions.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Transactions">
                {displayTransactions.map((txn) => {
                  const displayName = txn.merchantName || txn.name;
                  const isIncome = txn.amount < 0;
                  const dateStr = new Date(txn.date).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" }
                  );
                  return (
                    <CommandItem
                      key={txn.id}
                      value={`txn ${txn.name} ${txn.merchantName ?? ""}`}
                      onSelect={() => navigateTo("/dashboard/transactions")}
                    >
                      <ArrowLeftRight className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{displayName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {dateStr}
                      </span>
                      <span
                        className={`ml-2 text-sm font-semibold tabular-nums ${
                          isIncome ? "text-emerald-400" : "text-foreground"
                        }`}
                      >
                        {isIncome ? "+" : ""}
                        {formatCurrency(Math.abs(txn.amount), txn.currency)}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}

          {/* Accounts (server search results) */}
          {displayAccounts.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Accounts">
                {displayAccounts.map((acc) => (
                  <CommandItem
                    key={acc.id}
                    value={`acct ${acc.name} ${acc.officialName ?? ""}`}
                    onSelect={() => navigateTo("/dashboard/accounts")}
                  >
                    <Landmark className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{acc.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground capitalize">
                      {acc.type}
                    </span>
                    {acc.currentBalance != null && (
                      <span className="ml-2 text-sm font-semibold tabular-nums">
                        {formatCurrency(acc.currentBalance, acc.currency)}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>

        {/* Keyboard hints footer */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              ↑↓
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              ↵
            </kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              Esc
            </kbd>
            Close
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}
