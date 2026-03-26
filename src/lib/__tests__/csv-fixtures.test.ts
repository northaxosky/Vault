import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseCsv, detectFormat, parseCsvText } from "@/lib/csv-parser";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const fixturesDir = join(__dirname, "../../test/fixtures");
const loadFixture = (name: string) =>
  readFileSync(join(fixturesDir, name), "utf-8");

/** Format a Date as YYYY-MM-DD in local time (avoids timezone issues) */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// First Tech fixture
// ---------------------------------------------------------------------------

describe("First Tech fixture (first-tech-sample.csv)", () => {
  const csv = loadFixture("first-tech-sample.csv");
  const result = parseCsv(csv);

  it("should auto-detect format as first-tech", () => {
    expect(result.format).toBe("first-tech");
  });

  it("should parse all 12 rows with 0 skipped and 0 errors", () => {
    expect(result.transactions).toHaveLength(12);
    expect(result.skippedRows).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should parse first row: date 2026-03-15, name contains PAYROLL, amount -3250", () => {
    const first = result.transactions[0];
    expect(toDateStr(first.date)).toBe("2026-03-15");
    expect(first.name).toContain("PAYROLL");
    expect(first.amount).toBe(-3250);
  });

  it("should parse rent row with amount 1800 (spending, positive in app convention)", () => {
    const rent = result.transactions.find((t) => t.name.includes("RENT"));
    expect(rent).toBeDefined();
    // Original was -1800 debit → sign-flipped to +1800 spending
    expect(rent!.amount).toBe(1800);
  });

  it("should map Shopping rows to GENERAL_MERCHANDISE category", () => {
    const shopping = result.transactions.filter(
      (t) => t.category === "GENERAL_MERCHANDISE"
    );
    expect(shopping.length).toBeGreaterThanOrEqual(2);
    expect(shopping.some((t) => t.name.includes("WHOLE FOODS"))).toBe(true);
    expect(shopping.some((t) => t.name.includes("TARGET"))).toBe(true);
  });

  it("should map Transfer rows to TRANSFER_OUT category", () => {
    const transfers = result.transactions.filter(
      (t) => t.category === "TRANSFER_OUT"
    );
    // Row 6 (Deposit Transfer From) and Row 9 (PAYPAL INSTANT TRANSFER)
    expect(transfers).toHaveLength(2);
  });

  it("should map Credit Dividend (Interest type) to INCOME category", () => {
    const interest = result.transactions.find((t) =>
      t.name.includes("Credit Dividend")
    );
    expect(interest).toBeDefined();
    expect(interest!.category).toBe("INCOME");
  });

  it("should have balance values present and correct", () => {
    const first = result.transactions[0];
    expect(first.balance).toBe(8250);

    const rent = result.transactions.find((t) => t.name.includes("RENT"));
    expect(rent!.balance).toBe(5000);

    // Every First Tech transaction must have a non-null balance
    for (const t of result.transactions) {
      expect(t.balance).not.toBeNull();
      expect(typeof t.balance).toBe("number");
    }
  });

  it("should correctly sign-flip amounts (First Tech negative=debit → positive=spending)", () => {
    // Debit -87.32 → spending +87.32
    const wholefoods = result.transactions.find((t) =>
      t.name.includes("WHOLE FOODS")
    );
    expect(wholefoods!.amount).toBe(87.32);

    // Credit 3250 → income -3250
    const payroll = result.transactions.find((t) =>
      t.name.includes("PAYROLL")
    );
    expect(payroll!.amount).toBe(-3250);

    // Credit 0.02 (interest) → income -0.02
    const dividend = result.transactions.find((t) =>
      t.name.includes("Credit Dividend")
    );
    expect(dividend!.amount).toBe(-0.02);
  });
});

// ---------------------------------------------------------------------------
// Amex fixture
// ---------------------------------------------------------------------------

describe("Amex fixture (amex-sample.csv)", () => {
  const csv = loadFixture("amex-sample.csv");
  const result = parseCsv(csv);

  it("should auto-detect format as amex", () => {
    expect(result.format).toBe("amex");
  });

  it("should parse all 12 rows with 0 skipped and 0 errors", () => {
    expect(result.transactions).toHaveLength(12);
    expect(result.skippedRows).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should parse first row: date 2026-03-15, name contains CHICK-FIL-A, amount 26.51", () => {
    const first = result.transactions[0];
    expect(toDateStr(first.date)).toBe("2026-03-15");
    expect(first.name).toContain("CHICK-FIL-A");
    expect(first.amount).toBe(26.51);
  });

  it("should parse payment row with amount -1500 (negative = payment/credit)", () => {
    const payment = result.transactions.find((t) =>
      t.name.includes("PAYMENT")
    );
    expect(payment).toBeDefined();
    expect(payment!.amount).toBe(-1500);
  });

  it("should have null categories for all transactions (Amex has no category column)", () => {
    for (const t of result.transactions) {
      expect(t.category).toBeNull();
    }
  });

  it("should have null balances for all transactions", () => {
    for (const t of result.transactions) {
      expect(t.balance).toBeNull();
    }
  });

  it("should have 11 spending transactions (positive) and 1 payment (negative)", () => {
    const spending = result.transactions.filter((t) => t.amount > 0);
    const payments = result.transactions.filter((t) => t.amount < 0);
    expect(spending).toHaveLength(11);
    expect(payments).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Fidelity positions fixture (wrong file type — portfolio, not transactions)
// ---------------------------------------------------------------------------

describe("Fidelity fixture (fidelity-positions-sample.csv)", () => {
  const csv = loadFixture("fidelity-positions-sample.csv");

  it("should detect as generic format since headers don't match any transaction preset", () => {
    const { headers } = parseCsvText(csv);
    expect(detectFormat(headers)).toBe("generic");
  });

  it("should parse zero valid transactions from portfolio data", () => {
    const result = parseCsv(csv);
    // Portfolio columns lack Date/Amount in expected positions,
    // so the generic parser should skip all rows
    expect(result.transactions).toHaveLength(0);
    expect(result.format).toBe("generic");
  });

  it("should not throw errors when parsing wrong file type", () => {
    const result = parseCsv(csv);
    expect(result.errors).toHaveLength(0);
    // All rows are skipped (no crash, no thrown errors)
    expect(result.skippedRows).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-fixture tests
// ---------------------------------------------------------------------------

describe("Cross-fixture tests", () => {
  const fixtures = [
    { file: "first-tech-sample.csv", expectedFormat: "first-tech" as const },
    { file: "amex-sample.csv", expectedFormat: "amex" as const },
    {
      file: "fidelity-positions-sample.csv",
      expectedFormat: "generic" as const,
    },
  ];

  for (const { file, expectedFormat } of fixtures) {
    it(`should detect ${file} headers as "${expectedFormat}" format`, () => {
      const csv = loadFixture(file);
      const { headers } = parseCsvText(csv);
      expect(detectFormat(headers)).toBe(expectedFormat);
    });

    it(`should not crash the parser when processing ${file}`, () => {
      const csv = loadFixture(file);
      expect(() => parseCsv(csv)).not.toThrow();
      const result = parseCsv(csv);
      expect(result).toBeDefined();
      expect(Array.isArray(result.transactions)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  }
});
