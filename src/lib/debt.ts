// --- Debt payoff calculation utilities ---
// Snowball: pay off smallest balance first.
// Avalanche: pay off highest interest rate first.
// Both redirect freed-up minimums to the next target.

export interface DebtInput {
  name: string;
  balance: number;
  interestRate: number; // annual APR percentage (e.g., 19.99)
  minimumPayment: number;
}

export interface PayoffResult {
  totalMonths: number;
  totalInterestPaid: number;
  debtFreeDate: Date;
}

function simulate(
  debts: DebtInput[],
  extraPayment: number,
  sortFn: (a: DebtInput, b: DebtInput) => number
): PayoffResult {
  if (debts.length === 0) {
    return { totalMonths: 0, totalInterestPaid: 0, debtFreeDate: new Date() };
  }

  // Deep copy and sort
  const working = debts
    .map((d) => ({ ...d, remaining: d.balance }))
    .sort(sortFn);

  let months = 0;
  let totalInterest = 0;
  const MAX_MONTHS = 360; // 30-year cap

  while (working.some((d) => d.remaining > 0) && months < MAX_MONTHS) {
    months++;

    // Apply monthly interest to each debt
    for (const d of working) {
      if (d.remaining <= 0) continue;
      const monthlyRate = d.interestRate / 100 / 12;
      const interest = d.remaining * monthlyRate;
      totalInterest += interest;
      d.remaining += interest;
    }

    // Pay minimums on all debts
    let extraAvailable = extraPayment;
    for (const d of working) {
      if (d.remaining <= 0) continue;
      const payment = Math.min(d.minimumPayment, d.remaining);
      d.remaining -= payment;
      if (d.remaining <= 0) {
        // Debt paid off — its minimum becomes extra for the next target
        extraAvailable += d.minimumPayment - payment;
        d.remaining = 0;
      }
    }

    // Apply extra payment to the first debt with remaining balance
    for (const d of working) {
      if (d.remaining <= 0 || extraAvailable <= 0) continue;
      const payment = Math.min(extraAvailable, d.remaining);
      d.remaining -= payment;
      extraAvailable -= payment;
      if (d.remaining <= 0) {
        extraAvailable += d.minimumPayment;
        d.remaining = 0;
      }
      break; // extra goes to the first target only
    }
  }

  const debtFreeDate = new Date();
  debtFreeDate.setMonth(debtFreeDate.getMonth() + months);

  return {
    totalMonths: months,
    totalInterestPaid: Math.round(totalInterest * 100) / 100,
    debtFreeDate,
  };
}

/** Snowball strategy: pay off smallest balance first */
export function calculateSnowball(
  debts: DebtInput[],
  extraPayment: number = 0
): PayoffResult {
  return simulate(debts, extraPayment, (a, b) => a.balance - b.balance);
}

/** Avalanche strategy: pay off highest interest rate first */
export function calculateAvalanche(
  debts: DebtInput[],
  extraPayment: number = 0
): PayoffResult {
  return simulate(debts, extraPayment, (a, b) => b.interestRate - a.interestRate);
}
