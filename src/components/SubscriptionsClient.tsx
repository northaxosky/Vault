"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Repeat,
  DollarSign,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  formatCurrency,
  formatFrequency,
  getCategoryIcon,
  getCategoryLabel,
} from "@/lib/categories";

// --- Types ---

interface StreamData {
  id: string;
  plaidStreamId: string;
  merchantName: string | null;
  description: string;
  category: string | null;
  subcategory: string | null;
  firstDate: string;
  lastDate: string;
  lastAmount: number;
  averageAmount: number;
  predictedNextDate: string | null;
  frequency: string;
  isActive: boolean;
  status: string;
  streamType: string;
  currency: string;
  cancelledByUser: boolean;
  cancelledAt: string | null;
  accountName: string;
}

interface SubscriptionsClientProps {
  streams: StreamData[];
}

// --- Helpers ---

function estimateMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "WEEKLY":
      return amount * (52 / 12);
    case "BIWEEKLY":
      return amount * (26 / 12);
    case "SEMI_MONTHLY":
      return amount * 2;
    case "MONTHLY":
      return amount;
    case "ANNUALLY":
      return amount / 12;
    default:
      return amount;
  }
}

function getStreamStatus(
  stream: StreamData
): "active" | "cancelled" | "inactive" {
  if (stream.cancelledByUser) return "cancelled";
  if (!stream.isActive) return "inactive";
  return "active";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Build an array of day slots for a calendar month grid. null = blank cell. */
function buildCalendarDays(
  year: number,
  month: number
): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sunday

  const days: (Date | null)[] = [];

  for (let i = 0; i < startDow; i++) {
    days.push(null);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  return days;
}

/**
 * Project all occurrences of a recurring stream within a given month.
 * Uses the predicted next date as an anchor and steps forward/backward
 * by the frequency interval to find all dates in the month.
 */
function getStreamDatesInMonth(
  stream: StreamData,
  year: number,
  month: number
): Date[] {
  if (!stream.predictedNextDate) return [];

  const predicted = new Date(stream.predictedNextDate);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
  const dates: Date[] = [];

  // For monthly/semi-monthly, use calendar arithmetic instead of day counts
  if (stream.frequency === "MONTHLY") {
    // Try the predicted day-of-month in this month
    const dom = predicted.getDate();
    const candidate = new Date(year, month, Math.min(dom, monthEnd.getDate()));
    if (candidate >= monthStart && candidate <= monthEnd) {
      dates.push(candidate);
    }
    return dates;
  }

  if (stream.frequency === "ANNUALLY") {
    const candidate = new Date(year, predicted.getMonth(), predicted.getDate());
    if (
      candidate.getMonth() === month &&
      candidate.getFullYear() === year
    ) {
      dates.push(candidate);
    }
    return dates;
  }

  // For weekly/biweekly/semi-monthly, use day-based intervals
  const intervalDays: Record<string, number> = {
    WEEKLY: 7,
    BIWEEKLY: 14,
    SEMI_MONTHLY: 15,
  };
  const interval = intervalDays[stream.frequency] ?? 30;
  const msPerDay = 86400000;

  // Go backward from predicted to before monthStart
  let check = new Date(predicted);
  while (check.getTime() > monthStart.getTime()) {
    check = new Date(check.getTime() - interval * msPerDay);
  }

  // Go forward, collecting dates in the month
  while (check.getTime() <= monthEnd.getTime()) {
    if (check.getTime() >= monthStart.getTime()) {
      dates.push(new Date(check));
    }
    check = new Date(check.getTime() + interval * msPerDay);
  }

  return dates;
}

// --- Subscription Row ---

function SubscriptionRow({
  stream,
  onToggleCancel,
  saving,
}: {
  stream: StreamData;
  onToggleCancel: (id: string, cancel: boolean) => void;
  saving: boolean;
}) {
  const Icon = getCategoryIcon(stream.category);
  const displayName = stream.merchantName || stream.description;
  const status = getStreamStatus(stream);

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="shrink-0 rounded-lg bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>

        {/* Name + details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {displayName}
            </p>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {formatFrequency(stream.frequency)}
            </Badge>
            {status === "cancelled" && (
              <Badge
                variant="secondary"
                className="shrink-0 text-xs text-red-400"
              >
                Cancelled
              </Badge>
            )}
            {status === "inactive" && (
              <Badge
                variant="secondary"
                className="shrink-0 text-xs text-muted-foreground"
              >
                Inactive
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {getCategoryLabel(stream.category)}
            <span className="mx-1.5">·</span>
            {stream.accountName}
            {stream.predictedNextDate && status === "active" && (
              <>
                <span className="mx-1.5">·</span>
                Next: {formatDateShort(stream.predictedNextDate)}
              </>
            )}
          </p>
        </div>

        {/* Amount + action */}
        <div className="flex shrink-0 items-center gap-3">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(stream.lastAmount, stream.currency)}
          </p>
          <button
            onClick={() =>
              onToggleCancel(stream.id, status !== "cancelled")
            }
            disabled={saving}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              status === "cancelled"
                ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
            }`}
          >
            {status === "cancelled" ? "Reactivate" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function SubscriptionsClient({
  streams: initialStreams,
}: SubscriptionsClientProps) {
  const router = useRouter();
  const [streams, setStreams] = useState(initialStreams);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Only outflow streams (subscriptions/bills, not paychecks)
  const outflows = useMemo(
    () => streams.filter((s) => s.streamType === "OUTFLOW"),
    [streams]
  );

  // Filtered streams for the list view
  const filtered = useMemo(() => {
    return outflows.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        const nameMatch =
          s.merchantName?.toLowerCase().includes(q) ?? false;
        const descMatch = s.description.toLowerCase().includes(q);
        if (!nameMatch && !descMatch) return false;
      }

      if (statusFilter !== "all") {
        const status = getStreamStatus(s);
        if (status !== statusFilter) return false;
      }

      return true;
    });
  }, [outflows, search, statusFilter]);

  // Summary stats
  const activeOutflows = useMemo(
    () => outflows.filter((s) => getStreamStatus(s) === "active"),
    [outflows]
  );

  const monthlyTotal = useMemo(
    () =>
      activeOutflows.reduce(
        (sum, s) => sum + estimateMonthlyAmount(s.averageAmount, s.frequency),
        0
      ),
    [activeOutflows]
  );

  const next7Days = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 7);
    return activeOutflows.filter(
      (s) =>
        s.predictedNextDate && new Date(s.predictedNextDate) <= cutoff
    ).length;
  }, [activeOutflows]);

  // Calendar data
  const calendarDays = useMemo(
    () => buildCalendarDays(calYear, calMonth),
    [calYear, calMonth]
  );

  const calendarBills = useMemo(() => {
    const map = new Map<string, StreamData[]>();
    for (const stream of activeOutflows) {
      const dates = getStreamDatesInMonth(stream, calYear, calMonth);
      for (const date of dates) {
        const key = date.toISOString().slice(0, 10);
        const existing = map.get(key) ?? [];
        existing.push(stream);
        map.set(key, existing);
      }
    }
    return map;
  }, [activeOutflows, calYear, calMonth]);

  const selectedDayBills = useMemo(() => {
    if (!selectedDay) return [];
    const key = selectedDay.toISOString().slice(0, 10);
    return calendarBills.get(key) ?? [];
  }, [selectedDay, calendarBills]);

  const monthLabel = new Date(calYear, calMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Toggle cancel/reactivate
  async function handleToggleCancel(streamId: string, cancel: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: streamId, cancelledByUser: cancel }),
      });
      if (res.ok) {
        setStreams((prev) =>
          prev.map((s) =>
            s.id === streamId
              ? {
                  ...s,
                  cancelledByUser: cancel,
                  cancelledAt: cancel ? new Date().toISOString() : null,
                }
              : s
          )
        );
        router.refresh();
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setSaving(false);
    }
  }

  function prevMonth() {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else {
      setCalMonth(calMonth - 1);
    }
    setSelectedDay(null);
  }

  function nextMonth() {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else {
      setCalMonth(calMonth + 1);
    }
    setSelectedDay(null);
  }

  function goToday() {
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setSelectedDay(null);
  }

  // Empty state
  if (streams.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your recurring charges and upcoming bills
        </p>

        <div className="mt-8 glass rounded-xl p-12 text-center">
          <Repeat className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            No subscriptions detected
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Recurring charges will appear here after your accounts are synced.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Track your recurring charges and upcoming bills
      </p>

      {/* Tabs */}
      <Tabs defaultValue="list" className="mt-6">
        <TabsList>
          <TabsTrigger value="list">Subscriptions</TabsTrigger>
          <TabsTrigger value="calendar">Bill Calendar</TabsTrigger>
        </TabsList>

        {/* --- Subscriptions List Tab --- */}
        <TabsContent value="list">
          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Cost</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {formatCurrency(monthlyTotal)}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Repeat className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {activeOutflows.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    subscription{activeOutflows.length !== 1 ? "s" : ""}
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
                  <p className="text-sm text-muted-foreground">Next 7 Days</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {next7Days}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    upcoming bill{next7Days !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter bar */}
          <div className="mt-6 glass rounded-xl p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search subscriptions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-8"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val ?? "all")}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          <p className="mt-4 text-sm text-muted-foreground">
            Showing {filtered.length} of {outflows.length} subscription
            {outflows.length !== 1 ? "s" : ""}
          </p>

          {/* Subscription list */}
          {filtered.length > 0 ? (
            <div className="mt-4 space-y-3">
              {filtered.map((stream) => (
                <SubscriptionRow
                  key={stream.id}
                  stream={stream}
                  onToggleCancel={handleToggleCancel}
                  saving={saving}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 glass rounded-xl p-12 text-center">
              <Search className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold text-foreground">
                No matching subscriptions
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Try adjusting your search or status filter.
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="mt-4 text-sm text-primary hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </TabsContent>

        {/* --- Bill Calendar Tab --- */}
        <TabsContent value="calendar">
          {/* Month navigation */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="text-lg font-semibold text-foreground min-w-[180px] text-center">
                {monthLabel}
              </h2>
              <button
                onClick={nextMonth}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={goToday}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Today
            </button>
          </div>

          {/* Calendar grid */}
          <div className="mt-4 glass rounded-xl p-4">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dow) => (
                <div
                  key={dow}
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                >
                  {dow}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                if (!day) {
                  return <div key={`blank-${i}`} className="aspect-square" />;
                }

                const dayKey = day.toISOString().slice(0, 10);
                const bills = calendarBills.get(dayKey) ?? [];
                const hasBills = bills.length > 0;
                const isToday =
                  day.toDateString() === now.toDateString();
                const isSelected =
                  selectedDay?.toDateString() === day.toDateString();
                const totalAmount = bills.reduce(
                  (sum, s) => sum + s.lastAmount,
                  0
                );

                return (
                  <button
                    key={dayKey}
                    onClick={() =>
                      setSelectedDay(isSelected ? null : day)
                    }
                    className={`aspect-square rounded-lg p-1 text-left transition-colors ${
                      isSelected
                        ? "bg-primary/15 ring-1 ring-primary"
                        : hasBills
                        ? "hover:bg-accent"
                        : "hover:bg-accent/50"
                    } ${isToday ? "ring-1 ring-border" : ""}`}
                  >
                    <span
                      className={`block text-xs font-medium ${
                        isToday
                          ? "text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {hasBills && (
                      <div className="mt-0.5">
                        <div className="flex gap-0.5">
                          {bills.slice(0, 3).map((_, idx) => (
                            <div
                              key={idx}
                              className="h-1.5 w-1.5 rounded-full bg-primary"
                            />
                          ))}
                          {bills.length > 3 && (
                            <span className="text-[8px] text-muted-foreground">
                              +{bills.length - 3}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] tabular-nums text-muted-foreground mt-0.5 hidden sm:block">
                          {formatCurrency(totalAmount)}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div className="mt-4 glass rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground">
                {selectedDay.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              {selectedDayBills.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No bills due on this day.
                </p>
              ) : (
                <div className="mt-3 divide-y divide-border">
                  {selectedDayBills.map((stream) => {
                    const Icon = getCategoryIcon(stream.category);
                    return (
                      <div
                        key={stream.id}
                        className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="shrink-0 rounded-lg bg-primary/10 p-2">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {stream.merchantName || stream.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getCategoryLabel(stream.category)}
                            <span className="mx-1.5">·</span>
                            {formatFrequency(stream.frequency)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(stream.lastAmount, stream.currency)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
