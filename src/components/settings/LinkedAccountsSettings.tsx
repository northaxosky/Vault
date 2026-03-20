"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import PlaidLink from "@/components/PlaidLink";

interface LinkedAccount {
  id: string;
  institutionName: string | null;
  createdAt: string;
  accounts: { id: string; name: string; type: string; subtype: string | null }[];
}

interface LinkedAccountsSettingsProps {
  linkedAccounts: LinkedAccount[];
}

export default function LinkedAccountsSettings({
  linkedAccounts: initialAccounts,
}: LinkedAccountsSettingsProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);

  async function handleUnlink(itemId: string) {
    setUnlinking(itemId);

    try {
      const res = await fetch(`/api/user/linked-accounts/${itemId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== itemId));
      }
    } catch (err) {
      console.error("Failed to unlink:", err);
    } finally {
      setUnlinking(null);
      setConfirmUnlink(null);
    }
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold text-foreground">Linked Accounts</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your bank connections
      </p>

      <Separator className="my-4" />

      {accounts.length === 0 ? (
        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No bank accounts linked yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div>
                <p className="font-medium text-foreground">
                  {item.institutionName || "Unknown Bank"}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {item.accounts.map((acc) => (
                    <Badge key={acc.id} variant="secondary" className="text-xs">
                      {acc.name}
                    </Badge>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Linked {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div>
                {confirmUnlink === item.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUnlink(item.id)}
                      disabled={unlinking === item.id}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-destructive/80 disabled:opacity-50"
                    >
                      {unlinking === item.id ? "Unlinking..." : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmUnlink(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmUnlink(item.id)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Unlink
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <PlaidLink />
      </div>
    </div>
  );
}
