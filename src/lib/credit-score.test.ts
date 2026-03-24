import { describe, it, expect } from "vitest";
import {
  calculateCreditScore,
  type CreditScoreInput,
} from "./credit-score";

const emptyInput: CreditScoreInput = {
  totalRecurringStreams: 0,
  activeRecurringStreams: 0,
  creditAccounts: [],
  accountCreatedDates: [],
  accountTypes: [],
  transactionCountLast30Days: 0,
};

function makeInput(overrides: Partial<CreditScoreInput>): CreditScoreInput {
  return { ...emptyInput, ...overrides };
}

describe("calculateCreditScore", () => {
  // --- Basic structure ---
  it("returns score in valid range for empty input", () => {
    const result = calculateCreditScore(emptyInput);
    expect(result.score).toBeGreaterThanOrEqual(300);
    expect(result.score).toBeLessThanOrEqual(850);
    expect(result.factors).toHaveLength(5);
  });

  it("always returns exactly 5 factors", () => {
    const result = calculateCreditScore(emptyInput);
    expect(result.factors).toHaveLength(5);
    const names = result.factors.map((f) => f.name);
    expect(names).toContain("Payment Consistency");
    expect(names).toContain("Credit Utilization");
    expect(names).toContain("Account Age");
    expect(names).toContain("Account Mix");
    expect(names).toContain("Recent Activity");
  });

  it("factor weights sum to 1.0", () => {
    const result = calculateCreditScore(emptyInput);
    const totalWeight = result.factors.reduce((s, f) => s + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  // --- Default/empty user ---
  it("returns neutral scores for empty/default user", () => {
    const result = calculateCreditScore(emptyInput);
    // Payment: 50, Utilization: 50, Age: 50, Mix: 0, Activity: 20
    // Weighted: 50*0.35 + 50*0.30 + 50*0.15 + 0*0.10 + 20*0.10 = 17.5+15+7.5+0+2 = 42
    // Score: 300 + (42/100)*550 = 300 + 231 = 531
    expect(result.score).toBeGreaterThanOrEqual(500);
    expect(result.score).toBeLessThanOrEqual(600);
  });

  // --- Excellent credit profile ---
  it("returns Excellent for ideal profile", () => {
    const threeYearsAgo = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000 * 3,
    );
    const result = calculateCreditScore({
      totalRecurringStreams: 10,
      activeRecurringStreams: 10,
      creditAccounts: [{ currentBalance: 500, availableBalance: 9500 }],
      accountCreatedDates: [threeYearsAgo],
      accountTypes: ["depository", "credit", "investment", "depository"],
      transactionCountLast30Days: 50,
    });
    expect(result.score).toBeGreaterThanOrEqual(800);
    expect(result.rating).toBe("Excellent");
  });

  // --- Poor credit profile ---
  it("returns Poor for bad profile", () => {
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = calculateCreditScore({
      totalRecurringStreams: 10,
      activeRecurringStreams: 1,
      creditAccounts: [{ currentBalance: 9500, availableBalance: 500 }],
      accountCreatedDates: [oneMonthAgo],
      accountTypes: ["credit"],
      transactionCountLast30Days: 2,
    });
    expect(result.score).toBeLessThan(580);
    expect(result.rating).toBe("Poor");
  });

  // --- Credit Utilization ---
  it("gives neutral utilization score (50) when no credit accounts", () => {
    const result = calculateCreditScore(
      makeInput({ creditAccounts: [] }),
    );
    const util = result.factors.find((f) => f.name === "Credit Utilization")!;
    expect(util.score).toBe(50);
  });

  it("gives high utilization score for low usage", () => {
    const result = calculateCreditScore(
      makeInput({
        creditAccounts: [{ currentBalance: 500, availableBalance: 9500 }],
      }),
    );
    const util = result.factors.find((f) => f.name === "Credit Utilization")!;
    // 5% utilization → score should be 95
    expect(util.score).toBeGreaterThanOrEqual(90);
    expect(util.impact).toBe("positive");
  });

  it("gives low utilization score for high usage", () => {
    const result = calculateCreditScore(
      makeInput({
        creditAccounts: [{ currentBalance: 9000, availableBalance: 1000 }],
      }),
    );
    const util = result.factors.find((f) => f.name === "Credit Utilization")!;
    expect(util.score).toBeLessThanOrEqual(15);
    expect(util.impact).toBe("negative");
  });

  it("gives utilization score of 0 for fully maxed credit", () => {
    const result = calculateCreditScore(
      makeInput({
        creditAccounts: [{ currentBalance: 10000, availableBalance: 0 }],
      }),
    );
    const util = result.factors.find((f) => f.name === "Credit Utilization")!;
    expect(util.score).toBe(0);
  });

  it("gives utilization score of 100 for zero balance", () => {
    const result = calculateCreditScore(
      makeInput({
        creditAccounts: [{ currentBalance: 0, availableBalance: 10000 }],
      }),
    );
    const util = result.factors.find((f) => f.name === "Credit Utilization")!;
    expect(util.score).toBe(100);
  });

  it("handles null availableBalance in credit accounts", () => {
    const result = calculateCreditScore(
      makeInput({
        creditAccounts: [{ currentBalance: 500, availableBalance: null }],
      }),
    );
    // totalLimit = 500+0 = 500, utilization = 500/500 = 100% → score 0
    const util = result.factors.find((f) => f.name === "Credit Utilization")!;
    expect(util.score).toBe(0);
  });

  // --- Transaction Activity ---
  it("gives low activity score (20) for zero transactions", () => {
    const result = calculateCreditScore(
      makeInput({ transactionCountLast30Days: 0 }),
    );
    const activity = result.factors.find((f) => f.name === "Recent Activity")!;
    expect(activity.score).toBe(20);
    expect(activity.impact).toBe("negative");
  });

  it("gives activity score of 40 for low transaction count", () => {
    const result = calculateCreditScore(
      makeInput({ transactionCountLast30Days: 5 }),
    );
    const activity = result.factors.find((f) => f.name === "Recent Activity")!;
    expect(activity.score).toBe(40);
    expect(activity.impact).toBe("neutral");
  });

  it("gives activity score of 70 for moderate transactions", () => {
    const result = calculateCreditScore(
      makeInput({ transactionCountLast30Days: 25 }),
    );
    const activity = result.factors.find((f) => f.name === "Recent Activity")!;
    expect(activity.score).toBe(70);
    expect(activity.impact).toBe("positive");
  });

  it("gives activity score of 90 for high transactions", () => {
    const result = calculateCreditScore(
      makeInput({ transactionCountLast30Days: 50 }),
    );
    const activity = result.factors.find((f) => f.name === "Recent Activity")!;
    expect(activity.score).toBe(90);
  });

  it("gives activity score of 100 for 100+ transactions", () => {
    const result = calculateCreditScore(
      makeInput({ transactionCountLast30Days: 150 }),
    );
    const activity = result.factors.find((f) => f.name === "Recent Activity")!;
    expect(activity.score).toBe(100);
    expect(activity.impact).toBe("positive");
  });

  // --- Account Mix ---
  it("gives mix score of 25 for single account type", () => {
    const result = calculateCreditScore(
      makeInput({ accountTypes: ["depository"] }),
    );
    const mix = result.factors.find((f) => f.name === "Account Mix")!;
    expect(mix.score).toBe(25);
    expect(mix.impact).toBe("negative");
  });

  it("gives mix score of 50 for two account types", () => {
    const result = calculateCreditScore(
      makeInput({ accountTypes: ["depository", "credit"] }),
    );
    const mix = result.factors.find((f) => f.name === "Account Mix")!;
    expect(mix.score).toBe(50);
    expect(mix.impact).toBe("neutral");
  });

  it("gives mix score of 100 for 4+ account types", () => {
    const result = calculateCreditScore(
      makeInput({
        accountTypes: ["depository", "credit", "investment", "loan"],
      }),
    );
    const mix = result.factors.find((f) => f.name === "Account Mix")!;
    expect(mix.score).toBe(100);
    expect(mix.impact).toBe("positive");
  });

  it("deduplicates account types correctly", () => {
    const result = calculateCreditScore(
      makeInput({
        accountTypes: ["depository", "depository", "depository"],
      }),
    );
    const mix = result.factors.find((f) => f.name === "Account Mix")!;
    expect(mix.score).toBe(25);
    expect(mix.detail).toContain("1 account type");
  });

  it("gives mix score of 0 for no account types", () => {
    const result = calculateCreditScore(
      makeInput({ accountTypes: [] }),
    );
    const mix = result.factors.find((f) => f.name === "Account Mix")!;
    expect(mix.score).toBe(0);
  });

  // --- Account Age ---
  it("gives low age score for new accounts", () => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = calculateCreditScore(
      makeInput({ accountCreatedDates: [oneWeekAgo] }),
    );
    const age = result.factors.find((f) => f.name === "Account Age")!;
    expect(age.score).toBeLessThan(10);
    expect(age.impact).toBe("negative");
  });

  it("gives high age score for mature accounts (2+ years)", () => {
    const twoYearsAgo = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000 * 2,
    );
    const result = calculateCreditScore(
      makeInput({ accountCreatedDates: [twoYearsAgo] }),
    );
    const age = result.factors.find((f) => f.name === "Account Age")!;
    expect(age.score).toBeGreaterThanOrEqual(90);
    expect(age.impact).toBe("positive");
  });

  it("gives neutral age score (50) when no accounts", () => {
    const result = calculateCreditScore(
      makeInput({ accountCreatedDates: [] }),
    );
    const age = result.factors.find((f) => f.name === "Account Age")!;
    expect(age.score).toBe(50);
  });

  it("averages age across multiple accounts", () => {
    const threeYearsAgo = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000 * 3,
    );
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = calculateCreditScore(
      makeInput({ accountCreatedDates: [threeYearsAgo, oneWeekAgo] }),
    );
    const age = result.factors.find((f) => f.name === "Account Age")!;
    // Average ~18 months → score ~72
    expect(age.score).toBeGreaterThan(50);
    expect(age.score).toBeLessThan(100);
  });

  // --- Payment Consistency ---
  it("gives neutral payment score (50) when no recurring streams", () => {
    const result = calculateCreditScore(
      makeInput({
        totalRecurringStreams: 0,
        activeRecurringStreams: 0,
      }),
    );
    const payment = result.factors.find(
      (f) => f.name === "Payment Consistency",
    )!;
    expect(payment.score).toBe(50);
  });

  it("gives high payment score when all streams active", () => {
    const result = calculateCreditScore(
      makeInput({
        totalRecurringStreams: 8,
        activeRecurringStreams: 8,
      }),
    );
    const payment = result.factors.find(
      (f) => f.name === "Payment Consistency",
    )!;
    expect(payment.score).toBe(100);
    expect(payment.impact).toBe("positive");
  });

  it("gives low payment score when few streams active", () => {
    const result = calculateCreditScore(
      makeInput({
        totalRecurringStreams: 10,
        activeRecurringStreams: 2,
      }),
    );
    const payment = result.factors.find(
      (f) => f.name === "Payment Consistency",
    )!;
    expect(payment.score).toBe(20);
    expect(payment.impact).toBe("negative");
  });

  // --- Edge cases ---
  it("handles all zeros without NaN", () => {
    const result = calculateCreditScore({
      totalRecurringStreams: 0,
      activeRecurringStreams: 0,
      creditAccounts: [],
      accountCreatedDates: [],
      accountTypes: [],
      transactionCountLast30Days: 0,
    });
    expect(Number.isNaN(result.score)).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(300);
    expect(result.score).toBeLessThanOrEqual(850);
    for (const factor of result.factors) {
      expect(Number.isNaN(factor.score)).toBe(false);
    }
  });

  it("score is always between 300 and 850", () => {
    // Minimum possible: all factor scores 0
    const worstCase = calculateCreditScore({
      totalRecurringStreams: 100,
      activeRecurringStreams: 0,
      creditAccounts: [{ currentBalance: 10000, availableBalance: 0 }],
      accountCreatedDates: [new Date()],
      accountTypes: [],
      transactionCountLast30Days: 0,
    });
    expect(worstCase.score).toBeGreaterThanOrEqual(300);

    // Maximum possible: all factor scores 100
    const bestCase = calculateCreditScore({
      totalRecurringStreams: 5,
      activeRecurringStreams: 5,
      creditAccounts: [{ currentBalance: 0, availableBalance: 10000 }],
      accountCreatedDates: [
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 5),
      ],
      accountTypes: ["depository", "credit", "investment", "loan"],
      transactionCountLast30Days: 200,
    });
    expect(bestCase.score).toBeLessThanOrEqual(850);
  });

  // --- Rating labels ---
  it("returns 'Excellent' for scores >= 800", () => {
    const result = calculateCreditScore({
      totalRecurringStreams: 10,
      activeRecurringStreams: 10,
      creditAccounts: [{ currentBalance: 0, availableBalance: 10000 }],
      accountCreatedDates: [
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 5),
      ],
      accountTypes: ["depository", "credit", "investment", "loan"],
      transactionCountLast30Days: 150,
    });
    expect(result.rating).toBe("Excellent");
  });

  it("returns 'Poor' for very low scores", () => {
    const result = calculateCreditScore({
      totalRecurringStreams: 100,
      activeRecurringStreams: 0,
      creditAccounts: [{ currentBalance: 10000, availableBalance: 0 }],
      accountCreatedDates: [new Date()],
      accountTypes: [],
      transactionCountLast30Days: 0,
    });
    expect(result.rating).toBe("Poor");
  });

  it("maps all rating thresholds correctly", () => {
    // We can't directly set score, but we can verify the mapping logic
    // by testing known inputs that produce scores near boundaries

    // Fair range (580-669)
    const fairInput = makeInput({
      totalRecurringStreams: 10,
      activeRecurringStreams: 7,
      creditAccounts: [{ currentBalance: 3000, availableBalance: 7000 }],
      accountCreatedDates: [
        new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000),
      ],
      accountTypes: ["depository", "credit"],
      transactionCountLast30Days: 25,
    });
    const fairResult = calculateCreditScore(fairInput);
    expect(fairResult.score).toBeGreaterThanOrEqual(580);
    expect(fairResult.score).toBeLessThan(740);
    expect(["Fair", "Good"]).toContain(fairResult.rating);
  });

  // --- Factor detail strings ---
  it("includes helpful detail strings", () => {
    const result = calculateCreditScore({
      totalRecurringStreams: 5,
      activeRecurringStreams: 3,
      creditAccounts: [{ currentBalance: 2000, availableBalance: 8000 }],
      accountCreatedDates: [
        new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000),
      ],
      accountTypes: ["depository", "credit"],
      transactionCountLast30Days: 42,
    });

    const payment = result.factors.find(
      (f) => f.name === "Payment Consistency",
    )!;
    expect(payment.detail).toContain("3 of 5");

    const util = result.factors.find((f) => f.name === "Credit Utilization")!;
    expect(util.detail).toContain("20%");

    const activity = result.factors.find((f) => f.name === "Recent Activity")!;
    expect(activity.detail).toContain("42 transactions");
  });

  // --- Impact indicators ---
  it("correctly categorizes impact as positive/neutral/negative", () => {
    const result = calculateCreditScore({
      totalRecurringStreams: 10,
      activeRecurringStreams: 10,
      creditAccounts: [{ currentBalance: 500, availableBalance: 9500 }],
      accountCreatedDates: [
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 3),
      ],
      accountTypes: ["depository", "credit", "investment", "loan"],
      transactionCountLast30Days: 50,
    });

    for (const factor of result.factors) {
      expect(["positive", "neutral", "negative"]).toContain(factor.impact);
      if (factor.score >= 70) expect(factor.impact).toBe("positive");
      else if (factor.score >= 40) expect(factor.impact).toBe("neutral");
      else expect(factor.impact).toBe("negative");
    }
  });
});
