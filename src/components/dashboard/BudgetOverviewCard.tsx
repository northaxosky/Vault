"use client";

import { useEffect, useState } from "react";

interface BudgetItem {
  category: string;
  label: string;
  spent: number;
  limit: number;
  percentage: number;
}

function getProgressColor(percentage: number): string {
  if (percentage > 100) return "#ef4444";
  if (percentage >= 75) return "#f59e0b";
  return "#22c55e";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function BudgetOverviewCard() {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/widgets/budget-overview")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load budget overview");
        return res.json();
      })
      .then((data) => setBudgets(data.budgets))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 animate-pulse">
        <div className="h-4 w-36 bg-muted rounded mb-4" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-2 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Budget Overview
        </h3>
        <p className="text-sm text-muted-foreground">
          Unable to load budget data
        </p>
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Budget Overview
        </h3>
        <p className="text-sm text-muted-foreground">
          No budgets set. Create one in Budgets.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Budget Overview
      </h3>
      <div className="space-y-4">
        {budgets.map((budget) => {
          const color = getProgressColor(budget.percentage);
          return (
            <div key={budget.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{budget.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {budget.percentage}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/30">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(budget.percentage, 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
