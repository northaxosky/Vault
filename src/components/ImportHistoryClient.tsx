"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// --- Types ---

interface ImportBatch {
  batchId: string;
  accountId: string;
  accountName: string;
  institutionName: string;
  transactionCount: number;
  dateRange: { from: string; to: string };
  importedAt: string;
}

// --- Helpers ---

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(from: string, to: string): string {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

// --- Component ---

export default function ImportHistoryClient() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // --- Data fetching ---

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/import/history");
      if (!res.ok) throw new Error("Failed to load import history");
      const data: ImportBatch[] = await res.json();
      setBatches(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // --- Undo / Delete ---

  async function undoBatch(batch: ImportBatch) {
    setDeleting(batch.batchId);
    try {
      const res = await fetch(`/api/import/history/${batch.batchId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to undo import",
        );
      }
      const data: { deleted: number } = await res.json();
      toast.success(
        `Removed ${data.deleted} transaction${data.deleted !== 1 ? "s" : ""} from ${batch.accountName}`,
      );
      await fetchHistory();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to undo import",
      );
    } finally {
      setDeleting(null);
    }
  }

  // --- Render ---

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading
            ? "Loading…"
            : `${batches.length} CSV import${batches.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="mt-6 glass rounded-xl p-6 animate-pulse">
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 w-28 bg-muted rounded" />
                <div className="flex-1 h-4 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="mt-6 glass rounded-xl p-8 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchHistory();
            }}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && batches.length === 0 && (
        <div className="mt-8 glass rounded-xl p-12 text-center">
          <FileDown className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            No CSV imports yet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the Import CSV button on your dashboard to get started.
          </p>
        </div>
      )}

      {/* Table — desktop */}
      {!loading && !error && batches.length > 0 && (
        <>
          <div className="mt-6 hidden md:block">
            <div className="glass rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3">Institution</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3 text-right">Transactions</th>
                    <th className="px-4 py-3">Date Range</th>
                    <th className="px-4 py-3">Imported</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {batches.map((batch) => (
                    <tr
                      key={batch.batchId}
                      className="transition-colors hover:bg-accent/30"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {batch.institutionName}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {batch.accountName}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {batch.transactionCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateRange(
                          batch.dateRange.from,
                          batch.dateRange.to,
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span title={formatDate(batch.importedAt)}>
                          {formatRelative(batch.importedAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <UndoButton
                          batch={batch}
                          deleting={deleting === batch.batchId}
                          onConfirm={() => undoBatch(batch)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards — mobile */}
          <div className="mt-6 space-y-3 md:hidden">
            {batches.map((batch) => (
              <div key={batch.batchId} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {batch.institutionName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {batch.accountName}
                    </p>
                  </div>
                  <UndoButton
                    batch={batch}
                    deleting={deleting === batch.batchId}
                    onConfirm={() => undoBatch(batch)}
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Transactions</p>
                    <p className="mt-0.5 font-medium tabular-nums text-foreground">
                      {batch.transactionCount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date Range</p>
                    <p className="mt-0.5 text-foreground">
                      {formatDateRange(
                        batch.dateRange.from,
                        batch.dateRange.to,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Imported</p>
                    <p className="mt-0.5 text-foreground">
                      {formatRelative(batch.importedAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Undo button with confirmation dialog ---

function UndoButton({
  batch,
  deleting,
  onConfirm,
}: {
  batch: ImportBatch;
  deleting: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={deleting}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-400/10 hover:text-red-400 disabled:opacity-50"
        title="Undo import"
      >
        {deleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            Undo Import
          </DialogTitle>
          <DialogDescription>
            This will permanently delete{" "}
            <strong className="text-foreground">
              {batch.transactionCount.toLocaleString()} transaction
              {batch.transactionCount !== 1 ? "s" : ""}
            </strong>{" "}
            imported to{" "}
            <strong className="text-foreground">{batch.accountName}</strong> from{" "}
            <strong className="text-foreground">{batch.institutionName}</strong>.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete transactions"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
