"use client";

import { useState } from "react";
import { Settings2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  DASHBOARD_WIDGETS,
  DEFAULT_WIDGETS,
  type WidgetId,
} from "@/lib/widgets";

interface WidgetCustomizerProps {
  enabledWidgets: WidgetId[];
  onSave: (widgets: WidgetId[]) => void;
}

export default function WidgetCustomizer({
  enabledWidgets,
  onSave,
}: WidgetCustomizerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<WidgetId[]>(enabledWidgets);
  const [saving, setSaving] = useState(false);

  function handleOpen() {
    setSelected(enabledWidgets);
    setOpen(true);
  }

  function toggle(id: WidgetId) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardWidgets: selected }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSave(selected);
      setOpen(false);
      toast.success("Widget preferences saved");
    } catch {
      toast.error("Could not save widget preferences");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSelected([...DEFAULT_WIDGETS]);
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        aria-label="Customize widgets"
      >
        <Settings2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        aria-label="Customize widgets"
      >
        <Settings2 className="h-4 w-4" />
      </button>

      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={() => setOpen(false)}
      >
        {/* Modal */}
        <div
          className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold text-foreground">
            Customize Widgets
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which cards appear on your dashboard.
          </p>

          <div className="mt-4 space-y-3">
            {DASHBOARD_WIDGETS.map((widget) => (
              <label
                key={widget.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(widget.id)}
                  onChange={() => toggle(widget.id)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                  aria-label={`Toggle ${widget.label}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {widget.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {widget.description}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to defaults
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
