"use client";

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Landmark,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/categories";

// --- Types ---

interface HoldingData {
  id: string;
  quantity: number;
  costBasis: number | null;
  currentValue: number | null;
  currency: string;
  securityName: string | null;
  ticker: string | null;
  securityType: string | null;
}

interface AccountGroup {
  accountId: string;
  accountName: string;
  institutionName: string | null;
  holdings: HoldingData[];
}

interface SummaryData {
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  gainLossPercent: number;
}

interface InvestmentsClientProps {
  accounts: AccountGroup[];
  summary: SummaryData;
}

// --- Helpers ---

/** Format security type for display: "mutual fund" → "Mutual Fund" */
function formatType(type: string): string {
  return type
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// --- Component ---

export default function InvestmentsClient({
  accounts,
  summary,
}: InvestmentsClientProps) {
  // Empty state — no holdings synced
  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground">Investments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your investment holdings
        </p>

        <div className="mt-8 glass rounded-xl p-12 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            No investment holdings
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Link an investment account from the Dashboard, then sync to see your
            holdings here.
          </p>
        </div>
      </div>
    );
  }

  const isGain = summary.totalGainLoss >= 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">Investments</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your investment holdings
      </p>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Portfolio Value */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Portfolio Value</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {formatCurrency(summary.totalValue)}
              </p>
            </div>
          </div>
        </div>

        {/* Cost Basis */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost Basis</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {formatCurrency(summary.totalCostBasis)}
              </p>
            </div>
          </div>
        </div>

        {/* Total Gain/Loss */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              {isGain ? (
                <TrendingUp className="h-5 w-5 text-primary" />
              ) : (
                <TrendingDown className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Gain/Loss</p>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  isGain ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {isGain ? "+" : ""}
                {formatCurrency(summary.totalGainLoss)}
              </p>
              <p
                className={`text-xs ${
                  isGain ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {isGain ? "+" : ""}
                {summary.gainLossPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Holdings by account */}
      <div className="mt-8 space-y-4">
        {accounts.map((account) => {
          // Account-level totals
          let accountValue = 0;
          let accountCost = 0;
          for (const h of account.holdings) {
            if (h.currentValue !== null) accountValue += h.currentValue;
            if (h.costBasis !== null) accountCost += h.costBasis;
          }
          const accountGain = accountValue - accountCost;
          const accountGainIsPositive = accountGain >= 0;

          return (
            <div key={account.accountId} className="glass rounded-xl p-6">
              {/* Account header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Landmark className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {account.accountName}
                    </h3>
                    {account.institutionName && (
                      <p className="text-xs text-muted-foreground">
                        {account.institutionName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(accountValue)}
                  </p>
                  <p
                    className={`text-xs tabular-nums ${
                      accountGainIsPositive
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {accountGainIsPositive ? "+" : ""}
                    {formatCurrency(accountGain)}
                  </p>
                </div>
              </div>

              {/* Separator */}
              <div className="my-4 border-t border-border" />

              {/* Holdings table */}
              <div className="space-y-3">
                {account.holdings.map((holding) => {
                  const gainLoss =
                    holding.currentValue !== null && holding.costBasis !== null
                      ? holding.currentValue - holding.costBasis
                      : null;
                  const holdingIsGain = gainLoss !== null && gainLoss >= 0;

                  return (
                    <div
                      key={holding.id}
                      className="flex items-center justify-between gap-4"
                    >
                      {/* Left: security info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {holding.securityName || "Unknown Security"}
                          </p>
                          {holding.ticker && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {holding.ticker}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {holding.securityType && (
                            <span>{formatType(holding.securityType)}</span>
                          )}
                          {holding.securityType && (
                            <span className="text-border">|</span>
                          )}
                          <span>
                            {holding.quantity.toLocaleString("en-US", {
                              maximumFractionDigits: 4,
                            })}{" "}
                            shares
                          </span>
                        </div>
                      </div>

                      {/* Right: value + gain/loss */}
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          {holding.currentValue !== null
                            ? formatCurrency(
                                holding.currentValue,
                                holding.currency
                              )
                            : "—"}
                        </p>
                        {gainLoss !== null && (
                          <p
                            className={`text-xs tabular-nums ${
                              holdingIsGain
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {holdingIsGain ? "+" : ""}
                            {formatCurrency(gainLoss, holding.currency)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
