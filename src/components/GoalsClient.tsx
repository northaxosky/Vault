"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  CalendarDays,
  TrendingDown,
  TrendingUp,
  Percent,
  ArrowDown,
  Landmark,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatFrequency } from "@/lib/categories";
import { calculateSnowball, calculateAvalanche } from "@/lib/debt";
import type { DebtInput } from "@/lib/debt";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

// --- Types ---

interface GoalData {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  linkedAccountId: string | null;
  linkedAccountName: string | null;
}

interface DebtData {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  linkedAccountId: string | null;
  linkedAccountName: string | null;
}

interface StreamData {
  averageAmount: number;
  frequency: string;
  predictedNextDate: string | null;
  streamType: string;
  merchantName: string | null;
  description: string | null;
  currency: string;
}

interface AccountOption {
  id: string;
  name: string;
  type: string;
}

interface GoalsClientProps {
  goals: GoalData[];
  debts: DebtData[];
  currentBalance: number;
  recurringStreams: StreamData[];
  accounts: AccountOption[];
}

// --- Helpers ---

function daysUntil(isoDate: string): number {
  const now = new Date();
  const target = new Date(isoDate);
  return Math.ceil(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getProgressColor(pct: number, isPastDeadline: boolean): string {
  if (isPastDeadline && pct < 100) return "bg-red-500";
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 60) return "bg-primary";
  if (pct >= 30) return "bg-yellow-500";
  return "bg-red-500";
}

/** Project future balance based on recurring streams */
function buildForecast(
  startBalance: number,
  streams: StreamData[],
  days: number
): { date: string; balance: number }[] {
  const today = new Date();
  const points: { date: string; balance: number }[] = [];

  // Build a map of date -> net cash flow
  const dailyFlow = new Map<string, number>();

  for (const stream of streams) {
    if (!stream.predictedNextDate) continue;
    const predicted = new Date(stream.predictedNextDate);
    const isInflow = stream.streamType === "INFLOW";
    const amount = stream.averageAmount;

    // Get interval in days
    const intervalDays: Record<string, number> = {
      WEEKLY: 7,
      BIWEEKLY: 14,
      SEMI_MONTHLY: 15,
      MONTHLY: 30,
      ANNUALLY: 365,
    };
    const interval = intervalDays[stream.frequency] ?? 30;

    // Find first occurrence on or after today
    let cursor = new Date(predicted);
    // Go backward
    while (cursor > today) {
      cursor = new Date(cursor.getTime() - interval * 86400000);
    }
    // Go forward to first occurrence >= today
    while (cursor < today) {
      cursor = new Date(cursor.getTime() + interval * 86400000);
    }

    // Project occurrences within the horizon
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    while (cursor <= endDate) {
      const key = cursor.toISOString().slice(0, 10);
      const existing = dailyFlow.get(key) ?? 0;
      dailyFlow.set(key, existing + (isInflow ? amount : -amount));
      cursor = new Date(cursor.getTime() + interval * 86400000);
    }
  }

  // Build cumulative balance over the horizon
  let runningBalance = startBalance;
  for (let d = 0; d <= days; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    const key = date.toISOString().slice(0, 10);
    const flow = dailyFlow.get(key) ?? 0;
    runningBalance += flow;
    // Only include every other day for 90 days, every day for 30
    if (days <= 30 || d % 2 === 0 || d === days) {
      points.push({ date: key, balance: Math.round(runningBalance * 100) / 100 });
    }
  }

  return points;
}

// --- Goal Form Dialog ---

function GoalDialog({
  goal,
  accounts,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  goal?: GoalData;
  accounts: AccountOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    deadline: string | null;
    linkedAccountId: string | null;
  }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(
    goal?.targetAmount.toString() ?? ""
  );
  const [currentAmount, setCurrentAmount] = useState(
    goal?.currentAmount.toString() ?? "0"
  );
  const [deadline, setDeadline] = useState(
    goal?.deadline ? goal.deadline.slice(0, 10) : ""
  );
  const [linkedAccountId, setLinkedAccountId] = useState(
    goal?.linkedAccountId ?? "none"
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      name,
      targetAmount: Number(targetAmount),
      currentAmount: goal ? Number(currentAmount) : undefined,
      deadline: deadline || null,
      linkedAccountId: linkedAccountId === "none" ? null : linkedAccountId,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit Goal" : "New Savings Goal"}</DialogTitle>
          <DialogDescription>
            {goal
              ? "Update your savings goal details."
              : "Set a target to start tracking your progress."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              placeholder="e.g., Emergency Fund"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="goal-target">Target Amount</Label>
              <Input
                id="goal-target"
                type="number"
                min="1"
                step="0.01"
                placeholder="10000"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
              />
            </div>
            {goal && !goal.linkedAccountId && (
              <div>
                <Label htmlFor="goal-current">Current Amount</Label>
                <Input
                  id="goal-current"
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                />
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="goal-deadline">Deadline (optional)</Label>
            <Input
              id="goal-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="goal-account">Link to Account (optional)</Label>
            <Select
              value={linkedAccountId}
              onValueChange={(val) => setLinkedAccountId(val ?? "none")}
            >
              <SelectTrigger id="goal-account">
                <SelectValue placeholder="No linked account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked account</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : goal ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Debt Form Dialog ---

function DebtDialog({
  debt,
  accounts,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  debt?: DebtData;
  accounts: AccountOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    name: string;
    balance: number;
    interestRate: number;
    minimumPayment: number;
    linkedAccountId: string | null;
  }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(debt?.name ?? "");
  const [balance, setBalance] = useState(debt?.balance.toString() ?? "");
  const [interestRate, setInterestRate] = useState(
    debt?.interestRate.toString() ?? ""
  );
  const [minimumPayment, setMinimumPayment] = useState(
    debt?.minimumPayment.toString() ?? ""
  );
  const [linkedAccountId, setLinkedAccountId] = useState(
    debt?.linkedAccountId ?? "none"
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      name,
      balance: Number(balance),
      interestRate: Number(interestRate),
      minimumPayment: Number(minimumPayment),
      linkedAccountId: linkedAccountId === "none" ? null : linkedAccountId,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{debt ? "Edit Debt" : "Add Debt Account"}</DialogTitle>
          <DialogDescription>
            {debt
              ? "Update your debt details."
              : "Track a debt to see payoff projections."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="debt-name">Name</Label>
            <Input
              id="debt-name"
              placeholder="e.g., Chase Visa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="debt-balance">Balance</Label>
              <Input
                id="debt-balance"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="5000"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="debt-rate">Interest Rate (%)</Label>
              <Input
                id="debt-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="19.99"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="debt-minpay">Minimum Payment</Label>
            <Input
              id="debt-minpay"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="100"
              value={minimumPayment}
              onChange={(e) => setMinimumPayment(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="debt-account">Link to Account (optional)</Label>
            <Select
              value={linkedAccountId}
              onValueChange={(val) => setLinkedAccountId(val ?? "none")}
            >
              <SelectTrigger id="debt-account">
                <SelectValue placeholder="No linked account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked account</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : debt ? "Update" : "Add Debt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Component ---

export default function GoalsClient({
  goals: initialGoals,
  debts: initialDebts,
  currentBalance,
  recurringStreams,
  accounts,
}: GoalsClientProps) {
  const router = useRouter();
  const [goals, setGoals] = useState(initialGoals);
  const [debts, setDebts] = useState(initialDebts);
  const [saving, setSaving] = useState(false);

  // Goal dialogs
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalData | undefined>();

  // Debt dialogs
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtData | undefined>();

  // Debt payoff
  const [extraPayment, setExtraPayment] = useState(0);

  // Cash flow forecast
  const [forecastDays, setForecastDays] = useState(30);

  // --- Goals CRUD ---

  async function handleSaveGoal(data: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    deadline: string | null;
    linkedAccountId: string | null;
  }) {
    setSaving(true);
    try {
      if (editingGoal) {
        const res = await fetch("/api/goals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingGoal.id, ...data }),
        });
        if (res.ok) {
          const { goal } = await res.json();
          setGoals((prev) =>
            prev.map((g) =>
              g.id === editingGoal.id
                ? { ...g, ...goal, linkedAccountName: g.linkedAccountName }
                : g
            )
          );
        }
      } else {
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const { goal } = await res.json();
          setGoals((prev) => [
            { ...goal, linkedAccountName: null },
            ...prev,
          ]);
        }
      }
      setGoalDialogOpen(false);
      setEditingGoal(undefined);
      router.refresh();
    } catch {
      // User can retry
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGoal(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setGoals((prev) => prev.filter((g) => g.id !== id));
        router.refresh();
      }
    } catch {
      // User can retry
    } finally {
      setSaving(false);
    }
  }

  // --- Debts CRUD ---

  async function handleSaveDebt(data: {
    name: string;
    balance: number;
    interestRate: number;
    minimumPayment: number;
    linkedAccountId: string | null;
  }) {
    setSaving(true);
    try {
      if (editingDebt) {
        const res = await fetch("/api/debts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingDebt.id, ...data }),
        });
        if (res.ok) {
          const { debt } = await res.json();
          setDebts((prev) =>
            prev.map((d) =>
              d.id === editingDebt.id
                ? { ...d, ...debt, linkedAccountName: d.linkedAccountName }
                : d
            )
          );
        }
      } else {
        const res = await fetch("/api/debts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const { debt } = await res.json();
          setDebts((prev) => [
            { ...debt, linkedAccountName: null },
            ...prev,
          ]);
        }
      }
      setDebtDialogOpen(false);
      setEditingDebt(undefined);
      router.refresh();
    } catch {
      // User can retry
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDebt(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/debts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setDebts((prev) => prev.filter((d) => d.id !== id));
        router.refresh();
      }
    } catch {
      // User can retry
    } finally {
      setSaving(false);
    }
  }

  // --- Goals summaries ---

  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const activeGoals = goals.length;
  const nextDeadline = useMemo(() => {
    const upcoming = goals
      .filter((g) => g.deadline && daysUntil(g.deadline) > 0)
      .sort(
        (a, b) =>
          new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
      );
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [goals]);

  // --- Debt summaries ---

  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinimums = debts.reduce((sum, d) => sum + d.minimumPayment, 0);
  const weightedAvgRate = useMemo(() => {
    if (totalDebt === 0) return 0;
    const weightedSum = debts.reduce(
      (sum, d) => sum + d.interestRate * d.balance,
      0
    );
    return weightedSum / totalDebt;
  }, [debts, totalDebt]);

  // --- Debt payoff calculations ---

  const debtInputs: DebtInput[] = debts.map((d) => ({
    name: d.name,
    balance: d.balance,
    interestRate: d.interestRate,
    minimumPayment: d.minimumPayment,
  }));

  const snowballResult = useMemo(
    () => calculateSnowball(debtInputs, extraPayment),
    [debtInputs, extraPayment]
  );
  const avalancheResult = useMemo(
    () => calculateAvalanche(debtInputs, extraPayment),
    [debtInputs, extraPayment]
  );

  // --- Cash flow forecast ---

  const forecastData = useMemo(
    () => buildForecast(currentBalance, recurringStreams, forecastDays),
    [currentBalance, recurringStreams, forecastDays]
  );

  const lowestPoint = useMemo(() => {
    if (forecastData.length === 0) return null;
    return forecastData.reduce((min, p) =>
      p.balance < min.balance ? p : min
    );
  }, [forecastData]);

  const forecastIncome = useMemo(() => {
    return recurringStreams
      .filter((s) => s.streamType === "INFLOW")
      .reduce((sum, s) => {
        const factor =
          forecastDays <= 30
            ? 1
            : forecastDays <= 60
            ? 2
            : 3;
        return sum + s.averageAmount * factor;
      }, 0);
  }, [recurringStreams, forecastDays]);

  const forecastExpenses = useMemo(() => {
    return recurringStreams
      .filter((s) => s.streamType === "OUTFLOW")
      .reduce((sum, s) => {
        const factor =
          forecastDays <= 30
            ? 1
            : forecastDays <= 60
            ? 2
            : 3;
        return sum + s.averageAmount * factor;
      }, 0);
  }, [recurringStreams, forecastDays]);

  const upcomingStreams = useMemo(() => {
    return recurringStreams
      .filter((s) => s.predictedNextDate)
      .sort(
        (a, b) =>
          new Date(a.predictedNextDate!).getTime() -
          new Date(b.predictedNextDate!).getTime()
      )
      .slice(0, 10);
  }, [recurringStreams]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">Goals & Planning</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Track savings, manage debt, and forecast your cash flow
      </p>

      {/* Tabs */}
      <Tabs defaultValue="savings" className="mt-6">
        <TabsList>
          <TabsTrigger value="savings">Savings Goals</TabsTrigger>
          <TabsTrigger value="debt">Debt Payoff</TabsTrigger>
          <TabsTrigger value="forecast">Cash Flow</TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: SAVINGS GOALS ===== */}
        <TabsContent value="savings">
          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Saved</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {formatCurrency(totalSaved)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of {formatCurrency(totalTarget)} target
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Goals</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {activeGoals}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    goal{activeGoals !== 1 ? "s" : ""} in progress
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Next Deadline</p>
                  <p className="text-lg font-bold text-foreground">
                    {nextDeadline?.deadline
                      ? formatDate(nextDeadline.deadline)
                      : "None set"}
                  </p>
                  {nextDeadline?.deadline && (
                    <p className="text-xs text-muted-foreground">
                      {daysUntil(nextDeadline.deadline)} days — {nextDeadline.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Add goal button */}
          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => {
                setEditingGoal(undefined);
                setGoalDialogOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Goal
            </Button>
          </div>

          {/* Goal cards */}
          {goals.length === 0 ? (
            <div className="mt-4 glass rounded-xl p-12 text-center">
              <Target className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold text-foreground">
                No savings goals yet
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first goal to start tracking progress.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {goals.map((goal) => {
                const pct = Math.min(
                  (goal.currentAmount / goal.targetAmount) * 100,
                  100
                );
                const isPastDeadline =
                  goal.deadline != null && daysUntil(goal.deadline) < 0;
                const progressColor = getProgressColor(pct, isPastDeadline);

                return (
                  <div key={goal.id} className="glass rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-lg bg-primary/10 p-2.5">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-foreground truncate">
                            {goal.name}
                          </h3>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingGoal(goal);
                                setGoalDialogOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteGoal(goal.id)}
                              disabled={saving}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${progressColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="tabular-nums text-foreground">
                            {formatCurrency(goal.currentAmount)}{" "}
                            <span className="text-muted-foreground">
                              / {formatCurrency(goal.targetAmount)}
                            </span>
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {pct.toFixed(0)}%
                          </span>
                        </div>

                        {/* Meta info */}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {goal.deadline && (
                            <span>
                              {isPastDeadline
                                ? `Past deadline (${formatDate(goal.deadline)})`
                                : `${daysUntil(goal.deadline)} days left`}
                            </span>
                          )}
                          {goal.linkedAccountName && (
                            <span>Linked: {goal.linkedAccountName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Goal dialog */}
          <GoalDialog
            goal={editingGoal}
            accounts={accounts}
            open={goalDialogOpen}
            onOpenChange={(open) => {
              setGoalDialogOpen(open);
              if (!open) setEditingGoal(undefined);
            }}
            onSave={handleSaveGoal}
            saving={saving}
          />
        </TabsContent>

        {/* ===== TAB 2: DEBT PAYOFF ===== */}
        <TabsContent value="debt">
          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-500/10 p-2.5">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Debt</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {formatCurrency(totalDebt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Minimums
                  </p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {formatCurrency(totalMinimums)}
                  </p>
                  <p className="text-xs text-muted-foreground">per month</p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Percent className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Weighted Avg Rate
                  </p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {weightedAvgRate.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Add debt button */}
          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => {
                setEditingDebt(undefined);
                setDebtDialogOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Debt
            </Button>
          </div>

          {/* Debt cards */}
          {debts.length === 0 ? (
            <div className="mt-4 glass rounded-xl p-12 text-center">
              <TrendingDown className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold text-foreground">
                No debts tracked
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your debts to see payoff projections and strategies.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-3">
                {debts.map((debt) => (
                  <div key={debt.id} className="glass rounded-xl p-5">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 rounded-lg bg-red-500/10 p-2.5">
                        <TrendingDown className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-foreground truncate">
                            {debt.name}
                          </h3>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingDebt(debt);
                                setDebtDialogOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDebt(debt.id)}
                              disabled={saving}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <span className="tabular-nums text-foreground font-semibold">
                            {formatCurrency(debt.balance)}
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {debt.interestRate}% APR
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {formatCurrency(debt.minimumPayment)}/mo min
                          </span>
                        </div>
                        {debt.linkedAccountName && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Linked: {debt.linkedAccountName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Strategy comparison */}
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">
                  Payoff Strategy Comparison
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  See how extra payments affect your debt-free date
                </p>

                <div className="mt-4 glass rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <Label
                      htmlFor="extra-payment"
                      className="text-sm whitespace-nowrap"
                    >
                      Extra monthly payment:
                    </Label>
                    <Input
                      id="extra-payment"
                      type="number"
                      min="0"
                      step="25"
                      value={extraPayment}
                      onChange={(e) =>
                        setExtraPayment(Math.max(0, Number(e.target.value)))
                      }
                      className="w-32"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Snowball */}
                  <div className="glass rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ArrowDown className="h-5 w-5 text-blue-400" />
                      <h3 className="font-semibold text-foreground">
                        Snowball
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Pay smallest balance first — quick wins for motivation
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Months to payoff
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {snowballResult.totalMonths}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Total interest
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatCurrency(snowballResult.totalInterestPaid)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Debt-free date
                        </span>
                        <span className="font-semibold text-foreground">
                          {snowballResult.debtFreeDate.toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Avalanche */}
                  <div className="glass rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-5 w-5 text-emerald-400" />
                      <h3 className="font-semibold text-foreground">
                        Avalanche
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Pay highest interest first — saves the most money
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Months to payoff
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {avalancheResult.totalMonths}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Total interest
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatCurrency(avalancheResult.totalInterestPaid)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Debt-free date
                        </span>
                        <span className="font-semibold text-foreground">
                          {avalancheResult.debtFreeDate.toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </div>
                    </div>

                    {avalancheResult.totalInterestPaid <
                      snowballResult.totalInterestPaid && (
                      <div className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                        Saves{" "}
                        {formatCurrency(
                          snowballResult.totalInterestPaid -
                            avalancheResult.totalInterestPaid
                        )}{" "}
                        in interest vs. Snowball
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Debt dialog */}
          <DebtDialog
            debt={editingDebt}
            accounts={accounts}
            open={debtDialogOpen}
            onOpenChange={(open) => {
              setDebtDialogOpen(open);
              if (!open) setEditingDebt(undefined);
            }}
            onSave={handleSaveDebt}
            saving={saving}
          />
        </TabsContent>

        {/* ===== TAB 3: CASH FLOW FORECAST ===== */}
        <TabsContent value="forecast">
          {/* Time horizon */}
          <div className="mt-6 flex items-center gap-2">
            {[
              { days: 30, label: "30 Days" },
              { days: 60, label: "60 Days" },
              { days: 90, label: "90 Days" },
            ].map((opt) => (
              <button
                key={opt.days}
                onClick={() => setForecastDays(opt.days)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  forecastDays === opt.days
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Forecast chart */}
          <div className="mt-4 glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Projected Balance
            </h2>
            <p className="text-sm text-muted-foreground">
              Based on your recurring income and expenses
            </p>

            <div className="mt-4">
              {forecastData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No recurring streams to project from
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={forecastData}>
                    <defs>
                      <linearGradient
                        id="gradient-forecast"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--chart-3)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--chart-3)"
                          stopOpacity={0}
                        />
                      </linearGradient>
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
                      stroke="var(--foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        "Projected Balance",
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
                    <ReferenceLine
                      y={0}
                      stroke="var(--destructive)"
                      strokeDasharray="3 3"
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      fill="url(#gradient-forecast)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Summary cards */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground">Lowest Balance</p>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  lowestPoint && lowestPoint.balance < 0
                    ? "text-red-400"
                    : "text-foreground"
                }`}
              >
                {lowestPoint ? formatCurrency(lowestPoint.balance) : "—"}
              </p>
              {lowestPoint && (
                <p className="text-xs text-muted-foreground">
                  on {formatDate(lowestPoint.date)}
                </p>
              )}
            </div>

            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground">Expected Income</p>
              <p className="text-2xl font-bold text-emerald-400 tabular-nums">
                {formatCurrency(forecastIncome)}
              </p>
              <p className="text-xs text-muted-foreground">
                next {forecastDays} days
              </p>
            </div>

            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground">Expected Expenses</p>
              <p className="text-2xl font-bold text-red-400 tabular-nums">
                {formatCurrency(forecastExpenses)}
              </p>
              <p className="text-xs text-muted-foreground">
                next {forecastDays} days
              </p>
            </div>
          </div>

          {/* Upcoming recurring */}
          {upcomingStreams.length > 0 && (
            <div className="mt-6 glass rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Upcoming Recurring
              </h2>
              <div className="mt-3 divide-y divide-border">
                {upcomingStreams.map((stream, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {stream.merchantName || stream.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stream.predictedNextDate &&
                          formatDate(stream.predictedNextDate)}
                        <span className="mx-1.5">·</span>
                        {formatFrequency(stream.frequency)}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        stream.streamType === "INFLOW"
                          ? "text-emerald-400"
                          : "text-foreground"
                      }`}
                    >
                      {stream.streamType === "INFLOW" ? "+" : "-"}
                      {formatCurrency(stream.averageAmount, stream.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
