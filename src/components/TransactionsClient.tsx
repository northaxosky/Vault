"use client";

import { useMemo, useState } from "react";
import {
  Search,
  X,
  ArrowLeftRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_CONFIG, getCategoryLabel, getCategoryIcon, formatCurrency, formatFrequency } from "@/lib/categories";

// --- Types ---

interface TransactionData {
  id: string;
  name: string;
  merchantName: string | null;
  amount: number; // positive = spending, negative = income
  date: string; // ISO string
  category: string | null;
  subcategory: string | null;
  pending: boolean;
  isRecurring: boolean;
  recurringFrequency: string | null;
  currency: string;
  accountName: string;
}

interface TransactionsClientProps {
  transactions: TransactionData[];
}

// --- Helpers ---

/** Group transactions by date string (YYYY-MM-DD). Preserves insertion order. */
function groupByDate(
  transactions: TransactionData[]
): Map<string, TransactionData[]> {
  const groups = new Map<string, TransactionData[]>();
  for (const txn of transactions) {
    const dateKey = txn.date.slice(0, 10); // "2026-03-15"
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(txn);
    } else {
      groups.set(dateKey, [txn]);
    }
  }
  return groups;
}

/** Format "2026-03-15" → "Saturday, March 15, 2026" */
function formatDateHeader(isoDateStr: string): string {
  // Use noon UTC to avoid timezone-offset issues shifting the day
  const date = new Date(isoDateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// --- Transaction row ---

function TransactionRow({ txn }: { txn: TransactionData }) {
  const Icon = getCategoryIcon(txn.category);
  const isIncome = txn.amount < 0;
  const displayAmount = Math.abs(txn.amount);
  const displayName = txn.merchantName || txn.name || getCategoryLabel(txn.category);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Category icon */}
      <div className="shrink-0 rounded-lg bg-primary/10 p-2">
        <Icon className="h-4 w-4 text-primary" />
      </div>

      {/* Name + category */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {displayName}
          </p>
          {txn.pending && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              Pending
            </Badge>
          )}
          {txn.isRecurring && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {formatFrequency(txn.recurringFrequency)}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {getCategoryLabel(txn.category)}
        </p>
      </div>

      {/* Account name */}
      <p className="hidden shrink-0 text-xs text-muted-foreground sm:block">
        {txn.accountName}
      </p>

      {/* Amount */}
      <p
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          isIncome ? "text-emerald-400" : "text-foreground"
        }`}
      >
        {isIncome ? "+" : ""}
        {formatCurrency(displayAmount, txn.currency)}
      </p>
    </div>
  );
}

// --- Main component ---

export default function TransactionsClient({
  transactions,
}: TransactionsClientProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [recurringOnly, setRecurringOnly] = useState(false);

  // Filter transactions based on search text, category, and recurring toggle.
  // useMemo avoids re-filtering on every render.
  const filtered = useMemo(() => {
    return transactions.filter((txn) => {
      // Search filter: match against name, merchantName, or subcategory
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = txn.name.toLowerCase().includes(q);
        const merchantMatch =
          txn.merchantName?.toLowerCase().includes(q) ?? false;
        const subcategoryMatch =
          txn.subcategory?.toLowerCase().includes(q) ?? false;
        if (!nameMatch && !merchantMatch && !subcategoryMatch) return false;
      }

      // Category filter
      if (categoryFilter !== "all" && txn.category !== categoryFilter) {
        return false;
      }

      // Recurring filter
      if (recurringOnly && !txn.isRecurring) return false;

      return true;
    });
  }, [transactions, search, categoryFilter, recurringOnly]);

  // Group filtered transactions by date for section headers.
  const dateGroups = useMemo(() => {
    return Array.from(groupByDate(filtered).entries());
  }, [filtered]);

  // Empty state — no transactions at all
  if (transactions.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your complete transaction history
        </p>

        <div className="mt-8 glass rounded-xl p-12 text-center">
          <ArrowLeftRight className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            No transactions yet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Transactions will appear here once your accounts are synced.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your complete transaction history
      </p>

      {/* Filter bar */}
      <div className="mt-6 glass rounded-xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category dropdown */}
          <Select
            value={categoryFilter}
            onValueChange={(val) => setCategoryFilter(val ?? "all")}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(CATEGORY_CONFIG).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Recurring toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="recurring-only"
              checked={recurringOnly}
              onCheckedChange={setRecurringOnly}
            />
            <Label htmlFor="recurring-only" className="text-sm text-muted-foreground whitespace-nowrap cursor-pointer">
              Recurring only
            </Label>
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="mt-4 text-sm text-muted-foreground">
        Showing {filtered.length} of {transactions.length} transactions
      </p>

      {/* Transaction list grouped by date */}
      {dateGroups.length > 0 ? (
        <div className="mt-4 space-y-6">
          {dateGroups.map(([dateKey, txns]) => (
            <div key={dateKey}>
              {/* Date header */}
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                {formatDateHeader(dateKey)}
              </h2>

              {/* Transactions card for this date */}
              <div className="glass rounded-xl divide-y divide-border">
                {txns.map((txn) => (
                  <TransactionRow key={txn.id} txn={txn} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* No results from filtering */
        <div className="mt-8 glass rounded-xl p-12 text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            No matching transactions
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your search or category filter.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setCategoryFilter("all");
            }}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
