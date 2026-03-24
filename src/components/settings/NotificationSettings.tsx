"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface NotificationSettingsProps {
  settings: {
    emailAlerts: boolean;
    spendingAlert: number | null;
    lowBalanceAlert: number | null;
    weeklyDigest: boolean;
  };
}

export default function NotificationSettings({
  settings,
}: NotificationSettingsProps) {
  const [emailAlerts, setEmailAlerts] = useState(settings.emailAlerts);
  const [spendingAlert, setSpendingAlert] = useState(
    settings.spendingAlert?.toString() || ""
  );
  const [lowBalanceAlert, setLowBalanceAlert] = useState(
    settings.lowBalanceAlert?.toString() || ""
  );
  const [weeklyDigest, setWeeklyDigest] = useState(settings.weeklyDigest);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailAlerts,
          spendingAlert: spendingAlert ? Number(spendingAlert) : null,
          lowBalanceAlert: lowBalanceAlert ? Number(lowBalanceAlert) : null,
          weeklyDigest,
        }),
      });

      if (res.ok) {
        setMessage("Notification preferences saved");
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to save");
      }
    } catch {
      setMessage("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure alert preferences
      </p>
      <p className="mt-1 text-xs text-primary/70">
        Alerts are delivered in-app and via email when enabled.
      </p>

      <Separator className="my-4" />

      <div className={`space-y-5 ${!emailAlerts ? "opacity-60" : ""}`}>
        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Email Alerts</Label>
            <p className="text-xs text-muted-foreground">
              Enable email notifications
            </p>
          </div>
          <Switch
            checked={emailAlerts}
            onCheckedChange={(checked) => setEmailAlerts(checked as boolean)}
          />
        </div>

        <Separator />

        {/* Spending alert threshold */}
        <div>
          <Label htmlFor="spending-threshold">Spending Alert Threshold</Label>
          <p className="text-xs text-muted-foreground mb-1.5">
            Alert for transactions over this amount
          </p>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <Input
              id="spending-threshold"
              type="number"
              value={spendingAlert}
              onChange={(e) => setSpendingAlert(e.target.value)}
              disabled={!emailAlerts}
              className="pl-7"
              placeholder="e.g. 100"
            />
          </div>
        </div>

        {/* Low balance alert threshold */}
        <div>
          <Label htmlFor="balance-threshold">Low Balance Alert</Label>
          <p className="text-xs text-muted-foreground mb-1.5">
            Alert when balance drops below this amount
          </p>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <Input
              id="balance-threshold"
              type="number"
              value={lowBalanceAlert}
              onChange={(e) => setLowBalanceAlert(e.target.value)}
              disabled={!emailAlerts}
              className="pl-7"
              placeholder="e.g. 500"
            />
          </div>
        </div>

        <Separator />

        {/* Weekly digest */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Weekly Digest</Label>
            <p className="text-xs text-muted-foreground">
              Receive a weekly spending summary
            </p>
          </div>
          <Switch
            checked={weeklyDigest}
            onCheckedChange={(checked) => setWeeklyDigest(checked as boolean)}
            disabled={!emailAlerts}
          />
        </div>

        {emailAlerts && weeklyDigest && (
          <button
            type="button"
            onClick={async () => {
              setSendingDigest(true);
              try {
                const res = await fetch("/api/digest/send", { method: "POST" });
                if (res.ok) {
                  toast.success("Test digest sent! Check your email.");
                } else {
                  const data = await res.json();
                  toast.error(data.error || "Failed to send digest");
                }
              } catch {
                toast.error("Failed to send digest");
              } finally {
                setSendingDigest(false);
              }
            }}
            disabled={sendingDigest}
            className="text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            {sendingDigest ? "Sending..." : "Send test digest now →"}
          </button>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}
