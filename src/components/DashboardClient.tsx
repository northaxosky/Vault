"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Wallet,
  Landmark,
  CreditCard,
  PiggyBank,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import BankActionDropdown from "@/components/BankActionDropdown";
import CsvImportDialog from "@/components/CsvImportDialog";
import PortfolioImportDialog from "@/components/PortfolioImportDialog";
import { getCategoryLabel, getCategoryIcon, getEffectiveCategory, formatCurrency, formatFrequency } from "@/lib/categories";
import { PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TransactionData } from "@/lib/types";
import TransactionDrawer from "@/components/TransactionDrawer";
import CreditScoreCard from "@/components/dashboard/CreditScoreCard";
import WidgetCustomizer from "@/components/dashboard/WidgetCustomizer";
import UpcomingBillsCard from "@/components/dashboard/UpcomingBillsCard";
import SavingsGoalsCard from "@/components/dashboard/SavingsGoalsCard";
import BudgetOverviewCard from "@/components/dashboard/BudgetOverviewCard";
import DebtSummaryCard from "@/components/dashboard/DebtSummaryCard";
import ActivityHeatmapCard from "@/components/dashboard/ActivityHeatmapCard";
import StockWatchlistCard from "@/components/dashboard/StockWatchlistCard";
import QuickLinksCard from "@/components/dashboard/QuickLinksCard";
import type { WidgetId } from "@/lib/widgets";

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

interface CategorySpending {
  category: string;
  total: number;
}

interface DailyTrendData {
  date: string;
  spending: number;
  income: number;
  cashFlow: number;
  netWorth: number | null;
}

interface DashboardClientProps {
  summary: SummaryData;
  institutions: InstitutionData[];
  recentTransactions: TransactionData[];
  categorySpending: CategorySpending[];
  dailyTrend: DailyTrendData[];
  enabledWidgets: WidgetId[];
  plaidEnv?: string;
  isDemo?: boolean;
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

// --- Trend chart config ---

type TrendTab = "spending" | "income" | "cashFlow" | "netWorth";

const TREND_TABS: { value: TrendTab; label: string; color: string }[] = [
  { value: "spending", label: "Spending", color: "var(--chart-1)" },
  { value: "income", label: "Income", color: "var(--chart-2)" },
  { value: "cashFlow", label: "Cash Flow", color: "var(--chart-3)" },
  { value: "netWorth", label: "Net Worth", color: "var(--chart-4)" },
];

type TimeRange = "1W" | "1M" | "3M" | "6M";

const TIME_RANGES: { value: TimeRange; label: string; daysBack: number }[] = [
  { value: "1W", label: "1W", daysBack: 7 },
  { value: "1M", label: "1M", daysBack: 30 },
  { value: "3M", label: "3M", daysBack: 90 },
  { value: "6M", label: "6M", daysBack: 180 },
];

// --- Component ---

export default function DashboardClient({
  summary,
  institutions,
  recentTransactions,
  categorySpending,
  dailyTrend,
  enabledWidgets,
  plaidEnv,
  isDemo = false,
}: DashboardClientProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);
  const [activeTab, setActiveTab] = useState<TrendTab>("spending");
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [selectedTxn, setSelectedTxn] = useState<TransactionData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [widgets, setWidgets] = useState<WidgetId[]>(enabledWidgets);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [portfolioImportOpen, setPortfolioImportOpen] = useState(false);

  const handleRowClick = useCallback((txn: TransactionData) => {
    setSelectedTxn(txn);
    setDrawerOpen(true);
  }, []);

  // Filter trend data to the selected time range.
  const filteredTrend = useMemo(() => {
    const daysBack = TIME_RANGES.find((r) => r.value === timeRange)!.daysBack;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return dailyTrend.filter((d) => d.date >= cutoffStr);
  }, [dailyTrend, timeRange]);

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
            <BankActionDropdown onLinkSuccess={handleLinkSuccess} onImportCsv={() => setCsvImportOpen(true)} onImportPortfolio={() => setPortfolioImportOpen(true)} isDemo={isDemo} />
          </div>
        </div>
        <CsvImportDialog open={csvImportOpen} onClose={() => setCsvImportOpen(false)} onSuccess={handleLinkSuccess} />
        <PortfolioImportDialog open={portfolioImportOpen} onClose={() => setPortfolioImportOpen(false)} onSuccess={handleLinkSuccess} />
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            Your financial overview
            {plaidEnv && plaidEnv !== "production" && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                plaidEnv === "sandbox"
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-blue-500/10 text-blue-500"
              }`}>
                Plaid {plaidEnv}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <WidgetCustomizer enabledWidgets={widgets} onSave={setWidgets} />
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
          <BankActionDropdown onLinkSuccess={handleLinkSuccess} onImportCsv={() => setCsvImportOpen(true)} onImportPortfolio={() => setPortfolioImportOpen(true)} isDemo={isDemo} />
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

      {/* Trend Chart */}
      <div className="mt-6 glass rounded-xl p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TrendTab)}
          >
            <TabsList>
              {TREND_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex gap-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  timeRange === range.value
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          {filteredTrend.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No data for this time range
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={filteredTrend}>
                <defs>
                  {TREND_TABS.map((tab) => (
                    <linearGradient
                      key={tab.value}
                      id={`gradient-${tab.value}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={tab.color}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={tab.color}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val: string) => {
                    const d = new Date(val + "T00:00:00");
                    return d.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  stroke="var(--foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(val: number) => {
                    const abs = Math.abs(val);
                    const formatted =
                      abs >= 1000
                        ? `$${(abs / 1000).toFixed(1)}k`
                        : `$${Math.round(abs)}`;
                    return val < 0 ? `-${formatted}` : formatted;
                  }}
                  domain={[
                    (dataMin: number) => Math.min(0, dataMin),
                    (dataMax: number) => Math.max(0, dataMax),
                  ]}
                  stroke="var(--foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    TREND_TABS.find((t) => t.value === activeTab)!.label,
                  ]}
                  labelFormatter={(label) => {
                    const d = new Date(String(label) + "T00:00:00");
                    return d.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    });
                  }}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    color: "var(--foreground)",
                    fontSize: "0.875rem",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={activeTab}
                  stroke={
                    TREND_TABS.find((t) => t.value === activeTab)!.color
                  }
                  strokeWidth={2}
                  fill={`url(#gradient-${activeTab})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Transactions + Spending Chart + Credit Score */}
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
                const effectiveCat = getEffectiveCategory(txn.userCategory, txn.category);
                const Icon = getCategoryIcon(effectiveCat);
                const isIncome = txn.amount < 0;

                return (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0 cursor-pointer transition-colors hover:bg-accent/50 rounded-lg px-2 -mx-2"
                    onClick={() => handleRowClick(txn)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {txn.merchantName || txn.name || getCategoryLabel(effectiveCat)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {txn.accountName}
                          {txn.pending && (
                            <Badge variant="secondary" className="ml-2 text-[10px] py-0">
                              Pending
                            </Badge>
                          )}
                          {txn.isRecurring && (
                            <Badge variant="secondary" className="ml-2 text-[10px] py-0">
                              {formatFrequency(txn.recurringFrequency)}
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
                      nameKey="name"
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
                      formatter={(value, name) => [
                        formatCurrency(Number(value)),
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        color: "var(--foreground)",
                        fontSize: "0.875rem",
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

      {/* Toggleable Widget Cards */}
      {widgets.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {widgets.includes("credit-score") && <CreditScoreCard />}
          {widgets.includes("upcoming-bills") && <UpcomingBillsCard />}
          {widgets.includes("savings-goals") && <SavingsGoalsCard />}
          {widgets.includes("budget-overview") && <BudgetOverviewCard />}
          {widgets.includes("debt-summary") && <DebtSummaryCard />}
          {widgets.includes("activity-heatmap") && <ActivityHeatmapCard />}
          {widgets.includes("stock-watchlist") && <StockWatchlistCard />}
          {widgets.includes("quick-links") && <QuickLinksCard />}
        </div>
      )}

      {/* Linked Accounts */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">
          Linked Accounts
        </h2>

        <div className="mt-4 space-y-4">
          {institutions.map((institution) => (
            <div key={institution.id} className="glass rounded-xl p-6">
              {/* Institution header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Landmark className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground truncate">
                    {institution.institutionName || "Unknown Bank"}
                  </h3>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
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
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {account.name}
                      </p>
                      {account.officialName &&
                        account.officialName !== account.name && (
                          <p className="text-xs text-muted-foreground">
                            {account.officialName}
                          </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
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

      {/* Transaction detail drawer */}
      <TransactionDrawer
        transaction={selectedTxn}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUpdate={(id, updates) => {
          // Update the selected transaction in the drawer
          setSelectedTxn((prev) =>
            prev && prev.id === id ? { ...prev, ...updates } : prev
          );
        }}
      />
      <CsvImportDialog open={csvImportOpen} onClose={() => setCsvImportOpen(false)} onSuccess={handleLinkSuccess} />
      <PortfolioImportDialog open={portfolioImportOpen} onClose={() => setPortfolioImportOpen(false)} onSuccess={handleLinkSuccess} />
    </div>
  );
}
