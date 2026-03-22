"use client";

import { useMemo, useState } from "react";
import {
  Landmark,
  Wallet,
  CreditCard,
  TrendingUp,
  CircleDot,
  Receipt,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/categories";

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
  transactionCount: number;
}

interface InstitutionData {
  id: string;
  institutionName: string | null;
  createdAt: string;
  accounts: AccountData[];
}

interface AccountsClientProps {
  institutions: InstitutionData[];
}

// --- Account type config ---

const TYPE_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
  depository: { label: "Depository", icon: Wallet },
  credit: { label: "Credit", icon: CreditCard },
  investment: { label: "Investment", icon: TrendingUp },
};

function getTypeIcon(type: string): LucideIcon {
  return TYPE_CONFIG[type]?.icon ?? CircleDot;
}

// --- Helpers ---

/** Format subtype for display: "money market" → "Money Market" */
function formatSubtype(subtype: string): string {
  return subtype
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// --- Component ---

export default function AccountsClient({
  institutions,
}: AccountsClientProps) {
  const [typeFilter, setTypeFilter] = useState("all");

  // Collect all unique account types for the filter buttons
  const accountTypes = useMemo(() => {
    const types = new Set<string>();
    for (const inst of institutions) {
      for (const acc of inst.accounts) {
        types.add(acc.type);
      }
    }
    return Array.from(types).sort();
  }, [institutions]);

  // Filter institutions and their accounts by type.
  // We keep the institution structure but filter the nested accounts,
  // then exclude institutions that have no matching accounts.
  const filtered = useMemo(() => {
    if (typeFilter === "all") return institutions;

    return institutions
      .map((inst) => ({
        ...inst,
        accounts: inst.accounts.filter((acc) => acc.type === typeFilter),
      }))
      .filter((inst) => inst.accounts.length > 0);
  }, [institutions, typeFilter]);

  // Summary stats
  const totalAccounts = institutions.reduce(
    (sum, inst) => sum + inst.accounts.length,
    0
  );

  // Empty state — no linked accounts
  if (institutions.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your linked bank accounts
        </p>

        <div className="mt-8 glass rounded-xl p-12 text-center">
          <Landmark className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            No accounts linked
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Link a bank account from the Dashboard to see your accounts here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your linked bank accounts
      </p>

      {/* Summary + Filter bar */}
      <div className="mt-6 glass rounded-xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {totalAccounts} account{totalAccounts !== 1 ? "s" : ""} across{" "}
            {institutions.length} institution
            {institutions.length !== 1 ? "s" : ""}
          </p>

          {/* Type filter buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              All
            </button>
            {accountTypes.map((type) => {
              const config = TYPE_CONFIG[type];
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    typeFilter === type
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  {config?.label ?? type}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Institution cards */}
      <div className="mt-6 space-y-4">
        {filtered.map((institution) => (
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
                {new Date(institution.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            {/* Separator */}
            <div className="my-4 border-t border-border" />

            {/* Account rows */}
            <div className="space-y-3">
              {institution.accounts.map((account) => {
                const Icon = getTypeIcon(account.type);
                return (
                  <div
                    key={account.id}
                    className="flex items-start justify-between gap-4"
                  >
                    {/* Left: icon + name + details */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="shrink-0 rounded-lg bg-primary/10 p-2 mt-0.5">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {account.name}
                        </p>
                        {account.officialName &&
                          account.officialName !== account.name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {account.officialName}
                            </p>
                          )}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {account.subtype && (
                            <Badge variant="secondary" className="text-xs">
                              {formatSubtype(account.subtype)}
                            </Badge>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Receipt className="h-3 w-3" />
                            {account.transactionCount} transaction
                            {account.transactionCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: balances */}
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {account.currentBalance !== null
                          ? formatCurrency(
                              account.currentBalance,
                              account.currency
                            )
                          : "—"}
                      </p>
                      {account.availableBalance !== null &&
                        account.availableBalance !== account.currentBalance && (
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatCurrency(
                              account.availableBalance,
                              account.currency
                            )}{" "}
                            available
                          </p>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
