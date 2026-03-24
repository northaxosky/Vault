"use client";

import { useEffect, useState } from "react";

interface DebtItem {
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
}

interface DebtSummaryData {
  debts: DebtItem[];
  totalDebt: number;
  averageRate: number;
  totalMinPayment: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DebtSummaryCard() {
  const [data, setData] = useState<DebtSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/widgets/debt-summary")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load debt summary");
        return res.json();
      })
      .then((result) => setData(result))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-4" />
        <div className="h-8 w-40 bg-muted rounded mb-2" />
        <div className="flex gap-4 mb-4">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 bg-muted rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Debt Summary
        </h3>
        <p className="text-sm text-muted-foreground">
          Unable to load debt summary
        </p>
      </div>
    );
  }

  if (!data || data.debts.length === 0) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Debt Summary
        </h3>
        <p className="text-sm text-muted-foreground">
          No debts tracked. Add one in Debt Payoff.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Debt Summary
      </h3>

      <p className="text-2xl font-bold text-foreground mb-1">
        {formatCurrency(data.totalDebt)}
      </p>

      <div className="flex gap-4 text-xs text-muted-foreground mb-4">
        <span>Avg Rate: {data.averageRate.toFixed(2)}%</span>
        <span>Min Payment: {formatCurrency(data.totalMinPayment)}/mo</span>
      </div>

      <div className="space-y-2">
        {data.debts.map((debt) => (
          <div
            key={debt.name}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-foreground truncate flex-1">
              {debt.name}
            </span>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-2">
              {debt.interestRate.toFixed(1)}%
            </span>
            <span className="text-foreground font-medium tabular-nums ml-3 w-20 text-right">
              {formatCurrency(debt.balance)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
