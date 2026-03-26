"use client";

import { useState, useCallback, useRef } from "react";
import { X, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PortfolioImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "upload" | "preview" | "importing" | "done";

interface PreviewAccount {
  accountNumber: string;
  accountName: string;
}

interface PreviewPosition {
  accountName: string;
  ticker: string;
  quantity: number;
  currentValue: number;
  costBasis: number | null;
}

interface PreviewData {
  accounts: PreviewAccount[];
  positions: PreviewPosition[];
  totalPositions: number;
  totalValue: number;
}

interface ImportResult {
  accounts: number;
  positions: number;
  cashPositions: number;
  totalValue: number;
  errors: string[];
}

export default function PortfolioImportDialog({
  open,
  onClose,
  onSuccess,
}: PortfolioImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  const handleOpen = useCallback(() => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  // Handle file selection — preview via server-side API to avoid Node-only deps
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File exceeds 5MB limit");
      return;
    }

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("preview", "true");

      const res = await fetch("/api/import/portfolio/preview", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to parse portfolio CSV");
        setLoading(false);
        return;
      }

      setPreview({
        accounts: data.accounts,
        positions: data.positions,
        totalPositions: data.totalPositions,
        totalValue: data.totalValue,
      });
      setStep("preview");
    } catch {
      setError("Failed to read file");
    } finally {
      setLoading(false);
    }
  };

  // Execute import
  const handleImport = async () => {
    if (!file) return;

    setStep("importing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/portfolio", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        setStep("preview");
        return;
      }

      setResult({
        accounts: data.accounts,
        positions: data.positions,
        cashPositions: data.cashPositions,
        totalValue: data.totalValue,
        errors: data.errors || [],
      });
      setStep("done");
    } catch {
      setError("Import failed. Please try again.");
      setStep("preview");
    }
  };

  // Close and trigger refresh
  const handleDone = () => {
    if (result && result.positions > 0) {
      toast.success(
        `Imported ${result.positions} position${result.positions !== 1 ? "s" : ""} across ${result.accounts} account${result.accounts !== 1 ? "s" : ""}`,
      );
      onSuccess();
    }
    onClose();
  };

  if (!open) return null;

  // Reset on first render when open
  if (step === "upload" && !file && !preview && !result) {
    handleOpen();
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Import Portfolio
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="mt-4 flex gap-2">
          {["upload", "preview", "done"].map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${
                ["upload", "preview", "importing", "done"].indexOf(step) >= i
                  ? "bg-primary"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Step: File upload */}
        {step === "upload" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a Fidelity portfolio positions CSV export. Accounts will be
              automatically created from the file.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files[0];
                if (f && f.name.endsWith(".csv")) handleFileSelect(f);
              }}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border px-6 py-10 transition-colors hover:border-primary hover:bg-accent/30"
            >
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {loading
                    ? "Parsing file..."
                    : "Drop CSV file here or click to browse"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fidelity positions export · Max 5MB
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && preview && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found{" "}
                <span className="font-medium text-foreground">
                  {preview.totalPositions} positions
                </span>{" "}
                across{" "}
                <span className="font-medium text-foreground">
                  {preview.accounts.length} account
                  {preview.accounts.length !== 1 ? "s" : ""}
                </span>{" "}
                · Total value:{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(preview.totalValue)}
                </span>
              </p>
            </div>

            <div className="max-h-56 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Account
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Ticker
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Shares
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Value
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Cost Basis
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.positions.map((pos, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="max-w-[120px] truncate px-3 py-2 text-foreground">
                        {pos.accountName}
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">
                        {pos.ticker}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {pos.quantity.toFixed(
                          pos.quantity % 1 === 0 ? 0 : 4,
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {formatCurrency(pos.currentValue)}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {pos.costBasis !== null
                          ? formatCurrency(pos.costBasis)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {file && (
              <p className="text-xs text-muted-foreground">
                File: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setPreview(null);
                }}
                className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
              >
                Import {preview.totalPositions} Positions
              </button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="mt-6 flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Importing positions...
            </p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && result && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-lg font-semibold text-foreground">
                Import Complete
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Accounts created</span>
                <span className="font-medium text-foreground">
                  {result.accounts}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Positions imported</span>
                <span className="font-medium text-foreground">
                  {result.positions}
                </span>
              </div>
              {result.cashPositions > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Cash positions
                  </span>
                  <span className="text-foreground">
                    {result.cashPositions}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Total portfolio value
                </span>
                <span className="font-medium text-foreground">
                  {formatCurrency(result.totalValue)}
                </span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  {result.errors.length} error(s)
                </summary>
                <ul className="mt-1 space-y-1 pl-4">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}

            <button
              onClick={handleDone}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
