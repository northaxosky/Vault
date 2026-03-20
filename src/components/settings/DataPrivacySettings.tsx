"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Download, Trash2 } from "lucide-react";

export default function DataPrivacySettings() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);

    try {
      const res = await fetch("/api/user/export");

      if (!res.ok) {
        throw new Error("Export failed");
      }

      // Trigger browser download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vault-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export data");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setError(null);
    setDeleting(true);

    try {
      const res = await fetch("/api/user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });

      const data = await res.json();

      if (res.ok) {
        // Account deleted — sign out and redirect to login
        signOut({ callbackUrl: "/login" });
      } else {
        setError(data.error || "Failed to delete account");
        setDeleting(false);
      }
    } catch {
      setError("Something went wrong");
      setDeleting(false);
    }
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold text-foreground">Data & Privacy</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Export your data or delete your account
      </p>

      <Separator className="my-4" />

      {/* Export Data */}
      <div>
        <h4 className="text-sm font-medium text-foreground">Export Data</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Download all your data as a JSON file — accounts, transactions,
          settings, and more.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="mt-3 flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Exporting..." : "Export My Data"}
        </button>
      </div>

      <Separator className="my-6" />

      {/* Danger Zone — Delete Account */}
      <div className="rounded-lg border border-destructive/30 p-4">
        <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="delete-password" className="text-destructive">
                Enter your password to confirm
              </Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="mt-1.5 max-w-sm"
                placeholder="Your password"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePassword}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/80 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Permanently Delete Account"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword("");
                  setError(null);
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
