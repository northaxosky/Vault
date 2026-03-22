"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Wallet,
  Landmark,
  CreditCard,
  PiggyBank,
  RefreshCw,
  ArrowRight,
  Film,
  UtensilsCrossed,
  ShoppingBag,
  DollarSign,
  Heart,
  Home,
  ArrowUpRight,
  Car,
  Plane,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PlaidLink from "@/components/PlaidLink";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

// --- Types ---

interface AccountData {
  id: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  currency: string;
}

interface InstitutionData {
  id: string;
  institutionName: string | null;
  createdAt: string;
  accounts: AccountData[];
}

interface SummaryData {
  netWorth: number;
  cashTotal: number;
  creditTotal: number;
  totalAccounts: number;
}

interface TransactionData {
  id: string;
  name: string;
  merchantName: string | null;
  amount: number;
  date: string;
  category: string | null;
  subcategory: string | null;
  pending: boolean;
  currency: string;
  accountName: string;
}

interface CategorySpending {
  category: string;
  total: number;
}

interface DashboardClientProps {
  summary: SummaryData;
  institutions: InstitutionData[];
  recentTransactions: TransactionData[];
  categorySpending: CategorySpending[];
}

// --- Category config ---

const CATEGORY_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
  ENTERTAINMENT: { label: "Entertainment", icon: Film },
  FOOD_AND_DRINK: { label: "Food & Drink", icon: UtensilsCrossed },
  GENERAL_MERCHANDISE: { label: "General Merchandise", icon: ShoppingBag },
  INCOME: { label: "Income", icon: DollarSign },
  PERSONAL_CARE: { label: "Personal Care", icon: Heart },
  RENT_AND_UTILITIES: { label: "Rent & Utilities", icon: Home },
  TRANSFER_OUT: { label: "Transfer Out", icon: ArrowUpRight },
  TRANSPORTATION: { label: "Transportation", icon: Car },
  TRAVEL: { label: "Travel", icon: Plane },
};

function getCategoryLabel(category: string | null): string {
  if (!category) return "Uncategorized";
  return CATEGORY_CONFIG[category]?.label ?? category;
}

function getCategoryIcon(category: string | null): LucideIcon {
  if (!category) return CircleDot;
  return CATEGORY_CONFIG[category]?.icon ?? CircleDot;
}

// --- Chart colors ---
// Uses accent-derived chart CSS variables defined in the layout.

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

// --- Helpers ---

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// --- Component ---

export default function DashboardClient({
  summary,
  institutions,
  recentTransactions,
  categorySpending,
}: DashboardClientProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);

  // Sync transactions from Plaid for all linked banks.
  // Uses a ref guard to prevent concurrent syncs (e.g., if auto-sync
  // is running when the user clicks the Sync button).
  const triggerSync = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    setSyncing(true);

    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        // Re-run the server component so it picks up fresh data from Prisma.
        router.refresh();
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
      syncInProgress.current = false;
    }
  }, [router]);

  // Auto-sync on mount — fetches latest transactions in the background.
  // The user sees stale data immediately (fast first paint), then it updates.
  useEffect(() => {
    if (institutions.length > 0) {
      triggerSync();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLinkSuccess = () => {
    // Re-run the server component to fetch updated data from Prisma.
    // This is a Next.js soft navigation — no full page reload.
    router.refresh();
  };

  // Empty state — no linked accounts yet
  if (institutions.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your financial overview
        </p>

        <div className="mt-8 glass rounded-xl p-12 text-center">
          <Landmark className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            Welcome to Vault
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Link your first bank account to start tracking your finances.
          </p>
          <div className="mt-6 inline-block">
            <PlaidLink onLinkSuccess={handleLinkSuccess} />
          </div>
        </div>
      </div>
    );
  }

  // Prepare chart data with labels for the tooltip
  const chartData = categorySpending.map((item) => ({
    name: getCategoryLabel(item.category),
    value: item.total,
  }));

  const totalSpending = categorySpending.reduce((sum, c) => sum + c.total, 0);

  // Populated state — has linked accounts
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your financial overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? "Syncing..." : "Sync"}
          </button>
          <PlaidLink onLinkSuccess={handleLinkSuccess} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Net Worth */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Worth</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {formatCurrency(summary.netWorth)}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.totalAccounts} account
                {summary.totalAccounts !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Cash */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <PiggyBank className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cash</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {formatCurrency(summary.cashTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                Checking &amp; savings
              </p>
            </div>
          </div>
        </div>

        {/* Credit */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Credit</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {formatCurrency(summary.creditTotal)}
              </p>
              <p className="text-xs text-muted-foreground">Amount owed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions + Spending Chart — side by side on larger screens */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Transactions */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Recent Transactions
            </h2>
            <Link
              href="/dashboard/transactions"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              No recent transactions
            </p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {recentTransactions.map((txn) => {
                const Icon = getCategoryIcon(txn.category);
                const isIncome = txn.amount < 0;

                return (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {txn.merchantName || txn.name || getCategoryLabel(txn.category)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {txn.accountName}
                          {txn.pending && (
                            <Badge variant="secondary" className="ml-2 text-[10px] py-0">
                              Pending
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        isIncome ? "text-emerald-400" : "text-foreground"
                      }`}
                    >
                      {isIncome ? "+" : ""}
                      {formatCurrency(
                        Math.abs(txn.amount),
                        txn.currency
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Spending by Category */}
        <div className="glass rounded-xl p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Spending by Category
            </h2>
            <p className="text-xs text-muted-foreground">This month</p>
          </div>

          {categorySpending.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              No spending data this month
            </p>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
              {/* Pie chart */}
              <div className="shrink-0">
                <PieChart width={192} height={192}>
                  <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                  </PieChart>
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-2 w-full">
                {categorySpending.map((item, index) => (
                  <div
                    key={item.category}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{
                          backgroundColor:
                            CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                      <span className="text-foreground truncate">
                        {getCategoryLabel(item.category)}
                      </span>
                    </div>
                    <div className="shrink-0 flex items-center gap-2 tabular-nums">
                      <span className="text-muted-foreground text-xs">
                        {totalSpending > 0
                          ? `${((item.total / totalSpending) * 100).toFixed(0)}%`
                          : ""}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Linked Accounts */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">
          Linked Accounts
        </h2>

        <div className="mt-4 space-y-4">
          {institutions.map((institution) => (
            <div key={institution.id} className="glass rounded-xl p-6">
              {/* Institution header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Landmark className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">
                    {institution.institutionName || "Unknown Bank"}
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  Linked{" "}
                  {new Date(institution.createdAt).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                </span>
              </div>

              {/* Separator */}
              <div className="my-4 border-t border-border" />

              {/* Account rows */}
              <div className="space-y-3">
                {institution.accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {account.name}
                      </p>
                      {account.officialName &&
                        account.officialName !== account.name && (
                          <p className="text-xs text-muted-foreground">
                            {account.officialName}
                          </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-xs">
                        {account.type}
                      </Badge>
                      <p className="text-sm font-semibold text-foreground tabular-nums w-28 text-right">
                        {account.currentBalance !== null
                          ? formatCurrency(
                              account.currentBalance,
                              account.currency
                            )
                          : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
