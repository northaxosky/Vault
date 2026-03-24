"use client";

import { useEffect, useState } from "react";

interface SavingsGoal {
  name: string;
  target: number;
  current: number;
  percentage: number;
  deadline: string | null;
}

function getProgressColor(percentage: number): string {
  if (percentage >= 75) return "#22c55e";
  if (percentage >= 50) return "#f59e0b";
  return "var(--color-primary)";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDeadline(deadline: string): { label: string; overdue: boolean } {
  const date = new Date(deadline);
  const now = new Date();
  const overdue = date < now;
  const label = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return { label, overdue };
}

export default function SavingsGoalsCard() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/widgets/savings-goals")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load savings goals");
        return res.json();
      })
      .then((data) => setGoals(data.goals))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-4" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="h-3 w-24 bg-muted rounded mb-2" />
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
          Savings Goals
        </h3>
        <p className="text-sm text-muted-foreground">
          Unable to load savings goals
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Savings Goals
      </h3>

      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No savings goals set. Create one in Goals.
        </p>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const color = getProgressColor(goal.percentage);
            const deadline = goal.deadline
              ? formatDeadline(goal.deadline)
              : null;

            return (
              <div key={goal.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {goal.name}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {goal.percentage}%
                  </span>
                </div>

                <div className="h-2 rounded-full bg-muted/30">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${goal.percentage}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(goal.target)}
                  </span>
                  {deadline && (
                    <span
                      className={`text-xs ${deadline.overdue ? "text-red-500" : "text-muted-foreground"}`}
                    >
                      {deadline.overdue ? "Overdue · " : ""}
                      {deadline.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
