"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ManualAccount {
  id: string;
  institutionName: string | null;
  accounts: { id: string; name: string; type: string }[];
}

interface FormatOption {
  id: string;
  label: string;
}

type Step = "account" | "upload" | "preview" | "importing" | "done" | "portfolio-preview" | "portfolio-importing" | "portfolio-done";

interface PreviewData {
  format: string;
  sampleRows: { date: string; name: string; amount: number; category: string | null }[];
  totalRows: number;
}

interface PortfolioPreviewData {
  accounts: string[];
  positions: { accountName: string; ticker: string; quantity: number; currentValue: number; costBasis: number }[];
  totalPositions: number;
  totalValue: number;
}

interface ImportResult {
  imported: number;
  duplicates: number;
  skipped: number;
  errors: string[];
  format: string;
}

interface PortfolioImportResult {
  accounts: number;
  positions: number;
  securities: number;
}

export default function CsvImportDialog({ open, onClose, onSuccess }: CsvImportDialogProps) {
  const [step, setStep] = useState<Step>("account");
  const [manualAccounts, setManualAccounts] = useState<ManualAccount[]>([]);
  const [formats, setFormats] = useState<FormatOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [formatOverride, setFormatOverride] = useState<string>("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [portfolioPreview, setPortfolioPreview] = useState<PortfolioPreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [portfolioResult, setPortfolioResult] = useState<PortfolioImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New account form
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newInstitution, setNewInstitution] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("depository");

  // Fetch manual accounts and formats on open
  const fetchData = useCallback(async () => {
    try {
      const [acctRes, fmtRes] = await Promise.all([
        fetch("/api/accounts/manual"),
        fetch("/api/import/csv"),
      ]);
      if (acctRes.ok) {
        const data = await acctRes.json();
        setManualAccounts(Array.isArray(data) ? data : []);
      }
      if (fmtRes.ok) {
        const data = await fmtRes.json();
        setFormats(data.formats || []);
      }
    } catch {
      // Non-critical — user can still create a new account
    }
  }, []);

  // Reset state when dialog opens
  const handleOpen = useCallback(() => {
    setStep("upload");
    setSelectedAccountId("");
    setFile(null);
    setFormatOverride("");
    setPreview(null);
    setPortfolioPreview(null);
    setResult(null);
    setPortfolioResult(null);
    setError(null);
    setShowNewAccount(false);
    setNewInstitution("");
    setNewAccountName("");
    setNewAccountType("depository");
    fetchData();
  }, [fetchData]);

  // Create new manual account
  const handleCreateAccount = async () => {
    if (!newInstitution.trim() || !newAccountName.trim()) {
      setError("Institution name and account name are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionName: newInstitution.trim(),
          accountName: newAccountName.trim(),
          accountType: newAccountType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create account");
        return;
      }
      setSelectedAccountId(data.accountId);
      setShowNewAccount(false);
      await fetchData();
      setStep("preview");
    } catch {
      setError("Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection and generate server-side preview
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File exceeds 5MB limit");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (formatOverride) formData.append("format", formatOverride);

      const res = await fetch("/api/import/csv/preview", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to parse CSV");
        setLoading(false);
        return;
      }

      // Portfolio file detected — skip account selection, go straight to portfolio preview
      if (data.type === "portfolio") {
        setPortfolioPreview({
          accounts: data.accounts,
          positions: data.positions,
          totalPositions: data.totalPositions,
          totalValue: data.totalValue,
        });
        setStep("portfolio-preview");
      } else {
        setPreview({
          format: data.format,
          sampleRows: data.sampleRows,
          totalRows: data.totalRows,
        });
        setStep("account");
      }
    } catch {
      setError("Failed to read file");
    } finally {
      setLoading(false);
    }
  };

  // Execute import
  const handleImport = async () => {
    if (!file || !selectedAccountId) return;

    setStep("importing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("accountId", selectedAccountId);
      if (formatOverride) formData.append("format", formatOverride);

      const res = await fetch("/api/import/csv", {
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
        imported: data.imported,
        duplicates: data.duplicates,
        skipped: data.skipped,
        errors: data.errors || [],
        format: data.format,
      });
      setStep("done");
    } catch {
      setError("Import failed. Please try again.");
      setStep("preview");
    }
  };

  // Execute portfolio import
  const handlePortfolioImport = async () => {
    if (!file) return;

    setStep("portfolio-importing");
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
        setError(data.error || "Portfolio import failed");
        setStep("portfolio-preview");
        return;
      }

      setPortfolioResult({
        accounts: data.accounts ?? 0,
        positions: data.positions ?? 0,
        securities: data.securities ?? 0,
      });
      setStep("portfolio-done");
    } catch {
      setError("Portfolio import failed. Please try again.");
      setStep("portfolio-preview");
    }
  };

  // Close and trigger refresh
  const handleDone = () => {
    if (result && result.imported > 0) {
      toast.success(`Imported ${result.imported} transaction${result.imported !== 1 ? "s" : ""}`);
      onSuccess();
    } else if (portfolioResult && portfolioResult.positions > 0) {
      toast.success(`Imported ${portfolioResult.positions} position${portfolioResult.positions !== 1 ? "s" : ""}`);
      onSuccess();
    }
    onClose();
  };

  // Reset and fetch data when dialog opens
  useEffect(() => {
    if (open) {
      handleOpen();
    }
  }, [open, handleOpen]);

  if (!open) return null;

  // All existing accounts (manual + Plaid) flattened for selection
  const allAccounts = manualAccounts.flatMap((inst) =>
    inst.accounts.map((acct) => ({
      id: acct.id,
      name: `${inst.institutionName || "Unknown"} — ${acct.name}`,
      type: acct.type,
    }))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Import CSV</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="mt-4 flex gap-2">
          {step.startsWith("portfolio") ? (
            // Portfolio flow: upload → preview → done (3 steps)
            ["upload", "preview", "done"].map((s, i) => {
              const portfolioStepIndex = ["portfolio-preview", "portfolio-importing", "portfolio-done"].indexOf(step);
              return (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full ${portfolioStepIndex >= i ? "bg-primary" : "bg-muted"}`}
                />
              );
            })
          ) : (
            // Transaction flow: upload → account → preview → done (4 steps)
            ["upload", "account", "preview", "done"].map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  ["upload", "account", "preview", "importing", "done"].indexOf(step) >= i
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            ))
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Step: Account selection */}
        {step === "account" && (
          <div className="mt-6 space-y-4">
            {preview && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-foreground">
                  Detected <span className="font-medium">{preview.format}</span> format — {preview.totalRows} transaction{preview.totalRows !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Select an account to import into, or create a new one.
            </p>

            {allAccounts.length > 0 && !showNewAccount && (
              <div className="space-y-2">
                {allAccounts.map((acct) => (
                  <button
                    key={acct.id}
                    onClick={() => {
                      setSelectedAccountId(acct.id);
                      setStep("preview");
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-foreground">{acct.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{acct.type}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!showNewAccount ? (
              <button
                onClick={() => setShowNewAccount(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                + New Account
              </button>
            ) : (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <input
                  type="text"
                  placeholder="Institution name (e.g., American Express)"
                  value={newInstitution}
                  onChange={(e) => setNewInstitution(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder="Account name (e.g., Platinum Card)"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="depository">Checking / Savings</option>
                  <option value="credit">Credit Card</option>
                  <option value="investment">Investment</option>
                  <option value="loan">Loan</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNewAccount(false)}
                    className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateAccount}
                    disabled={loading}
                    className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
                  >
                    {loading ? "Creating..." : "Create & Continue"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: File upload */}
        {step === "upload" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file from your bank or brokerage. We auto-detect whether it&apos;s transactions or portfolio positions.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files[0];
                if (f && f.name.endsWith(".csv")) handleFileSelect(f);
              }}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border px-6 py-10 transition-colors hover:border-primary hover:bg-accent/30"
            >
              {loading ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Analyzing file...</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      Drop CSV file here or click to browse
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Supports First Tech, Amex, Chase, Robinhood, Fidelity &amp; more
                    </p>
                  </div>
                </>
              )}
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

            {/* Optional format override */}
            {formats.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground">
                  Format (auto-detected if not selected)
                </label>
                <select
                  value={formatOverride}
                  onChange={(e) => setFormatOverride(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Auto-detect</option>
                  {formats.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && preview && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Preview — {preview.totalRows} rows, format: <span className="font-medium text-foreground">{preview.format}</span>
              </p>
            </div>

            <div className="max-h-48 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">{row.date}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-foreground">{row.name}</td>
                      <td className="px-3 py-2 text-right text-foreground">{row.amount.toFixed(2)}</td>
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
                onClick={() => setStep("account")}
                className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
              >
                ← Change Account
              </button>
              <button
                onClick={handleImport}
                className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
              >
                Import {preview.totalRows} Transactions
              </button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="mt-6 flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importing transactions...</p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && result && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-lg font-semibold text-foreground">Import Complete</p>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Imported</span>
                <span className="font-medium text-foreground">{result.imported}</span>
              </div>
              {result.duplicates > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duplicates skipped</span>
                  <span className="text-amber-500">{result.duplicates}</span>
                </div>
              )}
              {result.skipped > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rows skipped (errors)</span>
                  <span className="text-red-500">{result.skipped}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Format detected</span>
                <span className="text-foreground">{result.format}</span>
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

        {/* Step: Portfolio preview */}
        {step === "portfolio-preview" && portfolioPreview && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-foreground">
                Portfolio detected — {portfolioPreview.totalPositions} position{portfolioPreview.totalPositions !== 1 ? "s" : ""} across {portfolioPreview.accounts.length} account{portfolioPreview.accounts.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="text-sm text-muted-foreground">
              Total value: <span className="font-medium text-foreground">${portfolioPreview.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="max-h-48 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Ticker</th>
                    <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                    <th className="px-3 py-1.5 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {portfolioPreview.positions.map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-mono">{p.ticker}</td>
                      <td className="px-3 py-1.5 text-right">{p.quantity.toFixed(4)}</td>
                      <td className="px-3 py-1.5 text-right">${p.currentValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setStep("account"); setFile(null); setPortfolioPreview(null); }}
                className="flex-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Back
              </button>
              <button
                onClick={handlePortfolioImport}
                className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
              >
                Import Portfolio
              </button>
            </div>
          </div>
        )}

        {/* Step: Portfolio importing */}
        {step === "portfolio-importing" && (
          <div className="mt-6 flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importing portfolio positions...</p>
          </div>
        )}

        {/* Step: Portfolio done */}
        {step === "portfolio-done" && portfolioResult && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Portfolio imported successfully!</span>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Accounts created</span>
                <span className="font-medium text-foreground">{portfolioResult.accounts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Positions imported</span>
                <span className="font-medium text-foreground">{portfolioResult.positions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Securities tracked</span>
                <span className="font-medium text-foreground">{portfolioResult.securities}</span>
              </div>
            </div>

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
