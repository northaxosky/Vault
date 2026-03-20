"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface ProfileSettingsProps {
  userName: string | null;
  userEmail: string;
  userCreatedAt: string;
}

export default function ProfileSettings({
  userName,
  userEmail,
  userCreatedAt,
}: ProfileSettingsProps) {
  const [name, setName] = useState(userName || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("Profile updated");
        setName(data.user.name || "");
      } else {
        setMessage(data.error || "Failed to update");
      }
    } catch {
      setMessage("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold text-foreground">Profile</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Your account information
      </p>

      <Separator className="my-4" />

      <div className="space-y-4">
        <div>
          <Label htmlFor="display-name">Display Name</Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 max-w-sm"
            placeholder="Your name"
          />
        </div>

        <div>
          <Label>Email Address</Label>
          <Input
            value={userEmail}
            disabled
            className="mt-1.5 max-w-sm opacity-60"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Email cannot be changed
          </p>
        </div>

        <div>
          <Label>Member Since</Label>
          <p className="mt-1 text-sm text-foreground">
            {new Date(userCreatedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || name === (userName || "")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
