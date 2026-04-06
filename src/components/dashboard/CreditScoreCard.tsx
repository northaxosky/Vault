"use client";

import { useEffect, useState } from "react";
import type { CreditScoreResult, CreditScoreFactor } from "@/lib/credit-score";

function getScoreColor(score: number): string {
  if (score >= 800) return "#22c55e";
  if (score >= 740) return "#86efac";
  if (score >= 670) return "#facc15";
  if (score >= 580) return "#f97316";
  return "#ef4444";
}

function getImpactDot(impact: CreditScoreFactor["impact"]): string {
  if (impact === "positive") return "bg-green-500";
  if (impact === "neutral") return "bg-yellow-500";
  return "bg-red-500";
}

export default function CreditScoreCard() {
  const [data, setData] = useState<CreditScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/credit-score")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load credit score");
        return res.json();
      })
      .then((result) => setData(result))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-4" />
        <div className="h-28 w-48 mx-auto bg-muted rounded-full mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 bg-muted rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Credit Score
        </h3>
        <p className="text-sm text-muted-foreground">
          Unable to calculate credit score
        </p>
      </div>
    );
  }

  const percentage = (data.score - 300) / 550;
  const color = getScoreColor(data.score);

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Credit Score Estimate
      </h3>

      <svg
        viewBox="0 0 200 120"
        className="w-48 mx-auto"
        role="img"
        aria-label={`Credit score: ${data.score} out of 850`}
      >
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-muted/20"
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${percentage * 251} 251`}
        />
        {/* Score text */}
        <text
          x="100"
          y="80"
          textAnchor="middle"
          className="fill-foreground"
          fontSize="32"
          fontWeight="bold"
        >
          {data.score}
        </text>
        <text
          x="100"
          y="100"
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="12"
        >
          {data.rating}
        </text>
      </svg>

      <div className="mt-4 space-y-2">
        {data.factors.map((factor) => (
          <div key={factor.name} className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${getImpactDot(factor.impact)}`}
            />
            <span className="text-muted-foreground flex-1">{factor.name}</span>
            <span className="text-foreground font-medium tabular-nums">
              {factor.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
