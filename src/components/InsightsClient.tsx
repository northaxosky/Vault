"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  Receipt,
  BarChart3,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, getCategoryLabel, getCategoryIcon } from "@/lib/categories";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// --- Types ---

interface TransactionData {
  amount: number;
  date: string;
  category: string | null;
  merchantName: string | null;
  name: string;
}

interface BudgetData {
  category: string;
  amount: number;
}

interface SnapshotData {
  date: string;
  balance: number;
  accountType: string;
}

interface InsightsClientProps {
  transactions: TransactionData[];
  budgets: BudgetData[];
  snapshots: SnapshotData[];
  currentNetWorth: number;
}

// --- Chart colors ---

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

// --- Helpers ---

function getMonthLabel(year: number, month: number): string {
  return new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function txnsForMonth(
  transactions: TransactionData[],
  year: number,
  month: number
): TransactionData[] {
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  return transactions.filter((t) => t.date.slice(0, 7) === key);
}

function txnsForYear(
  transactions: TransactionData[],
  year: number
): TransactionData[] {
  const prefix = `${year}-`;
  return transactions.filter((t) => t.date.startsWith(prefix));
}

// --- Main Component ---

export default function InsightsClient({
  transactions,
  budgets,
  snapshots,
}: InsightsClientProps) {
  const now = useMemo(() => new Date(), []);

  // Monthly Report state
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const [reportMonth, setReportMonth] = useState(now.getMonth());

  // Year in Review state
  const [reviewYear, setReviewYear] = useState(now.getFullYear());

  // === MONTHLY REPORT DATA ===

  const monthTxns = useMemo(
    () => txnsForMonth(transactions, reportYear, reportMonth),
    [transactions, reportYear, reportMonth]
  );

  const prevMonthTxns = useMemo(() => {
    const pm = reportMonth === 0 ? 11 : reportMonth - 1;
    const py = reportMonth === 0 ? reportYear - 1 : reportYear;
    return txnsForMonth(transactions, py, pm);
  }, [transactions, reportYear, reportMonth]);

  const monthIncome = useMemo(
    () =>
      monthTxns
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    [monthTxns]
  );

  const monthSpending = useMemo(
    () =>
      monthTxns
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0),
    [monthTxns]
  );

  const monthNet = monthIncome - monthSpending;

  // Net worth change for the month (from snapshots)
  const monthNetWorthChange = useMemo(() => {
    const monthKey = `${reportYear}-${String(reportMonth + 1).padStart(2, "0")}`;
    const monthSnaps = snapshots.filter((s) => s.date.slice(0, 7) === monthKey);
    if (monthSnaps.length < 2) return null;

    // Get first and last day net worth
    const byDate = new Map<string, number>();
    for (const snap of monthSnaps) {
      const dateKey = snap.date.slice(0, 10);
      const current = byDate.get(dateKey) ?? 0;
      if (snap.accountType === "credit") {
        byDate.set(dateKey, current - snap.balance);
      } else {
        byDate.set(dateKey, current + snap.balance);
      }
    }
    const sorted = [...byDate.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    if (sorted.length < 2) return null;
    return sorted[sorted.length - 1][1] - sorted[0][1];
  }, [snapshots, reportYear, reportMonth]);

  // Top 5 merchants
  const topMerchants = useMemo(() => {
    const spending = monthTxns.filter((t) => t.amount > 0);
    const merchantMap = new Map<string, { total: number; count: number }>();
    for (const t of spending) {
      const name = t.merchantName || t.name;
      const existing = merchantMap.get(name) ?? { total: 0, count: 0 };
      existing.total += t.amount;
      existing.count++;
      merchantMap.set(name, existing);
    }
    return [...merchantMap.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [monthTxns]);

  // Budget performance
  const budgetPerformance = useMemo(() => {
    if (budgets.length === 0) return null;
    const categorySpending = new Map<string, number>();
    for (const t of monthTxns) {
      if (t.amount > 0 && t.category) {
        categorySpending.set(
          t.category,
          (categorySpending.get(t.category) ?? 0) + t.amount
        );
      }
    }
    const results = budgets.map((b) => ({
      category: b.category,
      budgeted: b.amount,
      spent: categorySpending.get(b.category) ?? 0,
    }));
    const onTrack = results.filter((r) => r.spent <= r.budgeted).length;
    return { results, onTrack, total: results.length };
  }, [monthTxns, budgets]);

  // Category breakdown for pie chart
  const categoryBreakdown = useMemo(() => {
    const categoryMap = new Map<string, number>();
    for (const t of monthTxns) {
      if (t.amount > 0) {
        const cat = t.category || "UNCATEGORIZED";
        categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + t.amount);
      }
    }
    return [...categoryMap.entries()]
      .map(([category, total]) => ({
        name: getCategoryLabel(category),
        value: Math.round(total * 100) / 100,
        category,
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthTxns]);

  // === SPENDING INSIGHTS DATA ===

  const prevMonthSpending = useMemo(
    () =>
      prevMonthTxns
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0),
    [prevMonthTxns]
  );

  const spendingChange = useMemo(() => {
    if (prevMonthSpending === 0) return null;
    return ((monthSpending - prevMonthSpending) / prevMonthSpending) * 100;
  }, [monthSpending, prevMonthSpending]);

  // Category change alerts (>20% change)
  const categoryAlerts = useMemo(() => {
    const currentCats = new Map<string, number>();
    const prevCats = new Map<string, number>();

    for (const t of monthTxns) {
      if (t.amount > 0 && t.category) {
        currentCats.set(
          t.category,
          (currentCats.get(t.category) ?? 0) + t.amount
        );
      }
    }
    for (const t of prevMonthTxns) {
      if (t.amount > 0 && t.category) {
        prevCats.set(
          t.category,
          (prevCats.get(t.category) ?? 0) + t.amount
        );
      }
    }

    const alerts: {
      category: string;
      current: number;
      previous: number;
      changePct: number;
    }[] = [];

    for (const [cat, current] of currentCats) {
      const prev = prevCats.get(cat) ?? 0;
      if (prev === 0) continue;
      const pct = ((current - prev) / prev) * 100;
      if (Math.abs(pct) > 20) {
        alerts.push({ category: cat, current, previous: prev, changePct: pct });
      }
    }

    return alerts.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  }, [monthTxns, prevMonthTxns]);

  // Largest transaction
  const largestTxn = useMemo(() => {
    const spending = monthTxns.filter((t) => t.amount > 0);
    if (spending.length === 0) return null;
    return spending.reduce((max, t) => (t.amount > max.amount ? t : max));
  }, [monthTxns]);

  // Average daily spending
  const avgDailySpending = useMemo(() => {
    const daysInMonth = new Date(reportYear, reportMonth + 1, 0).getDate();
    const isCurrentMonth =
      reportYear === now.getFullYear() && reportMonth === now.getMonth();
    const activeDays = isCurrentMonth ? now.getDate() : daysInMonth;
    return activeDays > 0 ? monthSpending / activeDays : 0;
  }, [monthSpending, reportYear, reportMonth, now]);

  // === YEAR IN REVIEW DATA ===

  const yearTxns = useMemo(
    () => txnsForYear(transactions, reviewYear),
    [transactions, reviewYear]
  );

  const yearIncome = useMemo(
    () =>
      yearTxns
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    [yearTxns]
  );

  const yearSpending = useMemo(
    () =>
      yearTxns
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0),
    [yearTxns]
  );

  const savingsRate = yearIncome > 0 ? ((yearIncome - yearSpending) / yearIncome) * 100 : 0;

  // Net worth change for the year (snapshots)
  const yearNetWorthChange = useMemo(() => {
    const prefix = `${reviewYear}-`;
    const yearSnaps = snapshots.filter((s) => s.date.startsWith(prefix));
    if (yearSnaps.length < 2) return null;

    const byDate = new Map<string, number>();
    for (const snap of yearSnaps) {
      const dateKey = snap.date.slice(0, 10);
      const current = byDate.get(dateKey) ?? 0;
      if (snap.accountType === "credit") {
        byDate.set(dateKey, current - snap.balance);
      } else {
        byDate.set(dateKey, current + snap.balance);
      }
    }
    const sorted = [...byDate.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    if (sorted.length < 2) return null;
    return sorted[sorted.length - 1][1] - sorted[0][1];
  }, [snapshots, reviewYear]);

  // Monthly spending bar chart
  const monthlySpendingBars = useMemo(() => {
    const months: { month: string; spending: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const key = `${reviewYear}-${String(m + 1).padStart(2, "0")}`;
      const total = yearTxns
        .filter((t) => t.date.slice(0, 7) === key && t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      months.push({
        month: new Date(reviewYear, m).toLocaleDateString("en-US", {
          month: "short",
        }),
        spending: Math.round(total * 100) / 100,
      });
    }
    return months;
  }, [yearTxns, reviewYear]);

  // Top 5 categories for the year
  const topYearCategories = useMemo(() => {
    const catMap = new Map<string, number>();
    for (const t of yearTxns) {
      if (t.amount > 0) {
        const cat = t.category || "UNCATEGORIZED";
        catMap.set(cat, (catMap.get(cat) ?? 0) + t.amount);
      }
    }
    return [...catMap.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [yearTxns]);

  // Top 5 merchants for the year
  const topYearMerchants = useMemo(() => {
    const merchantMap = new Map<string, { total: number; count: number }>();
    for (const t of yearTxns) {
      if (t.amount > 0) {
        const name = t.merchantName || t.name;
        const existing = merchantMap.get(name) ?? { total: 0, count: 0 };
        existing.total += t.amount;
        existing.count++;
        merchantMap.set(name, existing);
      }
    }
    return [...merchantMap.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [yearTxns]);

  // Biggest single expense
  const biggestExpense = useMemo(() => {
    const spending = yearTxns.filter((t) => t.amount > 0);
    if (spending.length === 0) return null;
    return spending.reduce((max, t) => (t.amount > max.amount ? t : max));
  }, [yearTxns]);

  // --- Month nav helpers ---

  function prevReportMonth() {
    if (reportMonth === 0) {
      setReportMonth(11);
      setReportYear(reportYear - 1);
    } else {
      setReportMonth(reportMonth - 1);
    }
  }

  function nextReportMonth() {
    if (reportMonth === 11) {
      setReportMonth(0);
      setReportYear(reportYear + 1);
    } else {
      setReportMonth(reportMonth + 1);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">Insights & Reports</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Analyze your spending patterns and financial trends
      </p>

      {/* Tabs */}
      <Tabs defaultValue="report" className="mt-6">
        <TabsList>
          <TabsTrigger value="report">Monthly Report</TabsTrigger>
          <TabsTrigger value="insights">Spending Insights</TabsTrigger>
          <TabsTrigger value="year">Year in Review</TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: MONTHLY REPORT ===== */}
        <TabsContent value="report">
          {/* Month navigation */}
          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={prevReportMonth}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-semibold text-foreground min-w-[180px] text-center">
              {getMonthLabel(reportYear, reportMonth)}
            </h2>
            <button
              onClick={nextReportMonth}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Summary cards */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2.5">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Income</p>
                  <p className="text-xl font-bold text-emerald-400 tabular-nums">
                    {formatCurrency(monthIncome)}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-500/10 p-2.5">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spending</p>
                  <p className="text-xl font-bold text-red-400 tabular-nums">
                    {formatCurrency(monthSpending)}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <PiggyBank className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Savings</p>
                  <p
                    className={`text-xl font-bold tabular-nums ${
                      monthNet >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {monthNet >= 0 ? "+" : ""}
                    {formatCurrency(monthNet)}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Net Worth Change
                  </p>
                  <p
                    className={`text-xl font-bold tabular-nums ${
                      monthNetWorthChange != null && monthNetWorthChange >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {monthNetWorthChange != null
                      ? `${monthNetWorthChange >= 0 ? "+" : ""}${formatCurrency(monthNetWorthChange)}`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {monthTxns.length === 0 ? (
            <div className="mt-8 glass rounded-xl p-12 text-center">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold text-foreground">
                No transactions this month
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Data will appear here once transactions are synced.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Top 5 Merchants */}
              <div className="glass rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground">
                  Top Merchants
                </h3>
                {topMerchants.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No spending data
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {topMerchants.map((m, i) => (
                      <div
                        key={m.name}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-muted-foreground w-5 text-right">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-foreground truncate">
                              {m.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {m.count} transaction{m.count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(m.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Category Breakdown (Pie Chart) */}
              <div className="glass rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground">
                  Spending by Category
                </h3>
                {categoryBreakdown.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No spending data
                  </p>
                ) : (
                  <div className="mt-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={categoryBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {categoryBreakdown.map((_, i) => (
                            <Cell
                              key={i}
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [
                            formatCurrency(Number(value)),
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
                    </ResponsiveContainer>
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      {categoryBreakdown.slice(0, 6).map((cat, i) => (
                        <div
                          key={cat.category}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                          <span className="text-muted-foreground truncate">
                            {cat.name}
                          </span>
                          <span className="ml-auto tabular-nums text-foreground">
                            {formatCurrency(cat.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Budget Performance */}
          {budgetPerformance && (
            <div className="mt-4 glass rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground">
                Budget Performance
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {budgetPerformance.onTrack} of {budgetPerformance.total} on
                track
              </p>
              <div className="mt-4 space-y-3">
                {budgetPerformance.results.map((b) => {
                  const pct = Math.min(
                    (b.spent / b.budgeted) * 100,
                    100
                  );
                  const over = b.spent > b.budgeted;
                  return (
                    <div key={b.category}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">
                          {getCategoryLabel(b.category)}
                        </span>
                        <span
                          className={`tabular-nums font-medium ${
                            over ? "text-red-400" : "text-foreground"
                          }`}
                        >
                          {formatCurrency(b.spent)} / {formatCurrency(b.budgeted)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            over ? "bg-red-500" : "bg-primary"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== TAB 2: SPENDING INSIGHTS ===== */}
        <TabsContent value="insights">
          {/* Month navigation (same as report) */}
          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={prevReportMonth}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-semibold text-foreground min-w-[180px] text-center">
              {getMonthLabel(reportYear, reportMonth)}
            </h2>
            <button
              onClick={nextReportMonth}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Month-over-month comparison */}
          <div className="mt-4 glass rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-lg p-2.5 ${
                  spendingChange != null && spendingChange > 0
                    ? "bg-red-500/10"
                    : "bg-emerald-500/10"
                }`}
              >
                {spendingChange != null && spendingChange > 0 ? (
                  <TrendingUp className="h-5 w-5 text-red-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-emerald-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Month-over-Month Spending
                </p>
                {spendingChange != null ? (
                  <>
                    <p
                      className={`text-2xl font-bold tabular-nums ${
                        spendingChange > 0 ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {spendingChange > 0 ? "+" : ""}
                      {spendingChange.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(monthSpending)} vs{" "}
                      {formatCurrency(prevMonthSpending)} last month
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-bold text-foreground">
                    No comparison data
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Category change alerts */}
          {categoryAlerts.length > 0 && (
            <div className="mt-4 space-y-3">
              <h3 className="text-lg font-semibold text-foreground">
                Notable Changes
              </h3>
              {categoryAlerts.map((alert) => {
                const Icon = getCategoryIcon(alert.category);
                const isUp = alert.changePct > 0;
                return (
                  <div
                    key={alert.category}
                    className={`glass rounded-xl p-4 border-l-4 ${
                      isUp ? "border-l-red-500" : "border-l-emerald-500"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-lg p-2 ${
                          isUp ? "bg-red-500/10" : "bg-emerald-500/10"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 ${
                            isUp ? "text-red-400" : "text-emerald-400"
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">
                          You spent{" "}
                          <span
                            className={`font-semibold ${
                              isUp ? "text-red-400" : "text-emerald-400"
                            }`}
                          >
                            {Math.abs(alert.changePct).toFixed(0)}%{" "}
                            {isUp ? "more" : "less"}
                          </span>{" "}
                          on {getCategoryLabel(alert.category)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(alert.current)} vs{" "}
                          {formatCurrency(alert.previous)} last month
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Largest transaction + daily average */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="glass rounded-xl p-6">
              <h3 className="text-sm text-muted-foreground">
                Largest Transaction
              </h3>
              {largestTxn ? (
                <>
                  <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
                    {formatCurrency(largestTxn.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {largestTxn.merchantName || largestTxn.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(largestTxn.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {largestTxn.category && (
                      <>
                        {" "}
                        · {getCategoryLabel(largestTxn.category)}
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-lg text-foreground">—</p>
              )}
            </div>

            <div className="glass rounded-xl p-6">
              <h3 className="text-sm text-muted-foreground">
                Average Daily Spending
              </h3>
              <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
                {formatCurrency(avgDailySpending)}
              </p>
              <p className="text-xs text-muted-foreground">per day this month</p>
            </div>
          </div>
        </TabsContent>

        {/* ===== TAB 3: YEAR IN REVIEW ===== */}
        <TabsContent value="year">
          {/* Year navigation */}
          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={() => setReviewYear(reviewYear - 1)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-semibold text-foreground min-w-[80px] text-center">
              {reviewYear}
            </h2>
            <button
              onClick={() => setReviewYear(reviewYear + 1)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Summary cards */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-xl font-bold text-emerald-400 tabular-nums">
                {formatCurrency(yearIncome)}
              </p>
            </div>

            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground">Total Spending</p>
              <p className="text-xl font-bold text-red-400 tabular-nums">
                {formatCurrency(yearSpending)}
              </p>
            </div>

            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground">Savings Rate</p>
              <p
                className={`text-xl font-bold tabular-nums ${
                  savingsRate >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {savingsRate.toFixed(1)}%
              </p>
            </div>

            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground">Net Worth Change</p>
              <p
                className={`text-xl font-bold tabular-nums ${
                  yearNetWorthChange != null && yearNetWorthChange >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {yearNetWorthChange != null
                  ? `${yearNetWorthChange >= 0 ? "+" : ""}${formatCurrency(yearNetWorthChange)}`
                  : "—"}
              </p>
            </div>
          </div>

          {/* Monthly spending bar chart */}
          <div className="mt-6 glass rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground">
              Monthly Spending
            </h3>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlySpendingBars}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="var(--foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(val: number) =>
                      val >= 1000
                        ? `$${(val / 1000).toFixed(1)}k`
                        : `$${Math.round(val)}`
                    }
                    stroke="var(--foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      "Spending",
                    ]}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      color: "var(--foreground)",
                      fontSize: "0.875rem",
                    }}
                  />
                  <Bar
                    dataKey="spending"
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {yearTxns.length === 0 ? (
            <div className="mt-6 glass rounded-xl p-12 text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold text-foreground">
                No data for {reviewYear}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Transaction data will appear once accounts are synced.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Top Categories */}
              <div className="glass rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground">
                  Top Categories
                </h3>
                <div className="mt-4 space-y-3">
                  {topYearCategories.map((cat, i) => {
                    const Icon = getCategoryIcon(cat.category);
                    return (
                      <div
                        key={cat.category}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-muted-foreground w-5 text-right">
                            {i + 1}
                          </span>
                          <div className="rounded-lg bg-primary/10 p-1.5">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm text-foreground">
                            {getCategoryLabel(cat.category)}
                          </span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(cat.total)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Merchants */}
              <div className="glass rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground">
                  Top Merchants
                </h3>
                <div className="mt-4 space-y-3">
                  {topYearMerchants.map((m, i) => (
                    <div
                      key={m.name}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-5 text-right">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm text-foreground truncate">
                            {m.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.count} transaction{m.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(m.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Biggest single expense */}
          {biggestExpense && (
            <div className="mt-4 glass rounded-xl p-6">
              <h3 className="text-sm text-muted-foreground">
                Biggest Single Expense
              </h3>
              <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
                {formatCurrency(biggestExpense.amount)}
              </p>
              <p className="text-sm text-muted-foreground">
                {biggestExpense.merchantName || biggestExpense.name}
                <span className="mx-1.5">·</span>
                {new Date(biggestExpense.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
