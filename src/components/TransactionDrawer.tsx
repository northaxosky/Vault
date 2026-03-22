"use client";

import { useState, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORY_CONFIG,
  getCategoryIcon,
  getCategoryLabel,
  getEffectiveCategory,
  formatCurrency,
  formatFrequency,
} from "@/lib/categories";
import type { TransactionData } from "@/lib/types";
import {
  Clock,
  RefreshCw,
  Loader2,
  Save,
} from "lucide-react";

// Value used to represent "no override" in the Select
const USE_DEFAULT = "__default__";

interface TransactionDrawerProps {
  transaction: TransactionData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: { notes: string | null; userCategory: string | null }) => void;
}

export default function TransactionDrawer({
  transaction,
  open,
  onOpenChange,
  onUpdate,
}: TransactionDrawerProps) {
  const [notes, setNotes] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(USE_DEFAULT);
  const [saving, setSaving] = useState(false);

  // Sync local state when a new transaction is opened
  const handleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen && transaction) {
        setNotes(transaction.notes ?? "");
        setSelectedCategory(transaction.userCategory ?? USE_DEFAULT);
      }
      onOpenChange(isOpen);
    },
    [transaction, onOpenChange]
  );

  if (!transaction) return null;

  const effectiveCategory = getEffectiveCategory(
    selectedCategory === USE_DEFAULT ? null : selectedCategory,
    transaction.category
  );
  const CategoryIcon = getCategoryIcon(effectiveCategory);
  const isIncome = transaction.amount < 0;
  const displayName = transaction.merchantName || transaction.name;

  const dateFormatted = new Date(transaction.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hasChanges =
    (notes || null) !== (transaction.notes || null) ||
    (selectedCategory === USE_DEFAULT ? null : selectedCategory) !== (transaction.userCategory || null);

  async function handleSave() {
    if (!transaction) return;
    setSaving(true);
    const userCategory = selectedCategory === USE_DEFAULT ? null : selectedCategory;
    const updatedNotes = notes.trim() || null;

    try {
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: transaction.id,
          notes: updatedNotes,
          userCategory,
        }),
      });

      if (res.ok) {
        onUpdate(transaction.id, { notes: updatedNotes, userCategory });
      }
    } catch (err) {
      console.error("Failed to save transaction:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg">{displayName}</DialogTitle>
          {transaction.merchantName && transaction.merchantName !== transaction.name && (
            <DialogDescription className="text-xs">
              {transaction.name}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Scrollable body */}
        <div className="max-h-[calc(90vh-180px)] overflow-y-auto space-y-6 pr-6">
          {/* Amount */}
          <div className="text-center py-2">
            <span
              className={`text-3xl font-bold tabular-nums ${
                isIncome ? "text-emerald-400" : "text-foreground"
              }`}
            >
              {isIncome ? "+" : "-"}
              {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
            </span>
          </div>

          {/* Detail rows */}
          <div className="space-y-3 text-sm">
            <DetailRow label="Date" value={dateFormatted} />
            <DetailRow label="Account" value={transaction.accountName} />
            <DetailRow
              label="Category"
              value={
                <span className="flex items-center gap-1.5">
                  <CategoryIcon className="size-4 text-muted-foreground" />
                  {getCategoryLabel(effectiveCategory)}
                  {transaction.userCategory && (
                    <span className="text-xs text-muted-foreground">(custom)</span>
                  )}
                </span>
              }
            />

            {/* Badges */}
            <div className="flex items-center gap-2 pt-1">
              {transaction.pending && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="size-3" />
                  Pending
                </Badge>
              )}
              {transaction.isRecurring && (
                <Badge variant="secondary" className="gap-1">
                  <RefreshCw className="size-3" />
                  {formatFrequency(transaction.recurringFrequency)}
                </Badge>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Editable: Category override */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Category Override</label>
            <Select
              value={selectedCategory}
              onValueChange={(val) => setSelectedCategory(val ?? USE_DEFAULT)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {selectedCategory === USE_DEFAULT ? (
                    <span className="text-muted-foreground">
                      Use default {transaction.category && `(${getCategoryLabel(transaction.category)})`}
                    </span>
                  ) : (
                    CATEGORY_CONFIG[selectedCategory]?.label
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={USE_DEFAULT}>
                  Use default
                  {transaction.category && (
                    <span className="ml-1 text-muted-foreground">
                      ({getCategoryLabel(transaction.category)})
                    </span>
                  )}
                </SelectItem>
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
          </div>

          {/* Editable: Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note about this transaction..."
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 size-4" />
                Save changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
