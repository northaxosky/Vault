"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORY_CONFIG } from "@/lib/categories";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";

interface Rule {
  id: string;
  matchField: string;
  matchPattern: string;
  overrideName: string | null;
  overrideCategory: string | null;
}

interface TransactionRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM = {
  matchField: "name" as string,
  matchPattern: "",
  overrideName: "",
  overrideCategory: "",
};

export default function TransactionRulesDialog({
  open,
  onOpenChange,
}: TransactionRulesDialogProps) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  // Fetch rules when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/rules")
      .then((res) => res.json())
      .then((data) => setRules(data.rules ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setError("");
  }, []);

  const startEditing = useCallback((rule: Rule) => {
    setForm({
      matchField: rule.matchField,
      matchPattern: rule.matchPattern,
      overrideName: rule.overrideName ?? "",
      overrideCategory: rule.overrideCategory ?? "",
    });
    setEditingId(rule.id);
    setShowForm(true);
    setError("");
  }, []);

  async function handleSave() {
    if (!form.matchPattern.trim()) {
      setError("Match pattern is required");
      return;
    }
    if (!form.overrideName.trim() && !form.overrideCategory) {
      setError("At least one of name or category override is required");
      return;
    }

    setSaving(true);
    setError("");

    const body = {
      ...(editingId ? { id: editingId } : {}),
      matchField: form.matchField,
      matchPattern: form.matchPattern,
      overrideName: form.overrideName || null,
      overrideCategory: form.overrideCategory || null,
    };

    try {
      const res = await fetch("/api/rules", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save rule");
        return;
      }

      const data = await res.json();
      if (editingId) {
        setRules((prev) => prev.map((r) => (r.id === editingId ? data.rule : r)));
      } else {
        setRules((prev) => [data.rule, ...prev]);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      setError("Failed to save rule");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch("/api/rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
        if (editingId === id) resetForm();
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transaction Rules</DialogTitle>
          <DialogDescription>
            Auto-rename or re-categorize transactions matching a pattern.
            Rules are applied to new transactions during sync and retroactively to existing ones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 && !showForm ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No rules yet. Create one to get started.
            </p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    When{" "}
                    <span className="text-primary">
                      {rule.matchField === "merchantName" ? "merchant name" : "name"}
                    </span>{" "}
                    contains{" "}
                    <span className="font-mono text-primary">&ldquo;{rule.matchPattern}&rdquo;</span>
                  </p>
                  <div className="mt-1 text-muted-foreground">
                    {rule.overrideName && (
                      <p>Rename to &ldquo;{rule.overrideName}&rdquo;</p>
                    )}
                    {rule.overrideCategory && (
                      <p>
                        Set category to{" "}
                        {CATEGORY_CONFIG[rule.overrideCategory]?.label ?? rule.overrideCategory}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => startEditing(rule)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(rule.id)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}

          {/* Add / Edit form */}
          {showForm && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">
                {editingId ? "Edit Rule" : "New Rule"}
              </p>

              <div className="flex gap-2">
                <Select
                  value={form.matchField}
                  onValueChange={(val) =>
                    setForm((f) => ({ ...f, matchField: val ?? "name" }))
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="merchantName">Merchant Name</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="contains..."
                  value={form.matchPattern}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, matchPattern: e.target.value }))
                  }
                  className="flex-1"
                />
              </div>

              <Input
                placeholder="Rename to... (optional)"
                value={form.overrideName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, overrideName: e.target.value }))
                }
              />

              <Select
                value={form.overrideCategory || "__none__"}
                onValueChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    overrideCategory: val === "__none__" ? "" : (val ?? ""),
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Override category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No category override</SelectItem>
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <Icon className="size-4 text-muted-foreground" />
                        {config.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
                  {editingId ? "Update" : "Create"} Rule
                </Button>
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!showForm && (
            <Button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              size="sm"
            >
              <Plus className="mr-1 size-3.5" />
              Add Rule
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
