"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";

interface Bill {
  name: string;
  amount: number;
  date: string;
  frequency: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatRelativeDate(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return `in ${diffDays} days`;

  return target.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function UpcomingBillsCard() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/widgets/upcoming-bills")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load upcoming bills");
        return res.json();
      })
      .then((data) => setBills(data.bills))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 animate-pulse">
        <div className="h-4 w-36 bg-muted rounded mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 bg-muted rounded-lg shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
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
          Upcoming Bills
        </h3>
        <p className="text-sm text-muted-foreground">
          Unable to load upcoming bills
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Upcoming Bills
      </h3>

      {bills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No upcoming bills in the next 2 weeks
        </p>
      ) : (
        <div className="space-y-3">
          {bills.map((bill, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {bill.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeDate(bill.date)} · {bill.frequency.toLowerCase()}
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums text-foreground">
                {formatCurrency(bill.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
