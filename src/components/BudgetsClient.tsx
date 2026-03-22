"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Target } from "lucide-react";
import { CATEGORY_CONFIG, getCategoryLabel, getCategoryIcon, formatCurrency } from "@/lib/categories";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- Types ---

interface BudgetData {
  id: string;
  category: string;
  amount: number;
}

interface BudgetsClientProps {
  budgets: BudgetData[];
  categorySpending: Record<string, number>; // category -> total spent this month
}

// --- Component ---

export default function BudgetsClient({
  budgets: initialBudgets,
  categorySpending,
}: BudgetsClientProps) {
  const router = useRouter();
  const [budgets, setBudgets] = useState(initialBudgets);
  const [saving, setSaving] = useState(false);

  // Add budget dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount] = useState("");

  // Edit budget dialog state
  const [editBudget, setEditBudget] = useState<BudgetData | null>(null);
  const [editAmount, setEditAmount] = useState("");

  // Categories that don't have a budget yet
  const availableCategories = Object.keys(CATEGORY_CONFIG).filter(
    (cat) => !budgets.some((b) => b.category === cat)
  );

  // Compute totals
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce(
    (sum, b) => sum + (categorySpending[b.category] || 0),
    0
  );

  async function handleAdd() {
    if (!newCategory || !newAmount) return;
    setSaving(true);

    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory, amount: Number(newAmount) }),
      });

      if (res.ok) {
        const data = await res.json();
        setBudgets((prev) => [...prev, data.budget].sort((a, b) => a.category.localeCompare(b.category)));
        setAddOpen(false);
        setNewCategory("");
        setNewAmount("");
        router.refresh();
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!editBudget || !editAmount) return;
    setSaving(true);

    try {
      const res = await fetch("/api/budgets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editBudget.id, amount: Number(editAmount) }),
      });

      if (res.ok) {
        const data = await res.json();
        setBudgets((prev) =>
          prev.map((b) => (b.id === data.budget.id ? data.budget : b))
        );
        setEditBudget(null);
        router.refresh();
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);

    try {
      const res = await fetch("/api/budgets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setBudgets((prev) => prev.filter((b) => b.id !== id));
        router.refresh();
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Budgets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set monthly spending limits by category
          </p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Budget
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Budget</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Category
                </label>
                <Select value={newCategory} onValueChange={(v) => setNewCategory(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {getCategoryLabel(cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Monthly Limit
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="500"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button onClick={handleAdd} disabled={saving || !newCategory || !newAmount}>
                {saving ? "Saving..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary card */}
      {budgets.length > 0 && (
        <div className="mt-6 glass rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Spent This Month</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(totalSpent)}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  of {formatCurrency(totalBudgeted)}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className={`text-2xl font-bold ${totalBudgeted - totalSpent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCurrency(Math.abs(totalBudgeted - totalSpent))}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Progress
              value={totalBudgeted > 0 ? Math.min(100, (totalSpent / totalBudgeted) * 100) : 0}
              className="h-2"
            />
          </div>
        </div>
      )}

      {/* Budget list */}
      {budgets.length === 0 ? (
        <div className="mt-8 glass rounded-xl p-12 text-center">
          <Target className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-medium text-foreground">
            No budgets yet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Set monthly spending limits to track how much you spend per category.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {budgets.map((budget) => {
            const spent = categorySpending[budget.category] || 0;
            const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            const Icon = getCategoryIcon(budget.category);

            // Color coding based on percentage
            let statusColor = "text-emerald-400"; // under 75%
            let progressColor = "[&>div]:bg-emerald-500";
            if (percent >= 90) {
              statusColor = "text-red-400";
              progressColor = "[&>div]:bg-red-500";
            } else if (percent >= 75) {
              statusColor = "text-yellow-400";
              progressColor = "[&>div]:bg-yellow-500";
            }

            return (
              <div key={budget.id} className="glass rounded-xl p-4">
                <div className="flex items-center gap-3">
                  {/* Category icon + label */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                    <Icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground truncate">
                        {getCategoryLabel(budget.category)}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Edit button */}
                        <button
                          onClick={() => {
                            setEditBudget(budget);
                            setEditAmount(String(budget.amount));
                          }}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                          title="Edit budget"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={() => handleDelete(budget.id)}
                          disabled={saving}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded"
                          title="Delete budget"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(spent)} of {formatCurrency(budget.amount)}
                      </p>
                      <p className={`text-sm font-medium ${statusColor}`}>
                        {Math.round(percent)}%
                      </p>
                    </div>
                    <div className="mt-2">
                      <Progress
                        value={Math.min(100, percent)}
                        className={`h-1.5 ${progressColor}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editBudget !== null}
        onOpenChange={(open) => { if (!open) setEditBudget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {editBudget ? getCategoryLabel(editBudget.category) : ""} Budget
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Monthly Limit
            </label>
            <Input
              type="number"
              min="1"
              step="1"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleEdit} disabled={saving || !editAmount}>
              {saving ? "Saving..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
