"use client";

import { createElement, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Repeat,
  DollarSign,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  AlertTriangle,
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  formatCurrency,
  formatFrequency,
  getCategoryIcon,
  getCategoryLabel,
} from "@/lib/categories";
import { toast } from "sonner";

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

// --- Edit Dialog ---

function EditSubscriptionDialog({
  stream,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  stream: StreamData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: { merchantName: string; lastAmount: number; frequency: string }) => Promise<void>;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("");

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && stream) {
      setName(stream.merchantName || "");
      setAmount(stream.lastAmount.toString());
      setFrequency(stream.frequency);
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!stream) return;

    try {
      await onSave(stream.id, {
        merchantName: name,
        lastAmount: parseFloat(amount),
        frequency,
      });
      handleOpen(false);
    } catch {
      // Error handled in parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Subscription</DialogTitle>
          <DialogDescription>
            Update the name, amount, or frequency of this subscription
          </DialogDescription>
        </DialogHeader>

        {stream && (
          <div className="space-y-4">
            {/* Custom Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Custom Name
              </label>
              <Input
                placeholder={stream.description}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional. Leave blank to use the merchant name.
              </p>
            </div>

            {/* Expected Amount */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Expected Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Frequency
              </label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v ?? "MONTHLY")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="BIWEEKLY">Biweekly</SelectItem>
                  <SelectItem value="SEMI_MONTHLY">Semi-monthly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="ANNUALLY">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Delete Confirmation Dialog ---

function DeleteConfirmationDialog({
  stream,
  open,
  onOpenChange,
  onDelete,
  deleting,
}: {
  stream: StreamData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (id: string) => Promise<void>;
  deleting: boolean;
}) {
  const handleDelete = async () => {
    if (!stream) return;
    try {
      await onDelete(stream.id);
      onOpenChange(false);
    } catch {
      // Error handled in parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            Delete Subscription
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this subscription? This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>

        {stream && (
          <div className="rounded-lg bg-accent/30 p-3">
            <p className="font-medium text-foreground">
              {stream.merchantName || stream.description}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {formatCurrency(stream.lastAmount, stream.currency)} •{" "}
              {formatFrequency(stream.frequency)}
            </p>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Subscription Row ---

function SubscriptionRow({
  stream,
  onToggleCancel,
  onEdit,
  onDelete,
  saving,
}: {
  stream: StreamData;
  onToggleCancel: (id: string, cancel: boolean) => void;
  onEdit: (stream: StreamData) => void;
  onDelete: (stream: StreamData) => void;
  saving: boolean;
}) {
  const displayName = stream.merchantName || stream.description;
  const status = getStreamStatus(stream);
  const isCancelled = status === "cancelled";

  return (
    <div
      className={`glass rounded-xl p-4 transition-opacity ${
        isCancelled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="shrink-0 rounded-lg bg-primary/10 p-2.5">
          {createElement(getCategoryIcon(stream.category), { className: "h-5 w-5 text-primary" })}
        </div>

        {/* Name + details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={`truncate text-sm font-medium ${
                isCancelled
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              }`}
            >
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

        {/* Amount + actions */}
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(stream.lastAmount, stream.currency)}
          </p>

          {/* Edit button */}
          <button
            onClick={() => onEdit(stream)}
            disabled={saving}
            title="Edit"
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Edit className="h-4 w-4" />
          </button>

          {/* Cancel/Reactivate button */}
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

          {/* Delete button */}
          <button
            onClick={() => onDelete(stream)}
            disabled={saving}
            title="Delete"
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-destructive transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
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

  // Edit/Delete dialog state
  const [editingStream, setEditingStream] = useState<StreamData | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteStream, setDeleteStream] = useState<StreamData | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
        toast.success(
          cancel
            ? "Subscription cancelled"
            : "Subscription reactivated"
        );
        router.refresh();
      } else {
        toast.error("Failed to update subscription");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  }

  // Edit subscription
  async function handleEdit(id: string, data: { merchantName: string; lastAmount: number; frequency: string }) {
    setSaving(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      if (res.ok) {
        const result = await res.json();
        setStreams((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  merchantName: result.stream.merchantName,
                  lastAmount: result.stream.lastAmount,
                  frequency: result.stream.frequency,
                }
              : s
          )
        );
        toast.success("Subscription updated");
        router.refresh();
      } else {
        toast.error("Failed to update subscription");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  }

  // Delete subscription
  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setStreams((prev) => prev.filter((s) => s.id !== id));
        toast.success("Subscription deleted");
        router.refresh();
      } else {
        toast.error("Failed to delete subscription");
      }
    } catch {
      toast.error("An error occurred");
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

          {/* Subscription list */}
          <div className="mt-6 space-y-3">
            {filtered.length > 0 ? (
              filtered.map((stream) => (
                <SubscriptionRow
                  key={stream.id}
                  stream={stream}
                  onToggleCancel={handleToggleCancel}
                  onEdit={(s) => {
                    setEditingStream(s);
                    setEditOpen(true);
                  }}
                  onDelete={(s) => {
                    setDeleteStream(s);
                    setDeleteOpen(true);
                  }}
                  saving={saving}
                />
              ))
            ) : (
              <div className="text-center py-8 glass rounded-xl">
                <p className="text-muted-foreground">No subscriptions found</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* --- Bill Calendar Tab --- */}
        <TabsContent value="calendar">
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Calendar */}
            <div className="lg:col-span-2 glass rounded-xl p-6">
              {/* Month navigation */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-foreground">{monthLabel}</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevMonth}
                    className="rounded-lg p-1.5 hover:bg-accent transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={goToday}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    Today
                  </button>
                  <button
                    onClick={nextMonth}
                    className="rounded-lg p-1.5 hover:bg-accent transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const isToday =
                    day &&
                    day.toDateString() === new Date().toDateString();
                  const isSelected =
                    day && selectedDay && day.toDateString() === selectedDay.toDateString();
                  const bills = day
                    ? (calendarBills.get(
                        day.toISOString().slice(0, 10)
                      ) ?? [])
                    : [];

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDay(day)}
                      className={`aspect-square rounded-lg p-1 text-xs transition-colors ${
                        !day
                          ? ""
                          : isSelected
                            ? "bg-primary text-primary-foreground"
                            : isToday
                              ? "border-2 border-primary"
                              : "hover:bg-accent/50"
                      }`}
                    >
                      {day && (
                        <div>
                          <div>{day.getDate()}</div>
                          {bills.length > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              {bills.length}
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected day details */}
            <div className="glass rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-4">
                {selectedDay
                  ? selectedDay.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })
                  : "Select a day"}
              </h3>

              {selectedDayBills.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayBills.map((stream) => (
                    <div
                      key={stream.id}
                      className="rounded-lg bg-accent/30 p-3"
                    >
                      <p className="font-medium text-foreground text-sm">
                        {stream.merchantName || stream.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(stream.lastAmount, stream.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {selectedDay ? "No bills scheduled" : ""}
                </p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <EditSubscriptionDialog
        stream={editingStream}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleEdit}
        saving={saving}
      />

      {/* Delete Dialog */}
      <DeleteConfirmationDialog
        stream={deleteStream}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDelete={handleDelete}
        deleting={saving}
      />
    </div>
  );
}
