export interface CreditScoreFactor {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  impact: "positive" | "neutral" | "negative";
  detail: string;
}

export interface CreditScoreResult {
  score: number; // 300-850
  rating: string; // "Poor" | "Fair" | "Good" | "Very Good" | "Excellent"
  factors: CreditScoreFactor[];
}

export interface CreditScoreInput {
  totalRecurringStreams: number;
  activeRecurringStreams: number;
  creditAccounts: {
    currentBalance: number;
    availableBalance: number | null;
  }[];
  accountCreatedDates: Date[];
  accountTypes: string[];
  transactionCountLast30Days: number;
}

export function calculateCreditScore(
  input: CreditScoreInput,
): CreditScoreResult {
  const factors: CreditScoreFactor[] = [];

  // 1. Payment Consistency (35%)
  let paymentScore: number;
  if (input.totalRecurringStreams === 0) {
    paymentScore = 50;
  } else {
    paymentScore = Math.round(
      (input.activeRecurringStreams / input.totalRecurringStreams) * 100,
    );
  }
  factors.push({
    name: "Payment Consistency",
    score: paymentScore,
    weight: 0.35,
    impact:
      paymentScore >= 70
        ? "positive"
        : paymentScore >= 40
          ? "neutral"
          : "negative",
    detail:
      input.totalRecurringStreams === 0
        ? "No recurring payment data available"
        : `${input.activeRecurringStreams} of ${input.totalRecurringStreams} recurring payments active`,
  });

  // 2. Credit Utilization (30%)
  let utilizationScore: number;
  const totalBalance = input.creditAccounts.reduce(
    (s, a) => s + a.currentBalance,
    0,
  );
  const totalAvailable = input.creditAccounts.reduce(
    (s, a) => s + (a.availableBalance ?? 0),
    0,
  );
  const totalLimit = totalBalance + totalAvailable;

  if (input.creditAccounts.length === 0 || totalLimit === 0) {
    utilizationScore = 50;
  } else {
    const utilization = totalBalance / totalLimit;
    utilizationScore = Math.max(
      0,
      Math.min(100, Math.round(100 - utilization * 100)),
    );
  }
  const utilPct =
    totalLimit > 0 ? Math.round((totalBalance / totalLimit) * 100) : 0;
  factors.push({
    name: "Credit Utilization",
    score: utilizationScore,
    weight: 0.3,
    impact:
      utilizationScore >= 70
        ? "positive"
        : utilizationScore >= 40
          ? "neutral"
          : "negative",
    detail:
      input.creditAccounts.length === 0
        ? "No credit accounts linked"
        : `${utilPct}% of available credit used`,
  });

  // 3. Account Age (15%)
  let ageScore: number;
  let avgAgeMonths = 0;
  if (input.accountCreatedDates.length === 0) {
    ageScore = 50;
  } else {
    const now = new Date();
    avgAgeMonths =
      input.accountCreatedDates.reduce((sum, d) => {
        return (
          sum + (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
      }, 0) / input.accountCreatedDates.length;
    // 0 months = 0, 6 months = 24, 12 months = 48, 25 months = 100
    ageScore = Math.min(100, Math.round(avgAgeMonths * 4));
  }
  factors.push({
    name: "Account Age",
    score: ageScore,
    weight: 0.15,
    impact:
      ageScore >= 70 ? "positive" : ageScore >= 40 ? "neutral" : "negative",
    detail:
      input.accountCreatedDates.length === 0
        ? "No account history available"
        : `Average account age: ${Math.round(avgAgeMonths)} months`,
  });

  // 4. Account Mix (10%)
  const uniqueTypes = new Set(input.accountTypes);
  const mixScore = Math.min(100, uniqueTypes.size * 25);
  factors.push({
    name: "Account Mix",
    score: mixScore,
    weight: 0.1,
    impact:
      mixScore >= 70 ? "positive" : mixScore >= 40 ? "neutral" : "negative",
    detail: `${uniqueTypes.size} account type${uniqueTypes.size !== 1 ? "s" : ""}: ${Array.from(uniqueTypes).join(", ") || "none"}`,
  });

  // 5. Recent Activity (10%)
  let activityScore: number;
  const txnCount = input.transactionCountLast30Days;
  if (txnCount === 0) {
    activityScore = 20;
  } else if (txnCount < 10) {
    activityScore = 40;
  } else if (txnCount < 30) {
    activityScore = 70;
  } else if (txnCount < 100) {
    activityScore = 90;
  } else {
    activityScore = 100;
  }
  factors.push({
    name: "Recent Activity",
    score: activityScore,
    weight: 0.1,
    impact:
      activityScore >= 70
        ? "positive"
        : activityScore >= 40
          ? "neutral"
          : "negative",
    detail: `${txnCount} transactions in the last 30 days`,
  });

  // Calculate weighted sum and final score
  const weightedSum = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  const score = Math.round(300 + (weightedSum / 100) * 550);

  let rating: string;
  if (score >= 800) rating = "Excellent";
  else if (score >= 740) rating = "Very Good";
  else if (score >= 670) rating = "Good";
  else if (score >= 580) rating = "Fair";
  else rating = "Poor";

  return { score, rating, factors };
}
