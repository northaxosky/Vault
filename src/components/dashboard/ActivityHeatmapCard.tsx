"use client";

import { useEffect, useState } from "react";

interface DayData {
  date: string;
  count: number;
}

function getIntensityClass(count: number): string {
  if (count === 0) return "bg-muted/20";
  if (count <= 2) return "bg-primary opacity-30";
  if (count <= 4) return "bg-primary opacity-50";
  if (count <= 6) return "bg-primary opacity-70";
  return "bg-primary opacity-100";
}

function formatTooltip(dateStr: string, count: number): string {
  const date = new Date(dateStr + "T00:00:00");
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${formatted}: ${count} transaction${count !== 1 ? "s" : ""}`;
}

function getMonthLabels(days: DayData[]): { label: string; col: number }[] {
  const labels: { label: string; col: number }[] = [];
  let lastMonth = -1;

  for (let i = 0; i < days.length; i++) {
    const date = new Date(days[i].date + "T00:00:00");
    const month = date.getMonth();
    if (month !== lastMonth) {
      const col = Math.floor(i / 7);
      labels.push({
        label: date.toLocaleDateString("en-US", { month: "short" }),
        col,
      });
      lastMonth = month;
    }
  }

  return labels;
}

export default function ActivityHeatmapCard() {
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/widgets/activity-heatmap")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load activity data");
        return res.json();
      })
      .then((data) => setDays(data.days))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-4" />
        <div className="grid grid-cols-13 gap-1">
          {[...Array(91)].map((_, i) => (
            <div
              key={i}
              className="h-3.5 w-3.5 bg-muted rounded-sm"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Activity
        </h3>
        <p className="text-sm text-muted-foreground">
          Unable to load activity data
        </p>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Activity
        </h3>
        <p className="text-sm text-muted-foreground">
          No transaction activity to display
        </p>
      </div>
    );
  }

  // Pad front so the grid starts on Monday (column-major: each column = 1 week)
  const firstDate = new Date(days[0].date + "T00:00:00");
  // getDay(): 0=Sun, 1=Mon. Convert to Mon=0 format.
  const startDow = (firstDate.getDay() + 6) % 7;
  const padded: (DayData | null)[] = [
    ...Array(startDow).fill(null),
    ...days,
  ];

  // Fill remaining cells to complete the last column
  while (padded.length % 7 !== 0) {
    padded.push(null);
  }

  const totalCols = padded.length / 7;
  const monthLabels = getMonthLabels(days);

  // Build column-major grid (CSS grid fills row-major, so we reorder)
  const grid: (DayData | null)[] = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < totalCols; col++) {
      grid.push(padded[col * 7 + row]);
    }
  }

  const dayLabels = ["Mon", "", "Wed", "", "Fri", "", ""];

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Activity
      </h3>

      {/* Month labels */}
      <div
        className="grid gap-1 mb-1 ml-8"
        style={{ gridTemplateColumns: `repeat(${totalCols}, 1fr)` }}
      >
        {Array.from({ length: totalCols }, (_, col) => {
          const label = monthLabels.find((m) => m.col === col);
          return (
            <span key={col} className="text-[10px] text-muted-foreground truncate">
              {label?.label ?? ""}
            </span>
          );
        })}
      </div>

      {/* Heatmap grid with day labels */}
      <div className="flex gap-1">
        {/* Day-of-week labels */}
        <div className="grid grid-rows-7 gap-1 shrink-0">
          {dayLabels.map((label, i) => (
            <span
              key={i}
              className="text-[10px] text-muted-foreground h-3.5 flex items-center justify-end pr-1 w-7"
            >
              {label}
            </span>
          ))}
        </div>

        {/* Cells */}
        <div
          className="grid gap-1 flex-1"
          style={{
            gridTemplateColumns: `repeat(${totalCols}, 1fr)`,
            gridTemplateRows: "repeat(7, 1fr)",
          }}
        >
          {grid.map((cell, i) => (
            <div
              key={i}
              className={`h-3.5 w-3.5 rounded-sm ${
                cell ? getIntensityClass(cell.count) : "bg-transparent"
              }`}
              title={cell ? formatTooltip(cell.date, cell.count) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-[10px] text-muted-foreground">Less</span>
        <div className="h-3 w-3 rounded-sm bg-muted/20" />
        <div className="h-3 w-3 rounded-sm bg-primary opacity-30" />
        <div className="h-3 w-3 rounded-sm bg-primary opacity-50" />
        <div className="h-3 w-3 rounded-sm bg-primary opacity-70" />
        <div className="h-3 w-3 rounded-sm bg-primary opacity-100" />
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  );
}
