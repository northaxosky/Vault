"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, CATEGORY_CONFIG, getCategoryLabel } from "@/lib/categories";

interface Transaction {
  id: string;
  amount: number;
  date: string;
  category: string | null;
  merchantName: string | null;
  accountId: string;
  accountName: string;
}

interface Budget {
  category: string;
  amount: number;
}

interface AnalyticsClientProps {
  transactions: Transaction[];
  budgets: Budget[];
}

type DateRangeType = "3mo" | "6mo" | "1yr" | "all";

// Helper: parse ISO date string (handles both "YYYY-MM-DD" and full ISO timestamps)
function parseISODate(dateString: string): Date {
  return new Date(dateString);
}

// Helper: get start date based on range type
function getStartDate(rangeType: DateRangeType): Date {
  const now = new Date();
  const start = new Date(now);

  switch (rangeType) {
    case "3mo":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6mo":
      start.setMonth(start.getMonth() - 6);
      break;
    case "1yr":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "all":
      // Set to a very old date
      start.setFullYear(2000);
      break;
  }

  return start;
}

// Helper: format date for chart labels (YYYY-MM)
function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

// Helper: get month key from date (YYYY-MM)
function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Helper: format month key (YYYY-MM) for chart display
function formatMonthDisplay(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return formatMonthLabel(date);
}

// Color palette for charts
const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export default function AnalyticsClient({
  transactions: initialTransactions,
  budgets,
}: AnalyticsClientProps) {
  const [dateRange, setDateRange] = useState<DateRangeType>("6mo");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");

  // Get unique accounts
  const accounts = useMemo(() => {
    const accountMap = new Map<string, string>();
    for (const txn of initialTransactions) {
      if (!accountMap.has(txn.accountId)) {
        accountMap.set(txn.accountId, txn.accountName);
      }
    }
    return Array.from(accountMap.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [initialTransactions]);

  // Filter transactions based on date range, category, and account
  const filteredTransactions = useMemo(() => {
    const startDate = getStartDate(dateRange);

    return initialTransactions.filter((txn) => {
      const txnDate = parseISODate(txn.date);

      // Date filter
      if (txnDate < startDate) return false;

      // Category filter
      if (selectedCategory !== "all" && txn.category !== selectedCategory) {
        return false;
      }

      // Account filter
      if (selectedAccount !== "all" && txn.accountId !== selectedAccount) {
        return false;
      }

      // Only include spending (positive amounts)
      if (txn.amount <= 0) return false;

      return true;
    });
  }, [initialTransactions, dateRange, selectedCategory, selectedAccount]);

  // Monthly spending by category
  const monthlyByCategory = useMemo(() => {
    const monthMap = new Map<
      string,
      Map<string, number>
    >();

    for (const txn of filteredTransactions) {
      const monthKey = getMonthKey(parseISODate(txn.date));
      const category = getCategoryLabel(txn.category);

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, new Map());
      }

      const catMap = monthMap.get(monthKey)!;
      catMap.set(category, (catMap.get(category) ?? 0) + txn.amount);
    }

    // Convert to array of objects sorted by month
    const result = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, categories]) => {
        const obj: Record<string, unknown> = { month };
        for (const [cat, amount] of categories.entries()) {
          obj[cat] = Number(amount.toFixed(2));
        }
        return obj;
      });

    return result;
  }, [filteredTransactions]);

  // Category spending totals (for pie chart)
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();

    for (const txn of filteredTransactions) {
      const category = getCategoryLabel(txn.category);
      totals.set(category, (totals.get(category) ?? 0) + txn.amount);
    }

    return Array.from(totals.entries())
      .map(([name, value]) => ({
        name,
        value: Number(value.toFixed(2)),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 categories
  }, [filteredTransactions]);

  // Top merchants
  const topMerchants = useMemo(() => {
    const merchants = new Map<string, number>();

    for (const txn of filteredTransactions) {
      // Only include transactions with an actual merchant name
      if (!txn.merchantName) continue;
      merchants.set(txn.merchantName, (merchants.get(txn.merchantName) ?? 0) + txn.amount);
    }

    return Array.from(merchants.entries())
      .map(([name, total]) => ({
        name,
        total: Number(total.toFixed(2)),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // Top 10 merchants
  }, [filteredTransactions]);

  // Key metrics
  const metrics = useMemo(() => {
    const totalSpending = filteredTransactions.reduce(
      (sum, txn) => sum + txn.amount,
      0
    );
    const avgMonthly =
      monthlyByCategory.length > 0
        ? totalSpending / monthlyByCategory.length
        : 0;

    // Calculate month-over-month change
    let momChange = 0;
    if (monthlyByCategory.length >= 2) {
      const lastMonth = Object.values(monthlyByCategory[monthlyByCategory.length - 1])
        .slice(1) // Skip month key
        .reduce((sum: number, val: any) => sum + (typeof val === "number" ? val : 0), 0);
      const prevMonth = Object.values(monthlyByCategory[monthlyByCategory.length - 2])
        .slice(1)
        .reduce((sum: number, val: any) => sum + (typeof val === "number" ? val : 0), 0);

      if (prevMonth > 0) {
        momChange = ((lastMonth - prevMonth) / prevMonth) * 100;
      }
    }

    // Calculate year-over-year change if applicable
    let yoyChange = 0;
    if (dateRange === "all" && monthlyByCategory.length >= 13) {
      const currentYear = monthlyByCategory.slice(-12);
      const previousYear = monthlyByCategory.slice(-24, -12);

      if (currentYear.length === 12 && previousYear.length === 12) {
        const currentYearTotal = currentYear
          .reduce((sum: number, month: any) => {
            const monthTotal = Object.values(month)
              .slice(1)
              .reduce((s: number, v: any) => s + (typeof v === "number" ? v : 0), 0);
            return sum + monthTotal;
          }, 0);

        const previousYearTotal = previousYear
          .reduce((sum: number, month: any) => {
            const monthTotal = Object.values(month)
              .slice(1)
              .reduce((s: number, v: any) => s + (typeof v === "number" ? v : 0), 0);
            return sum + monthTotal;
          }, 0);

        if (previousYearTotal > 0) {
          yoyChange = ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100;
        }
      }
    }

    return {
      totalSpending: Number(totalSpending.toFixed(2)),
      avgMonthly: Number(avgMonthly.toFixed(2)),
      momChange: Number(momChange.toFixed(1)),
      yoyChange: Number(yoyChange.toFixed(1)),
      transactionCount: filteredTransactions.length,
    };
  }, [filteredTransactions, monthlyByCategory, dateRange]);

  // Prepare line chart data (monthly trend by top category)
  const lineChartData = useMemo(() => {
    if (monthlyByCategory.length === 0) return [];

    // Get the top 3 categories
    const topCats = categoryTotals.slice(0, 3).map((c) => c.name);

    return monthlyByCategory.map((month) => {
      const monthKey = (month as any).month;
      const obj: Record<string, any> = {
        month: formatMonthDisplay(monthKey),
      };
      for (const cat of topCats) {
        obj[cat] = (month as any)[cat] ?? 0;
      }
      return obj;
    });
  }, [monthlyByCategory, categoryTotals]);

  // Prepare bar chart data (monthly total spending)
  const barChartData = useMemo(() => {
    return monthlyByCategory.map((month) => {
      const total = Object.values(month)
        .slice(1)
        .reduce((sum: number, val: any) => sum + (typeof val === "number" ? val : 0), 0);
      return {
        month: formatMonthDisplay((month as any).month),
        total: Number(total.toFixed(2)),
      };
    });
  }, [monthlyByCategory]);

  if (filteredTransactions.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Spending trends and insights over time
        </p>

        <div className="mt-8 glass rounded-xl p-12 text-center">
          <h2 className="text-xl font-semibold text-foreground">
            No data available
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your filters or expanding the date range.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Spending trends and insights over time
        </p>
      </div>

      {/* Filter bar */}
      <div className="glass rounded-xl p-4 mb-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Date range */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Date Range
            </label>
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3mo">Last 3 months</SelectItem>
                <SelectItem value="6mo">Last 6 months</SelectItem>
                <SelectItem value="1yr">Last year</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category filter */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Category
            </label>
            <Select
              value={selectedCategory}
              onValueChange={(val) => setSelectedCategory(val ?? "all")}
            >
              <SelectTrigger>
                <SelectValue />
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
          </div>

          {/* Account filter */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Account
            </label>
            <Select
              value={selectedAccount}
              onValueChange={(val) => setSelectedAccount(val ?? "all")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Spending */}
        <div className="glass rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Total Spending
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {formatCurrency(metrics.totalSpending)}
          </p>
        </div>

        {/* Average Monthly */}
        <div className="glass rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Average Monthly
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {formatCurrency(metrics.avgMonthly)}
          </p>
        </div>

        {/* Month-over-Month */}
        <div className="glass rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Month-over-Month
          </p>
          <p
            className={`mt-2 text-2xl font-bold ${
              metrics.momChange > 0
                ? "text-red-400"
                : metrics.momChange < 0
                  ? "text-emerald-400"
                  : "text-foreground"
            }`}
          >
            {metrics.momChange > 0 ? "+" : ""}
            {metrics.momChange.toFixed(1)}%
          </p>
        </div>

        {/* Transactions Count */}
        <div className="glass rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Transactions
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {metrics.transactionCount}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Line Chart: Category Trends */}
        {lineChartData.length > 0 && (
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Spending Trends
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                  }}
                  formatter={(value: any) => formatCurrency(Number(value))}
                />
                <Legend />
                {categoryTotals.slice(0, 3).map((cat, idx) => (
                  <Line
                    key={cat.name}
                    type="monotone"
                    dataKey={cat.name}
                    stroke={COLORS[idx % COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pie Chart: Top 5 Categories */}
        {categoryTotals.length > 0 && (() => {
          const pieTotal = categoryTotals.reduce((sum, c) => sum + c.value, 0);
          return (
            <div className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Top Categories
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryTotals}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                  >
                    {categoryTotals.map((_, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={COLORS[idx % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => formatCurrency(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {categoryTotals.map((cat, idx) => (
                  <div key={cat.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="truncate text-foreground">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-muted-foreground">
                        {pieTotal > 0 ? ((cat.value / pieTotal) * 100).toFixed(1) : 0}%
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(cat.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Bar Chart: Monthly Spending */}
        {barChartData.length > 0 && (
          <div className="glass rounded-xl p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Monthly Spending
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                  }}
                  formatter={(value: any) => formatCurrency(Number(value))}
                />
                <Bar dataKey="total" fill={COLORS[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Merchants */}
        {topMerchants.length > 0 && (
          <div className="glass rounded-xl p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Top Merchants
            </h2>
            <div className="space-y-3">
              {topMerchants.map((merchant, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg bg-accent/30 p-3"
                >
                  <p className="truncate text-sm font-medium text-foreground">
                    {merchant.name}
                  </p>
                  <Badge variant="secondary" className="shrink-0">
                    {formatCurrency(merchant.total)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
