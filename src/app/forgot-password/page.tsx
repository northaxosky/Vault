"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-mesh flex min-h-screen items-center justify-center bg-background">
      <div className="glass-strong glow w-full max-w-md space-y-8 rounded-xl p-8">
        {submitted ? (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Check your email
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                If an account exists for <strong>{email}</strong>, we sent a
                password reset link. It expires in 1 hour.
              </p>
            </div>
            <Link
              href="/login"
              className="block text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Back to login
            </Link>
          </>
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Vault
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a reset link
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-input px-3 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="you@example.com"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
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
          </>
        )}
      </div>
    </div>
  );
}
