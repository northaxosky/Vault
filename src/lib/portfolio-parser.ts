import { parseCsvLine } from "./csv-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedPosition {
  accountNumber: string;
  accountName: string;
  ticker: string;
  name: string; // Description column ("MICROSOFT CORP")
  type: string | null; // "stock", "etf", "mutual fund" — inferred from description/ticker
  quantity: number;
  lastPrice: number;
  currentValue: number;
  costBasis: number | null;
  totalGainLoss: number | null;
  totalGainLossPercent: number | null;
}

export interface ParsedCashPosition {
  accountNumber: string;
  accountName: string;
  symbol: string; // "FCASH**", "FDRXX**"
  currentValue: number;
}

export interface PortfolioParseResult {
  positions: ParsedPosition[];
  cashPositions: ParsedCashPosition[];
  accounts: { accountNumber: string; accountName: string }[];
  errors: string[];
  skippedRows: number;
}

// ---------------------------------------------------------------------------
// Fidelity CSV header fingerprint
// ---------------------------------------------------------------------------

const FIDELITY_HEADER_FINGERPRINT = [
  "account number",
  "account name",
  "symbol",
  "description",
  "quantity",
  "last price",
  "current value",
  "cost basis total",
  "type",
];

// ---------------------------------------------------------------------------
// Amount / percent parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a formatted dollar amount: `$52,070.49`, `+$1.97`, `-$1.70`, `$400.33`
 * Strips `$`, `+`, `,` and returns a float. Returns null for empty/invalid.
 */
function parseDollar(raw: string): number | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim().replace(/[$,+\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse a formatted percentage: `-7.32%`, `+0.60%`, `0.57%`
 * Strips `%`, `+` and returns a float. Returns null for empty/invalid.
 */
function parsePercent(raw: string): number | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim().replace(/[%+\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// ---------------------------------------------------------------------------
// Security type inference
// ---------------------------------------------------------------------------

/** Well-known ETF tickers for quick matching */
const KNOWN_ETFS = new Set([
  "VTI",
  "VOO",
  "VT",
  "VEA",
  "VWO",
  "VGT",
  "VIG",
  "VXUS",
  "VYM",
  "VNQ",
  "VB",
  "VO",
  "VTV",
  "VUG",
  "QQQ",
  "QQQM",
  "SPY",
  "IVV",
  "IWM",
  "IWF",
  "IWD",
  "IWB",
  "EFA",
  "EEM",
  "AGG",
  "BND",
  "TLT",
  "LQD",
  "HYG",
  "GLD",
  "SLV",
  "IAU",
  "XLK",
  "XLF",
  "XLE",
  "XLV",
  "XLY",
  "XLI",
  "XLP",
  "XLU",
  "XLB",
  "XLRE",
  "DIA",
  "RSP",
  "ARKK",
  "ARKG",
  "ARKW",
  "SCHD",
  "SCHX",
  "SCHB",
  "SCHA",
  "SCHF",
  "SCHO",
  "SCHZ",
  "JEPI",
  "JEPQ",
]);

/**
 * Infer security type from ticker and description.
 * Returns "stock", "etf", or "mutual fund".
 */
function inferSecurityType(
  ticker: string,
  description: string
): string | null {
  const upperTicker = ticker.toUpperCase();
  const upperDesc = description.toUpperCase();

  // Explicit ETF in description
  if (upperDesc.includes("ETF")) return "etf";

  // Known ETF tickers
  if (KNOWN_ETFS.has(upperTicker)) return "etf";

  // Mutual fund: ticker typically ends in X (or XX) and description mentions "FUND"
  // Fidelity funds: FXAIX, FSKAX, FZROX, FBALX, etc.
  if (/X{1,2}$/.test(upperTicker) && upperDesc.includes("FUND")) {
    return "mutual fund";
  }

  // Additional mutual fund heuristic: Fidelity fund tickers (5 chars ending in X)
  if (upperTicker.length === 5 && upperTicker.endsWith("X")) {
    return "mutual fund";
  }

  // Default — individual equity
  return "stock";
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the given headers look like a Fidelity portfolio positions CSV.
 */
export function detectPortfolioFormat(headers: string[]): boolean {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  return FIDELITY_HEADER_FINGERPRINT.every((fp) => lowerHeaders.includes(fp));
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

/**
 * Parse a Fidelity portfolio positions CSV export into typed investment holdings.
 *
 * Handles:
 * - Multiple accounts in one file (grouped by Account Number + Account Name)
 * - Cash/money-market positions (symbol ending with `**`) → `cashPositions`
 * - Pending activity rows → skipped
 * - Trailing disclaimer text → skipped
 * - Formatted dollar amounts and percentages
 */
export function parsePortfolioCsv(csvText: string): PortfolioParseResult {
  const positions: ParsedPosition[] = [];
  const cashPositions: ParsedCashPosition[] = [];
  const errors: string[] = [];
  let skippedRows = 0;
  const accountMap = new Map<string, { accountNumber: string; accountName: string }>();

  // --- Strip BOM and split lines ---
  const cleaned = csvText.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return {
      positions,
      cashPositions,
      accounts: [],
      errors: ["Empty or invalid CSV file"],
      skippedRows: 0,
    };
  }

  // --- Parse header ---
  const headers = parseCsvLine(lines[0]);

  if (!detectPortfolioFormat(headers)) {
    return {
      positions,
      cashPositions,
      accounts: [],
      errors: [
        "File does not appear to be a Fidelity portfolio positions CSV. " +
          `Expected headers including: ${FIDELITY_HEADER_FINGERPRINT.join(", ")}`,
      ],
      skippedRows: 0,
    };
  }

  // Build header→index map for fast column lookup
  const colIndex = new Map<string, number>();
  for (let i = 0; i < headers.length; i++) {
    colIndex.set(headers[i].trim(), i);
  }

  const col = (row: string[], name: string): string =>
    row[colIndex.get(name) ?? -1] ?? "";

  // --- Process data rows ---
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    let values: string[];
    try {
      values = parseCsvLine(line);
    } catch (e) {
      errors.push(
        `Row ${i + 1}: Failed to parse CSV line — ${e instanceof Error ? e.message : "unknown error"}`
      );
      skippedRows++;
      continue;
    }

    const accountNumber = (values[colIndex.get("Account Number") ?? -1] ?? "").trim();
    const accountName = (values[colIndex.get("Account Name") ?? -1] ?? "").trim();
    const symbol = col(values, "Symbol").trim();
    const description = col(values, "Description").trim();

    // Skip rows with no account number (disclaimer text, empty lines)
    if (!accountNumber) {
      skippedRows++;
      continue;
    }

    // Skip pending activity rows
    if (
      symbol.toLowerCase() === "pending activity" ||
      (!symbol && !description)
    ) {
      skippedRows++;
      continue;
    }

    // Track unique accounts
    const accountKey = `${accountNumber}|${accountName}`;
    if (!accountMap.has(accountKey)) {
      accountMap.set(accountKey, { accountNumber, accountName });
    }

    // Cash / money-market positions (symbol ends with **)
    if (symbol.endsWith("**")) {
      const currentValue = parseDollar(col(values, "Current Value"));
      if (currentValue !== null) {
        cashPositions.push({
          accountNumber,
          accountName,
          symbol,
          currentValue,
        });
      } else {
        errors.push(
          `Row ${i + 1}: Cash position "${symbol}" has no parseable Current Value`
        );
      }
      skippedRows++; // counted as skipped from the positions perspective
      continue;
    }

    // --- Regular security position ---
    try {
      const quantity = parseDollar(col(values, "Quantity")); // quantity isn't dollar-formatted but parseDollar handles plain numbers fine
      const lastPrice = parseDollar(col(values, "Last Price"));
      const currentValue = parseDollar(col(values, "Current Value"));

      if (quantity === null || lastPrice === null || currentValue === null) {
        errors.push(
          `Row ${i + 1}: Position "${symbol}" is missing quantity, price, or value`
        );
        skippedRows++;
        continue;
      }

      const costBasis = parseDollar(col(values, "Cost Basis Total"));
      const totalGainLoss = parseDollar(col(values, "Total Gain/Loss Dollar"));
      const totalGainLossPercent = parsePercent(
        col(values, "Total Gain/Loss Percent")
      );

      positions.push({
        accountNumber,
        accountName,
        ticker: symbol,
        name: description,
        type: inferSecurityType(symbol, description),
        quantity,
        lastPrice,
        currentValue,
        costBasis,
        totalGainLoss,
        totalGainLossPercent,
      });
    } catch (e) {
      errors.push(
        `Row ${i + 1}: ${e instanceof Error ? e.message : "Parse error"}`
      );
      skippedRows++;
    }
  }

  return {
    positions,
    cashPositions,
    accounts: Array.from(accountMap.values()),
    errors,
    skippedRows,
  };
}
