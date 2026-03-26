import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedTransaction {
  date: Date;
  name: string;
  merchantName: string | null;
  amount: number; // positive = spending, negative = income (app convention)
  category: string | null; // CATEGORY_CONFIG key or null
  balance: number | null;
  rawRow: Record<string, string>;
}

export interface CsvParseResult {
  transactions: ParsedTransaction[];
  format: CsvFormatId;
  errors: string[];
  skippedRows: number;
}

export type CsvFormatId = "first-tech" | "amex" | "chase" | "generic";

interface CsvFormat {
  id: CsvFormatId;
  label: string;
  /** Header patterns to match (case-insensitive, must all be present) */
  headerFingerprint: string[];
  /** Map raw CSV row to ParsedTransaction */
  parse(row: Record<string, string>): ParsedTransaction | null;
}

// ---------------------------------------------------------------------------
// Category mapping — bank categories → CATEGORY_CONFIG keys
// ---------------------------------------------------------------------------

const CATEGORY_MAP: Record<string, string> = {
  // First Tech "Transaction Category" values
  shopping: "GENERAL_MERCHANDISE",
  transfer: "TRANSFER_OUT",
  // First Tech "Type" values used as fallback
  interest: "INCOME",
  deposit: "INCOME",
  // Chase categories
  "food & drink": "FOOD_AND_DRINK",
  groceries: "FOOD_AND_DRINK",
  "gas": "TRANSPORTATION",
  "travel": "TRAVEL",
  entertainment: "ENTERTAINMENT",
  "bills & utilities": "RENT_AND_UTILITIES",
  "personal care": "PERSONAL_CARE",
  "home": "RENT_AND_UTILITIES",
  automotive: "TRANSPORTATION",
  "health & wellness": "PERSONAL_CARE",
  "professional services": "GENERAL_MERCHANDISE",
  education: "GENERAL_MERCHANDISE",
  gifts: "GENERAL_MERCHANDISE",
};

function mapCategory(
  bankCategory: string | null | undefined,
  bankType: string | null | undefined
): string | null {
  if (bankCategory) {
    const mapped = CATEGORY_MAP[bankCategory.toLowerCase().trim()];
    if (mapped) return mapped;
  }
  if (bankType) {
    const mapped = CATEGORY_MAP[bankType.toLowerCase().trim()];
    if (mapped) return mapped;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

function parseDate(dateStr: string): Date | null {
  if (!dateStr?.trim()) return null;
  const s = dateStr.trim();

  // M/D/YYYY or MM/DD/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }

  // YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }

  // Fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Amount parsing
// ---------------------------------------------------------------------------

function parseAmount(amountStr: string): number | null {
  if (!amountStr?.trim()) return null;
  // Remove currency symbols, commas, spaces
  const cleaned = amountStr.trim().replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// ---------------------------------------------------------------------------
// Format presets
// ---------------------------------------------------------------------------

const FIRST_TECH_FORMAT: CsvFormat = {
  id: "first-tech",
  label: "First Tech Credit Union",
  headerFingerprint: ["transaction id", "posting date", "effective date", "transaction type", "extended description"],
  parse(row) {
    const date = parseDate(row["Posting Date"]);
    const amount = parseAmount(row["Amount"]);
    if (!date || amount === null) return null;

    const description = (row["Description"] || row["Extended Description"] || "").trim();
    if (!description) return null;

    return {
      date,
      name: description,
      merchantName: null,
      // First Tech: negative = debit (spending), positive = credit (income)
      // App convention: positive = spending, negative = income → flip sign
      amount: -amount,
      category: mapCategory(row["Transaction Category"], row["Type"]),
      balance: parseAmount(row["Balance"]),
      rawRow: row,
    };
  },
};

const AMEX_FORMAT: CsvFormat = {
  id: "amex",
  label: "American Express",
  headerFingerprint: ["date", "description", "amount"],
  parse(row) {
    const date = parseDate(row["Date"]);
    const amount = parseAmount(row["Amount"]);
    if (!date || amount === null) return null;

    const description = (row["Description"] || "").trim();
    if (!description) return null;

    return {
      date,
      name: description,
      merchantName: null,
      // Amex: positive = charges (spending), negative = credits/payments (income)
      // Matches app convention already
      amount,
      category: null,
      balance: null,
      rawRow: row,
    };
  },
};

const CHASE_FORMAT: CsvFormat = {
  id: "chase",
  label: "Chase",
  headerFingerprint: ["transaction date", "post date", "description", "category", "type", "amount"],
  parse(row) {
    const date = parseDate(row["Transaction Date"] || row["Posting Date"]);
    const amount = parseAmount(row["Amount"]);
    if (!date || amount === null) return null;

    const description = (row["Description"] || "").trim();
    if (!description) return null;

    return {
      date,
      name: description,
      merchantName: null,
      // Chase: negative = spending, positive = income → flip sign
      amount: -amount,
      category: mapCategory(row["Category"], null),
      balance: null,
      rawRow: row,
    };
  },
};

const GENERIC_FORMAT: CsvFormat = {
  id: "generic",
  label: "Generic CSV",
  headerFingerprint: [], // fallback — no fingerprint needed
  parse(row) {
    // Try common column name variations
    const dateStr = row["Date"] || row["date"] || row["Transaction Date"] || row["Posting Date"];
    const date = parseDate(dateStr);
    if (!date) return null;

    const description =
      (row["Description"] || row["description"] || row["Name"] || row["name"] || row["Memo"] || row["memo"] || "").trim();
    if (!description) return null;

    const amountStr = row["Amount"] || row["amount"] || row["Debit"] || row["debit"];
    const amount = parseAmount(amountStr);
    if (amount === null) return null;

    const balanceStr = row["Balance"] || row["balance"];
    const categoryStr = row["Category"] || row["category"];

    return {
      date,
      name: description,
      merchantName: null,
      // Generic: assume positive = spending (most common), negative = income
      amount,
      category: categoryStr ? mapCategory(categoryStr, null) : null,
      balance: balanceStr ? parseAmount(balanceStr) : null,
      rawRow: row,
    };
  },
};

// Order matters — specific formats first, generic last
const FORMATS: CsvFormat[] = [FIRST_TECH_FORMAT, CHASE_FORMAT, AMEX_FORMAT, GENERIC_FORMAT];

// ---------------------------------------------------------------------------
// CSV text parser
// ---------------------------------------------------------------------------

export function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip BOM
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

/** Parse a single CSV line, handling quoted fields with commas and escaped quotes */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

export function detectFormat(headers: string[]): CsvFormatId {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const fmt of FORMATS) {
    if (fmt.headerFingerprint.length === 0) continue;
    const allMatch = fmt.headerFingerprint.every((fp) => lowerHeaders.includes(fp));
    if (allMatch) return fmt.id;
  }

  return "generic";
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

export function parseCsv(
  csvText: string,
  formatOverride?: CsvFormatId
): CsvParseResult {
  const { headers, rows } = parseCsvText(csvText);
  const errors: string[] = [];

  if (headers.length === 0) {
    return { transactions: [], format: "generic", errors: ["Empty or invalid CSV file"], skippedRows: 0 };
  }

  const formatId = formatOverride ?? detectFormat(headers);
  const format = FORMATS.find((f) => f.id === formatId) ?? GENERIC_FORMAT;

  const transactions: ParsedTransaction[] = [];
  let skippedRows = 0;

  for (let i = 0; i < rows.length; i++) {
    try {
      const parsed = format.parse(rows[i]);
      if (parsed) {
        transactions.push(parsed);
      } else {
        skippedRows++;
      }
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : "Parse error"}`);
      skippedRows++;
    }
  }

  return { transactions, format: formatId, errors, skippedRows };
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/** Generate a deterministic ID for a CSV transaction to detect duplicates */
export function generateTransactionId(
  accountId: string,
  date: Date,
  amount: number,
  name: string
): string {
  const key = `${accountId}|${date.toISOString().split("T")[0]}|${amount.toFixed(2)}|${name.trim().toLowerCase()}`;
  return `csv_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
}

/** Find duplicates between parsed transactions and existing transaction IDs */
export function findDuplicates(
  parsed: ParsedTransaction[],
  accountId: string,
  existingIds: Set<string>
): { unique: ParsedTransaction[]; duplicateCount: number } {
  const unique: ParsedTransaction[] = [];
  let duplicateCount = 0;

  for (const txn of parsed) {
    const id = generateTransactionId(accountId, txn.date, txn.amount, txn.name);
    if (existingIds.has(id)) {
      duplicateCount++;
    } else {
      unique.push(txn);
    }
  }

  return { unique, duplicateCount };
}

// ---------------------------------------------------------------------------
// Available formats for UI
// ---------------------------------------------------------------------------

export function getAvailableFormats(): { id: CsvFormatId; label: string }[] {
  return FORMATS.map((f) => ({ id: f.id, label: f.label }));
}
