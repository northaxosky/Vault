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

export default function PlaidLink() {
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
        }
      } catch (error) {
        console.error("Failed to fetch link token:", error);
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
          `Connected to ${data.institutionName}! ${data.accountCount} account(s) linked.`
        );
      } else {
        setMessage("Something went wrong linking your account.");
      }
    } catch (error) {
      console.error("Error exchanging token:", error);
      setMessage("Failed to link account. Please try again.");
    }
  }, []);

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
