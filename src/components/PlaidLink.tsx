"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

/**
 * Inner component that only mounts once we have a link token.
 * This prevents usePlaidLink from injecting Plaid's script
 * before a token is ready (which causes duplicate-script warnings).
 */
function PlaidLinkButton({
  linkToken,
  onSuccess,
}: {
  linkToken: string;
  onSuccess: (publicToken: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleSuccess = useCallback(
    async (publicToken: string) => {
      setLoading(true);
      await onSuccess(publicToken);
      setLoading(false);
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: (error, metadata) => {
      if (error) {
        console.error("[Plaid Link] exit error:", {
          errorType: error.error_type,
          errorCode: error.error_code,
          errorMessage: error.error_message,
          displayMessage: error.display_message,
        });
        console.error("[Plaid Link] metadata:", {
          institution: metadata?.institution,
          linkSessionId: metadata?.link_session_id,
          status: metadata?.status,
        });
      }
    },
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready || loading}
      className="glow rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50"
    >
      {loading ? "Linking..." : "Link Bank Account"}
    </button>
  );
}

export default function PlaidLink({
  onLinkSuccess,
}: {
  onLinkSuccess?: () => void;
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLinkToken() {
      try {
        const res = await fetch("/api/plaid/create-link-token", {
          method: "POST",
        });
        const data = await res.json();

        if (data.linkToken) {
          setLinkToken(data.linkToken);
        } else {
          console.error("[Plaid Link] create-link-token failed:", data);
          setMessage(data.plaidError?.errorMessage || data.error || "Failed to initialize Plaid Link");
        }
      } catch (error) {
        console.error("Failed to fetch link token:", error);
        setMessage("Failed to connect to Plaid. Check your configuration.");
      }
    }

    fetchLinkToken();
  }, []);

  const onSuccess = useCallback(async (publicToken: string) => {
    setMessage(null);

    try {
      const res = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage(
          `Connected to ${data.institutionName}! Syncing transactions...`
        );

        // Trigger initial transaction sync for the newly linked bank.
        // This runs before calling onLinkSuccess so the dashboard has
        // fresh data when it refreshes.
        await fetch("/api/plaid/sync", { method: "POST" });

        setMessage(
          `Connected to ${data.institutionName}! ${data.accountCount} account(s) linked.`
        );
        onLinkSuccess?.();
      } else {
        setMessage("Something went wrong linking your account.");
      }
    } catch (error) {
      console.error("Error exchanging token:", error);
      setMessage("Failed to link account. Please try again.");
    }
  }, [onLinkSuccess]);

  return (
    <div>
      {linkToken ? (
        <PlaidLinkButton linkToken={linkToken} onSuccess={onSuccess} />
      ) : (
        <button
          disabled={true}
          suppressHydrationWarning
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50"
        >
          Link Bank Account
        </button>
      )}

      {message && (
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
