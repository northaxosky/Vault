"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, Check, AlertTriangle, CreditCard, TrendingDown } from "lucide-react";
import { toast } from "sonner";

interface AlertData {
  id: string;
  type: string;
  title: string;
  message: string;
  transactionId: string | null;
  read: boolean;
  createdAt: string;
}

const ALERT_ICONS: Record<string, typeof AlertTriangle> = {
  LARGE_TRANSACTION: CreditCard,
  LOW_BALANCE: TrendingDown,
  BUDGET_OVERSPEND: AlertTriangle,
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AlertBell() {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  // Fetch alerts on mount
  useEffect(() => {
    fetch("/api/alerts")
      .then((res) => res.json())
      .then((data) => {
        setAlerts(data.alerts ?? []);
        setUnreadCount(data.unreadCount ?? 0);

        // Show toast for newest unread alert
        const newest = (data.alerts ?? []).find((a: AlertData) => !a.read);
        if (newest) {
          const Icon = ALERT_ICONS[newest.type] ?? AlertTriangle;
          toast(newest.title, {
            description: newest.message,
            icon: <Icon className="size-4" />,
          });
        }
      })
      .catch(console.error);
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h3 className="text-sm font-semibold">Alerts</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={markAllRead}
            >
              <Check className="mr-1 size-3" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Alert list */}
        <div className="max-h-72 overflow-y-auto">
          {alerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No alerts yet
            </p>
          ) : (
            alerts.map((alert) => {
              const Icon = ALERT_ICONS[alert.type] ?? AlertTriangle;
              return (
                <button
                  key={alert.id}
                  className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 ${
                    !alert.read ? "bg-accent/20" : ""
                  }`}
                  onClick={() => !alert.read && markRead(alert.id)}
                >
                  <div
                    className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${
                      alert.type === "LARGE_TRANSACTION"
                        ? "bg-amber-500/10 text-amber-500"
                        : alert.type === "LOW_BALANCE"
                          ? "bg-red-500/10 text-red-500"
                          : "bg-orange-500/10 text-orange-500"
                    }`}
                  >
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!alert.read ? "font-medium" : "text-muted-foreground"}`}>
                      {alert.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {alert.message}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {timeAgo(alert.createdAt)}
                    </p>
                  </div>
                  {!alert.read && (
                    <div className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
