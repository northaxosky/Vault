"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("email-changed") === "true") {
      toast.success("Email address updated successfully");
    }
    if (searchParams.get("email-error") === "true") {
      toast.error("Email change failed. The link may be expired or invalid.");
    }
  }, [searchParams]);

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

  async function handleEmailChange() {
    setEmailSaving(true);

    try {
      const res = await fetch("/api/user/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, password: emailPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Verification email sent to " + newEmail);
        setNewEmail("");
        setEmailPassword("");
        setShowEmailChange(false);
      } else {
        toast.error(data.error || "Failed to request email change");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setEmailSaving(false);
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
          {!showEmailChange ? (
            <button
              type="button"
              onClick={() => setShowEmailChange(true)}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              Change email
            </button>
          ) : (
            <div className="mt-3 space-y-3 max-w-sm">
              <div>
                <Label htmlFor="new-email">New Email Address</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="mt-1.5"
                  placeholder="new@example.com"
                />
              </div>
              <div>
                <Label htmlFor="email-password">Current Password</Label>
                <Input
                  id="email-password"
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  className="mt-1.5"
                  placeholder="Confirm your password"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleEmailChange}
                  disabled={emailSaving || !newEmail || !emailPassword}
                  size="sm"
                >
                  {emailSaving ? "Sending..." : "Send Verification"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowEmailChange(false);
                    setNewEmail("");
                    setEmailPassword("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
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
