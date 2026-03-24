"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="bg-mesh flex min-h-screen items-center justify-center bg-background">
        <div className="glass-strong glow w-full max-w-md space-y-8 rounded-xl p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Invalid Link
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This password reset link is invalid. Please request a new one.
            </p>
          </div>
          <Link
            href="/forgot-password"
            className="block text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-mesh flex min-h-screen items-center justify-center bg-background">
        <div className="glass-strong glow w-full max-w-md space-y-8 rounded-xl p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Password Reset
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your password has been reset successfully. You can now sign in
              with your new password.
            </p>
          </div>
          <Link
            href="/login"
            className="block text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-mesh flex min-h-screen items-center justify-center bg-background">
      <div className="glass-strong glow w-full max-w-md space-y-8 rounded-xl p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Vault
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a new password for your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              New Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-input px-3 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-foreground"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-input px-3 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Repeat your password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">
              {error}
              {error === "Invalid or expired reset link" && (
                <>
                  {" — "}
                  <Link
                    href="/forgot-password"
                    className="font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    request a new one
                  </Link>
                </>
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
