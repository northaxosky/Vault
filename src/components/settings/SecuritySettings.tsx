"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleChangePassword() {
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({ text: "New password must be at least 8 characters", isError: true });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ text: "Passwords do not match", isError: true });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ text: "Password changed successfully", isError: false });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({ text: data.error || "Failed to change password", isError: true });
      }
    } catch {
      setMessage({ text: "Something went wrong", isError: true });
    } finally {
      setSaving(false);
    }
  }

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword.length > 0;

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold text-foreground">Security</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Password and account security
      </p>

      <Separator className="my-4" />

      <div className="space-y-4 max-w-sm">
        <h4 className="text-sm font-medium text-foreground">Change Password</h4>

        <div>
          <Label htmlFor="current-password">Current Password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1.5"
            placeholder="Enter current password"
          />
        </div>

        <div>
          <Label htmlFor="new-password">New Password</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1.5"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <Label htmlFor="confirm-password">Confirm New Password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1.5"
            placeholder="Re-enter new password"
          />
        </div>

        {message && (
          <p className={`text-sm ${message.isError ? "text-destructive" : "text-muted-foreground"}`}>
            {message.text}
          </p>
        )}

        <button
          onClick={handleChangePassword}
          disabled={saving || !canSubmit}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
        >
          {saving ? "Changing..." : "Change Password"}
        </button>
      </div>
    </div>
  );
}
