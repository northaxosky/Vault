"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

export default function VerificationBanner({
  emailVerified,
}: {
  emailVerified: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      toast.success("Email verified successfully!");
    }
  }, [searchParams]);

  if (emailVerified || dismissed) return null;

  async function handleResend() {
    setSending(true);
    try {
      const res = await fetch("/api/auth/verify/send", { method: "POST" });
      if (res.ok) {
        toast.success("Verification email sent! Check your inbox.");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to send verification email");
      }
    } catch {
      toast.error("Failed to send verification email");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
      <p>
        Please verify your email. Check your inbox or{" "}
        <button
          onClick={handleResend}
          disabled={sending}
          className="font-medium underline underline-offset-2 hover:text-amber-200 disabled:opacity-50"
        >
          {sending ? "sending…" : "resend verification email"}
        </button>
        .
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-0.5 hover:bg-amber-500/20"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
