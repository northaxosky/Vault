import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  detectPortfolioFormat,
  parsePortfolioCsv,
} from "@/lib/portfolio-parser";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const fixturesDir = join(__dirname, "../../test/fixtures");
const loadFixture = (name: string) =>
  readFileSync(join(fixturesDir, name), "utf-8");

// ---------------------------------------------------------------------------
// 1. detectPortfolioFormat
// ---------------------------------------------------------------------------

describe("detectPortfolioFormat", () => {
  it("should return true for Fidelity position headers", () => {
    const headers = [
      "Account Number",
      "Account Name",
      "Symbol",
      "Description",
      "Quantity",
      "Last Price",
      "Last Price Change",
      "Current Value",
      "Today's Gain/Loss Dollar",
      "Today's Gain/Loss Percent",
      "Total Gain/Loss Dollar",
      "Total Gain/Loss Percent",
      "Percent Of Account",
      "Cost Basis Total",
      "Average Cost Basis",
      "Type",
    ];
    expect(detectPortfolioFormat(headers)).toBe(true);
  });

  it("should return false for First Tech transaction CSV headers", () => {
    const headers = [
      "Transaction ID",
      "Posting Date",
      "Effective Date",
      "Transaction Type",
      "Amount",
      "Check Number",
      "Reference Number",
      "Description",
      "Transaction Category",
      "Type",
      "Balance",
      "Memo",
      "Extended Description",
    ];
    expect(detectPortfolioFormat(headers)).toBe(false);
  });

  it("should return false for Amex transaction CSV headers", () => {
    const headers = ["Date", "Description", "Amount"];
    expect(detectPortfolioFormat(headers)).toBe(false);
  });

  it("should perform case-insensitive matching", () => {
    const headers = [
      "ACCOUNT NUMBER",
      "ACCOUNT NAME",
      "SYMBOL",
      "DESCRIPTION",
      "QUANTITY",
      "LAST PRICE",
      "CURRENT VALUE",
      "COST BASIS TOTAL",
      "TYPE",
    ];
    expect(detectPortfolioFormat(headers)).toBe(true);
  });

  it("should handle mixed-case headers", () => {
    const headers = [
      "account number",
      "Account Name",
      "SYMBOL",
      "Description",
      "quantity",
      "Last Price",
      "current value",
      "Cost Basis Total",
      "type",
    ];
    expect(detectPortfolioFormat(headers)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. parsePortfolioCsv — Normal equity positions (fixture-based)
// ---------------------------------------------------------------------------

describe("parsePortfolioCsv — equity positions (fixture)", () => {
  const csv = loadFixture("fidelity-positions-sample.csv");
  const result = parsePortfolioCsv(csv);

  it("should parse the fixture file without errors", () => {
    expect(result.errors).toHaveLength(0);
  });

  it("should return 5 equity positions (MSFT, VTI, QQQ, FXAIX, AMZN)", () => {
    expect(result.positions).toHaveLength(5);
    const tickers = result.positions.map((p) => p.ticker);
    expect(tickers).toContain("MSFT");
    expect(tickers).toContain("VTI");
    expect(tickers).toContain("QQQ");
    expect(tickers).toContain("FXAIX");
    expect(tickers).toContain("AMZN");
  });

  it("should have required fields on every position", () => {
    for (const pos of result.positions) {
      expect(pos.ticker).toBeTruthy();
      expect(pos.name).toBeTruthy();
      expect(typeof pos.quantity).toBe("number");
      expect(typeof pos.lastPrice).toBe("number");
      expect(typeof pos.currentValue).toBe("number");
      expect(pos.costBasis).not.toBeNull();
      expect(typeof pos.costBasis).toBe("number");
    }
  });

  it("should parse MSFT correctly: quantity 50, lastPrice 371.04, currentValue 18552, costBasis 20000", () => {
    const msft = result.positions.find((p) => p.ticker === "MSFT")!;
    expect(msft).toBeDefined();
    expect(msft.quantity).toBe(50);
    expect(msft.lastPrice).toBe(371.04);
    expect(msft.currentValue).toBe(18552);
    expect(msft.costBasis).toBe(20000);
  });

  it("should classify VTI as type 'etf'", () => {
    const vti = result.positions.find((p) => p.ticker === "VTI")!;
    expect(vti.type).toBe("etf");
  });

  it("should classify FXAIX as type 'mutual fund'", () => {
    const fxaix = result.positions.find((p) => p.ticker === "FXAIX")!;
    expect(fxaix.type).toBe("mutual fund");
  });

  it("should classify AMZN as type 'stock'", () => {
    const amzn = result.positions.find((p) => p.ticker === "AMZN")!;
    expect(amzn.type).toBe("stock");
  });

  it("should classify QQQ as type 'etf'", () => {
    const qqq = result.positions.find((p) => p.ticker === "QQQ")!;
    expect(qqq.type).toBe("etf");
  });

  it("should classify MSFT as type 'stock'", () => {
    const msft = result.positions.find((p) => p.ticker === "MSFT")!;
    expect(msft.type).toBe("stock");
  });

  it("should parse VTI values correctly", () => {
    const vti = result.positions.find((p) => p.ticker === "VTI")!;
    expect(vti.quantity).toBe(25);
    expect(vti.lastPrice).toBe(325.15);
    expect(vti.currentValue).toBe(8128.75);
    expect(vti.costBasis).toBe(8300);
  });

  it("should parse gain/loss fields for MSFT", () => {
    const msft = result.positions.find((p) => p.ticker === "MSFT")!;
    expect(msft.totalGainLoss).toBe(-1448);
    expect(msft.totalGainLossPercent).toBe(-7.24);
  });

  it("should parse positive gain/loss fields for QQQ", () => {
    const qqq = result.positions.find((p) => p.ticker === "QQQ")!;
    expect(qqq.totalGainLoss).toBe(2512.8);
    expect(qqq.totalGainLossPercent).toBe(11.96);
  });
});

// ---------------------------------------------------------------------------
// 3. Cash positions
// ---------------------------------------------------------------------------

describe("parsePortfolioCsv — cash positions (fixture)", () => {
  const csv = loadFixture("fidelity-positions-sample.csv");
  const result = parsePortfolioCsv(csv);

  it("should capture 3 cash positions (FCASH**, FDRXX** × 2)", () => {
    expect(result.cashPositions).toHaveLength(3);
  });

  it("should have correct symbols for cash positions", () => {
    const symbols = result.cashPositions.map((c) => c.symbol);
    expect(symbols).toContain("FCASH**");
    expect(symbols).toContain("FDRXX**");
  });

  it("should have accountName on each cash position", () => {
    for (const cp of result.cashPositions) {
      expect(cp.accountName).toBeTruthy();
      expect(cp.accountNumber).toBeTruthy();
    }
  });

  it("should parse FCASH** value as 450.25 for ESPP account", () => {
    const fcash = result.cashPositions.find(
      (c) => c.symbol === "FCASH**" && c.accountName === "ESPP Stocks"
    )!;
    expect(fcash).toBeDefined();
    expect(fcash.currentValue).toBe(450.25);
  });

  it("should parse BrokerageLink FDRXX** value as 3200.50", () => {
    const fdrxx = result.cashPositions.find(
      (c) => c.symbol === "FDRXX**" && c.accountName === "BrokerageLink"
    )!;
    expect(fdrxx).toBeDefined();
    expect(fdrxx.currentValue).toBe(3200.5);
  });

  it("should parse HSA FDRXX** value as 275.50", () => {
    const fdrxx = result.cashPositions.find(
      (c) =>
        c.symbol === "FDRXX**" &&
        c.accountName === "Health Savings Account"
    )!;
    expect(fdrxx).toBeDefined();
    expect(fdrxx.currentValue).toBe(275.5);
  });
});

// ---------------------------------------------------------------------------
// 4. Skipped rows
// ---------------------------------------------------------------------------

describe("parsePortfolioCsv — skipped rows (fixture)", () => {
  const csv = loadFixture("fidelity-positions-sample.csv");
  const result = parsePortfolioCsv(csv);

  it("should skip Pending activity rows", () => {
    // The pending activity row should not appear as a position
    const pending = result.positions.find(
      (p) => p.ticker.toLowerCase() === "pending activity"
    );
    expect(pending).toBeUndefined();
  });

  it("should count cash positions and pending activity rows in skippedRows", () => {
    // 3 cash positions + 1 pending activity = 4 skipped rows
    expect(result.skippedRows).toBe(4);
  });

  it("should not include cash symbols in positions array", () => {
    const cashInPositions = result.positions.find(
      (p) => p.ticker.endsWith("**")
    );
    expect(cashInPositions).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Account grouping
// ---------------------------------------------------------------------------

describe("parsePortfolioCsv — account grouping (fixture)", () => {
  const csv = loadFixture("fidelity-positions-sample.csv");
  const result = parsePortfolioCsv(csv);

  it("should detect 3 unique accounts from fixture", () => {
    expect(result.accounts).toHaveLength(3);
  });

  it("should include ESPP Stocks account", () => {
    const espp = result.accounts.find((a) => a.accountName === "ESPP Stocks");
    expect(espp).toBeDefined();
    expect(espp!.accountNumber).toBe("Z12345678");
  });

  it("should include BrokerageLink account", () => {
    const bl = result.accounts.find((a) => a.accountName === "BrokerageLink");
    expect(bl).toBeDefined();
    expect(bl!.accountNumber).toBe("987654321");
  });

  it("should include Health Savings Account", () => {
    const hsa = result.accounts.find(
      (a) => a.accountName === "Health Savings Account"
    );
    expect(hsa).toBeDefined();
    expect(hsa!.accountNumber).toBe("111222333");
  });

  it("should have unique entries (no duplicates)", () => {
    const keys = result.accounts.map(
      (a) => `${a.accountNumber}|${a.accountName}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ---------------------------------------------------------------------------
// 6. Amount parsing (via parsePortfolioCsv — dollar values from fixture)
// ---------------------------------------------------------------------------

describe("parsePortfolioCsv — amount parsing", () => {
  it("should parse dollar amount $52,070.49 correctly", () => {
    const csv = [
      "Account Number,Account Name,Symbol,Description,Quantity,Last Price,Last Price Change,Current Value,Today's Gain/Loss Dollar,Today's Gain/Loss Percent,Total Gain/Loss Dollar,Total Gain/Loss Percent,Percent Of Account,Cost Basis Total,Average Cost Basis,Type",
      '999,TestAcct,TEST,TEST STOCK,100,$520.70,,$52070.49,,,,,,,,Cash',
    ].join("\n");
    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].currentValue).toBe(52070.49);
  });

  it("should parse positive dollar amount +$1.97 in Last Price Change context", () => {
    const csv = loadFixture("fidelity-positions-sample.csv");
    const result = parsePortfolioCsv(csv);
    // VTI has +$1.97 as last price change and totalGainLoss of -$171.25
    const vti = result.positions.find((p) => p.ticker === "VTI")!;
    expect(vti.totalGainLoss).toBe(-171.25);
  });

  it("should parse negative dollar amount -$1.70 correctly", () => {
    const csv = loadFixture("fidelity-positions-sample.csv");
    const result = parsePortfolioCsv(csv);
    const msft = result.positions.find((p) => p.ticker === "MSFT")!;
    // MSFT totalGainLoss = -$1448.00
    expect(msft.totalGainLoss).toBe(-1448);
  });

  it("should parse comma-formatted amounts like $18,552.00", () => {
    const csv = loadFixture("fidelity-positions-sample.csv");
    const result = parsePortfolioCsv(csv);
    const msft = result.positions.find((p) => p.ticker === "MSFT")!;
    expect(msft.currentValue).toBe(18552);
  });
});

// ---------------------------------------------------------------------------
// 7. Empty/invalid CSV
// ---------------------------------------------------------------------------

describe("parsePortfolioCsv — empty/invalid CSV", () => {
  it("should return empty results and error message for empty text", () => {
    const result = parsePortfolioCsv("");
    expect(result.positions).toHaveLength(0);
    expect(result.cashPositions).toHaveLength(0);
    expect(result.accounts).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Empty");
  });

  it("should return empty results for whitespace-only text", () => {
    const result = parsePortfolioCsv("   \n  \n  ");
    expect(result.positions).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should return zero positions for non-portfolio CSV (graceful handling)", () => {
    const transactionCsv = [
      "Date,Description,Amount",
      "03/15/2026,CHICK-FIL-A,26.51",
      "03/14/2026,AMAZON PRIME,14.99",
    ].join("\n");
    const result = parsePortfolioCsv(transactionCsv);
    expect(result.positions).toHaveLength(0);
    expect(result.cashPositions).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("does not appear to be a Fidelity");
  });

  it("should handle a single header line with no data rows", () => {
    const csv =
      "Account Number,Account Name,Symbol,Description,Quantity,Last Price,Current Value,Cost Basis Total,Type";
    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(0);
    // Single line is treated as empty/invalid (< 2 lines)
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Empty or invalid");
  });
});

// ---------------------------------------------------------------------------
// 8. Security type inference
// ---------------------------------------------------------------------------

describe("parsePortfolioCsv — security type inference", () => {
  const csv = loadFixture("fidelity-positions-sample.csv");
  const result = parsePortfolioCsv(csv);

  it("should detect VTI as ETF (known ETF ticker)", () => {
    const vti = result.positions.find((p) => p.ticker === "VTI")!;
    expect(vti.type).toBe("etf");
  });

  it("should detect QQQ as ETF (known ETF ticker)", () => {
    const qqq = result.positions.find((p) => p.ticker === "QQQ")!;
    expect(qqq.type).toBe("etf");
  });

  it("should detect FXAIX as mutual fund (5-char ticker ending in X)", () => {
    const fxaix = result.positions.find((p) => p.ticker === "FXAIX")!;
    expect(fxaix.type).toBe("mutual fund");
  });

  it("should default MSFT to stock", () => {
    const msft = result.positions.find((p) => p.ticker === "MSFT")!;
    expect(msft.type).toBe("stock");
  });

  it("should default AMZN to stock", () => {
    const amzn = result.positions.find((p) => p.ticker === "AMZN")!;
    expect(amzn.type).toBe("stock");
  });
});

// ---------------------------------------------------------------------------
// 9. Inline CSV tests (not fixture-based)
// ---------------------------------------------------------------------------

describe("parsePortfolioCsv — inline CSV tests", () => {
  const HEADER =
    "Account Number,Account Name,Symbol,Description,Quantity,Last Price,Last Price Change,Current Value,Today's Gain/Loss Dollar,Today's Gain/Loss Percent,Total Gain/Loss Dollar,Total Gain/Loss Percent,Percent Of Account,Cost Basis Total,Average Cost Basis,Type";

  it("should parse a single position with all fields", () => {
    const csv = [
      HEADER,
      "ACCT001,My Brokerage,AAPL,APPLE INC,100,$185.50,+$2.10,$18550.00,+$210.00,+1.14%,+$3550.00,+23.67%,100.00%,$15000.00,$150.00,Cash",
    ].join("\n");

    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    const pos = result.positions[0];
    expect(pos.accountNumber).toBe("ACCT001");
    expect(pos.accountName).toBe("My Brokerage");
    expect(pos.ticker).toBe("AAPL");
    expect(pos.name).toBe("APPLE INC");
    expect(pos.type).toBe("stock");
    expect(pos.quantity).toBe(100);
    expect(pos.lastPrice).toBe(185.5);
    expect(pos.currentValue).toBe(18550);
    expect(pos.costBasis).toBe(15000);
    expect(pos.totalGainLoss).toBe(3550);
    expect(pos.totalGainLossPercent).toBe(23.67);
  });

  it("should skip a row with missing quantity", () => {
    const csv = [
      HEADER,
      "ACCT001,My Brokerage,AAPL,APPLE INC,,$185.50,,$18550.00,,,,,,,,Cash",
    ].join("\n");

    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("missing quantity");
  });

  it("should skip a row with missing last price", () => {
    const csv = [
      HEADER,
      "ACCT001,My Brokerage,AAPL,APPLE INC,100,,,$18550.00,,,,,,,,Cash",
    ].join("\n");

    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
  });

  it("should skip a row with missing current value", () => {
    const csv = [
      HEADER,
      "ACCT001,My Brokerage,AAPL,APPLE INC,100,$185.50,,,,,,,,,,Cash",
    ].join("\n");

    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
  });

  it("should handle multiple accounts in inline CSV", () => {
    const csv = [
      HEADER,
      "ACCT001,Brokerage,AAPL,APPLE INC,10,$185.50,,$1855.00,,,,,,,,Cash",
      "ACCT002,IRA,GOOG,ALPHABET INC CL A,5,$140.00,,$700.00,,,,,,,,Cash",
    ].join("\n");

    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(2);
    expect(result.accounts).toHaveLength(2);
    expect(result.accounts.map((a) => a.accountNumber)).toContain("ACCT001");
    expect(result.accounts.map((a) => a.accountNumber)).toContain("ACCT002");
  });

  it("should handle inline cash position", () => {
    const csv = [
      HEADER,
      "ACCT001,Brokerage,SPAXX**,HELD IN MONEY MARKET,,,,$1234.56,,,,,,,,Cash",
    ].join("\n");

    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(0);
    expect(result.cashPositions).toHaveLength(1);
    expect(result.cashPositions[0].symbol).toBe("SPAXX**");
    expect(result.cashPositions[0].currentValue).toBe(1234.56);
  });

  it("should handle BOM-prefixed CSV", () => {
    const csv =
      "\uFEFF" +
      [
        HEADER,
        "ACCT001,Brokerage,AAPL,APPLE INC,10,$185.50,,$1855.00,,,,,,,,Cash",
      ].join("\n");

    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect ETF from description containing 'ETF'", () => {
    const csv = [
      HEADER,
      "ACCT001,Brokerage,ARKB,ARK 21SHARES BITCOIN ETF,50,$60.00,,$3000.00,,,,,,,,Cash",
    ].join("\n");

    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].type).toBe("etf");
  });

  it("should detect mutual fund from 5-char ticker ending in X", () => {
    const csv = [
      HEADER,
      "ACCT001,Brokerage,FBALX,FIDELITY BALANCED FUND,30,$30.00,,$900.00,,,,,,,,Cash",
    ].join("\n");

    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].type).toBe("mutual fund");
  });

  it("should handle cost basis as null when empty", () => {
    const csv = [
      HEADER,
      "ACCT001,Brokerage,AAPL,APPLE INC,10,$185.50,,$1855.00,,,,,,,,Cash",
    ].join("\n");

    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].costBasis).toBeNull();
  });

  it("should skip rows with no account number (disclaimer text)", () => {
    const csv = [
      HEADER,
      "ACCT001,Brokerage,AAPL,APPLE INC,10,$185.50,,$1855.00,,,,,,,,Cash",
      ",,,The data and information in this spreadsheet is for informational purposes only,,,,,,,,,,,,",
    ].join("\n");

    const result = parsePortfolioCsv(csv);
    expect(result.positions).toHaveLength(1);
    expect(result.skippedRows).toBe(1);
  });
});
