import { describe, it, expect } from "vitest";
import {
  parseCsv,
  detectFormat,
  generateTransactionId,
  findDuplicates,
  getAvailableFormats,
} from "@/lib/csv-parser";

// ---------------------------------------------------------------------------
// 1. Format detection
// ---------------------------------------------------------------------------

describe("detectFormat", () => {
  it("should detect First Tech format from headers", () => {
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
    expect(detectFormat(headers)).toBe("first-tech");
  });

  it("should detect Amex format from headers", () => {
    const headers = ["Date", "Description", "Amount"];
    expect(detectFormat(headers)).toBe("amex");
  });

  it("should detect Chase format from headers", () => {
    const headers = [
      "Transaction Date",
      "Post Date",
      "Description",
      "Category",
      "Type",
      "Amount",
      "Memo",
    ];
    expect(detectFormat(headers)).toBe("chase");
  });

  it("should fall back to generic for unknown headers", () => {
    const headers = ["Foo", "Bar", "Baz"];
    expect(detectFormat(headers)).toBe("generic");
  });

  it("should match headers case-insensitively", () => {
    expect(
      detectFormat(["DATE", "DESCRIPTION", "AMOUNT"])
    ).toBe("amex");

    expect(
      detectFormat([
        "TRANSACTION DATE",
        "POST DATE",
        "DESCRIPTION",
        "CATEGORY",
        "TYPE",
        "AMOUNT",
      ])
    ).toBe("chase");
  });

  it("should match headers with leading/trailing whitespace", () => {
    const headers = [" Date ", " Description ", " Amount "];
    expect(detectFormat(headers)).toBe("amex");
  });
});

// ---------------------------------------------------------------------------
// 2. First Tech parsing
// ---------------------------------------------------------------------------

describe("parseCsv — First Tech format", () => {
  const firstTechCsv = [
    '"Transaction ID","Posting Date","Effective Date","Transaction Type","Amount","Check Number","Reference Number","Description","Transaction Category","Type","Balance","Memo","Extended Description"',
    '"123","3/23/2026","3/23/2026","Debit","-45.00","","","UBER EATS","Shopping","Debit Card","955.00","","UBER EATS"',
    '"124","3/20/2026","3/20/2026","Credit","1500.00","","","ACH Deposit PAYROLL","","Deposit","1000.00","","ACH Deposit PAYROLL"',
  ].join("\n");

  it("should parse a valid First Tech CSV with multiple rows", () => {
    const result = parseCsv(firstTechCsv);
    expect(result.format).toBe("first-tech");
    expect(result.transactions).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.skippedRows).toBe(0);
  });

  it("should flip sign: negative amount → positive (spending)", () => {
    const result = parseCsv(firstTechCsv);
    // -45.00 → +45.00 (spending)
    expect(result.transactions[0].amount).toBe(45);
  });

  it("should flip sign: positive amount → negative (income)", () => {
    const result = parseCsv(firstTechCsv);
    // 1500.00 → -1500.00 (income)
    expect(result.transactions[1].amount).toBe(-1500);
  });

  it("should extract category from Transaction Category column", () => {
    const result = parseCsv(firstTechCsv);
    // "Shopping" → "GENERAL_MERCHANDISE"
    expect(result.transactions[0].category).toBe("GENERAL_MERCHANDISE");
  });

  it("should fall back to Type for category when Transaction Category is empty", () => {
    const result = parseCsv(firstTechCsv);
    // "Deposit" → "INCOME"
    expect(result.transactions[1].category).toBe("INCOME");
  });

  it("should extract balance from Balance column", () => {
    const result = parseCsv(firstTechCsv);
    expect(result.transactions[0].balance).toBe(955);
    expect(result.transactions[1].balance).toBe(1000);
  });

  it("should populate name from Description", () => {
    const result = parseCsv(firstTechCsv);
    expect(result.transactions[0].name).toBe("UBER EATS");
    expect(result.transactions[1].name).toBe("ACH Deposit PAYROLL");
  });

  it("should skip rows with missing date", () => {
    const csv = [
      '"Transaction ID","Posting Date","Effective Date","Transaction Type","Amount","Check Number","Reference Number","Description","Transaction Category","Type","Balance","Memo","Extended Description"',
      '"999","","","Debit","-10.00","","","GROCERY STORE","Shopping","Debit Card","500.00","","GROCERY STORE"',
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
  });

  it("should skip rows with missing amount", () => {
    const csv = [
      '"Transaction ID","Posting Date","Effective Date","Transaction Type","Amount","Check Number","Reference Number","Description","Transaction Category","Type","Balance","Memo","Extended Description"',
      '"999","3/23/2026","3/23/2026","Debit","","","","GROCERY STORE","Shopping","Debit Card","500.00","","GROCERY STORE"',
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
  });

  it("should skip rows with missing description", () => {
    const csv = [
      '"Transaction ID","Posting Date","Effective Date","Transaction Type","Amount","Check Number","Reference Number","Description","Transaction Category","Type","Balance","Memo","Extended Description"',
      '"999","3/23/2026","3/23/2026","Debit","-10.00","","","","Shopping","Debit Card","500.00","",""',
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Amex parsing
// ---------------------------------------------------------------------------

describe("parseCsv — Amex format", () => {
  const amexCsv = [
    "Date,Description,Amount",
    "03/21/2026,AplPay CHICK-FIL-A #KIRKLAND WA,26.51",
    "03/20/2026,AplPay STARBUCKS STORE BELLEVUE WA,12.37",
  ].join("\n");

  it("should parse valid Amex CSV", () => {
    const result = parseCsv(amexCsv);
    expect(result.format).toBe("amex");
    expect(result.transactions).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.skippedRows).toBe(0);
  });

  it("should keep amounts in correct convention (positive = spending)", () => {
    const result = parseCsv(amexCsv);
    expect(result.transactions[0].amount).toBe(26.51);
    expect(result.transactions[1].amount).toBe(12.37);
  });

  it("should return null category for Amex transactions", () => {
    const result = parseCsv(amexCsv);
    expect(result.transactions[0].category).toBeNull();
    expect(result.transactions[1].category).toBeNull();
  });

  it("should return null balance for Amex transactions", () => {
    const result = parseCsv(amexCsv);
    expect(result.transactions[0].balance).toBeNull();
    expect(result.transactions[1].balance).toBeNull();
  });

  it("should parse descriptions correctly", () => {
    const result = parseCsv(amexCsv);
    expect(result.transactions[0].name).toBe(
      "AplPay CHICK-FIL-A #KIRKLAND WA"
    );
    expect(result.transactions[1].name).toBe(
      "AplPay STARBUCKS STORE BELLEVUE WA"
    );
  });

  it("should parse dates correctly", () => {
    const result = parseCsv(amexCsv);
    expect(result.transactions[0].date).toEqual(new Date(2026, 2, 21));
    expect(result.transactions[1].date).toEqual(new Date(2026, 2, 20));
  });
});

// ---------------------------------------------------------------------------
// 4. Chase parsing
// ---------------------------------------------------------------------------

describe("parseCsv — Chase format", () => {
  const chaseCsv = [
    "Transaction Date,Post Date,Description,Category,Type,Amount,Memo",
    "03/15/2026,03/16/2026,TRADER JOES,Groceries,Sale,-52.18,",
    "03/10/2026,03/11/2026,PAYMENT RECEIVED,,Payment,500.00,",
  ].join("\n");

  it("should detect and parse Chase CSV", () => {
    const result = parseCsv(chaseCsv);
    expect(result.format).toBe("chase");
    expect(result.transactions).toHaveLength(2);
  });

  it("should flip sign: negative → positive (spending)", () => {
    const result = parseCsv(chaseCsv);
    // Chase: -52.18 → flip → 52.18 (spending)
    expect(result.transactions[0].amount).toBe(52.18);
  });

  it("should flip sign: positive → negative (income)", () => {
    const result = parseCsv(chaseCsv);
    // Chase: 500.00 → flip → -500.00 (income)
    expect(result.transactions[1].amount).toBe(-500);
  });

  it("should map Chase category 'Groceries' to FOOD_AND_DRINK", () => {
    const result = parseCsv(chaseCsv);
    expect(result.transactions[0].category).toBe("FOOD_AND_DRINK");
  });
});

// ---------------------------------------------------------------------------
// 5. Generic parsing
// ---------------------------------------------------------------------------

describe("parseCsv — Generic format", () => {
  it("should handle generic Date,Description,Amount format with override", () => {
    const csv = [
      "Date,Description,Amount",
      "2026-03-15,Coffee Shop,4.50",
      "2026-03-16,Gas Station,35.00",
    ].join("\n");
    // Note: Date,Description,Amount matches Amex fingerprint, so use override
    const result = parseCsv(csv, "generic");
    expect(result.format).toBe("generic");
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].name).toBe("Coffee Shop");
    expect(result.transactions[0].amount).toBe(4.5);
  });

  it("should handle Date,Name,Amount columns", () => {
    const csv = [
      "Date,Name,Amount",
      "2026-01-10,Grocery Store,55.00",
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].name).toBe("Grocery Store");
    expect(result.transactions[0].amount).toBe(55);
  });

  it("should return null category when no category column exists", () => {
    const csv = [
      "Date,Name,Amount",
      "2026-01-10,Grocery Store,55.00",
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions[0].category).toBeNull();
  });

  it("should map category when a Category column is present", () => {
    const csv = [
      "Date,Description,Amount,Category",
      "2026-01-10,SHELL GAS,40.00,Gas",
    ].join("\n");
    // With "Category" column but doesn't match Amex (which needs exactly Date,Description,Amount)
    // Actually "Gas" → "TRANSPORTATION"
    const result = parseCsv(csv, "generic");
    expect(result.transactions[0].category).toBe("TRANSPORTATION");
  });
});

// ---------------------------------------------------------------------------
// 6. Edge cases
// ---------------------------------------------------------------------------

describe("parseCsv — edge cases", () => {
  it("should return empty transactions and error for empty CSV text", () => {
    const result = parseCsv("");
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toContain("Empty or invalid CSV file");
  });

  it("should return empty transactions and error for header-only CSV", () => {
    const result = parseCsv("Date,Description,Amount\n");
    expect(result.transactions).toHaveLength(0);
  });

  it("should handle BOM character at start of file", () => {
    const csv =
      "\uFEFFDate,Description,Amount\n03/21/2026,STARBUCKS,5.25";
    const result = parseCsv(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].name).toBe("STARBUCKS");
    expect(result.transactions[0].amount).toBe(5.25);
  });

  it("should handle quoted fields with commas inside", () => {
    const csv = [
      "Date,Description,Amount",
      '03/15/2026,"Doe, John",50.00',
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].name).toBe("Doe, John");
  });

  it("should handle escaped quotes inside quoted fields", () => {
    const csv = [
      "Date,Description,Amount",
      '03/15/2026,"He said ""hello""",50.00',
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].name).toBe('He said "hello"');
  });

  it("should skip empty rows between data rows", () => {
    const csv = [
      "Date,Description,Amount",
      "03/15/2026,Coffee,4.00",
      "",
      "",
      "03/16/2026,Lunch,12.00",
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions).toHaveLength(2);
  });

  it("should parse amounts with dollar sign and commas", () => {
    const csv = [
      "Date,Description,Amount",
      '03/15/2026,Big Purchase,"$1,234.56"',
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBe(1234.56);
  });

  it("should handle Windows-style CRLF line endings", () => {
    const csv =
      "Date,Description,Amount\r\n03/21/2026,STARBUCKS,5.25\r\n03/22/2026,SUBWAY,8.00";
    const result = parseCsv(csv);
    expect(result.transactions).toHaveLength(2);
  });

  it("should respect format override", () => {
    // These headers match Amex but we force generic
    const csv = "Date,Description,Amount\n03/15/2026,Test,10.00";
    const result = parseCsv(csv, "generic");
    expect(result.format).toBe("generic");
    expect(result.transactions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 7. Duplicate detection
// ---------------------------------------------------------------------------

describe("generateTransactionId", () => {
  it("should produce the same ID for the same inputs (deterministic)", () => {
    const date = new Date(2026, 2, 15);
    const id1 = generateTransactionId("acc1", date, 45, "UBER EATS");
    const id2 = generateTransactionId("acc1", date, 45, "UBER EATS");
    expect(id1).toBe(id2);
  });

  it("should produce different IDs for different amounts", () => {
    const date = new Date(2026, 2, 15);
    const id1 = generateTransactionId("acc1", date, 45, "UBER EATS");
    const id2 = generateTransactionId("acc1", date, 46, "UBER EATS");
    expect(id1).not.toBe(id2);
  });

  it("should produce different IDs for different dates", () => {
    const date1 = new Date(2026, 2, 15);
    const date2 = new Date(2026, 2, 16);
    const id1 = generateTransactionId("acc1", date1, 45, "UBER EATS");
    const id2 = generateTransactionId("acc1", date2, 45, "UBER EATS");
    expect(id1).not.toBe(id2);
  });

  it("should produce different IDs for different account IDs", () => {
    const date = new Date(2026, 2, 15);
    const id1 = generateTransactionId("acc1", date, 45, "UBER EATS");
    const id2 = generateTransactionId("acc2", date, 45, "UBER EATS");
    expect(id1).not.toBe(id2);
  });

  it("should produce different IDs for different names", () => {
    const date = new Date(2026, 2, 15);
    const id1 = generateTransactionId("acc1", date, 45, "UBER EATS");
    const id2 = generateTransactionId("acc1", date, 45, "LYFT");
    expect(id1).not.toBe(id2);
  });

  it("should start with csv_ prefix", () => {
    const id = generateTransactionId(
      "acc1",
      new Date(2026, 0, 1),
      10,
      "Test"
    );
    expect(id).toMatch(/^csv_[a-f0-9]{24}$/);
  });

  it("should be case-insensitive on name", () => {
    const date = new Date(2026, 2, 15);
    const id1 = generateTransactionId("acc1", date, 45, "UBER EATS");
    const id2 = generateTransactionId("acc1", date, 45, "uber eats");
    expect(id1).toBe(id2);
  });
});

describe("findDuplicates", () => {
  it("should identify and filter duplicates", () => {
    const csv = [
      "Date,Description,Amount",
      "03/15/2026,Coffee,4.00",
      "03/16/2026,Lunch,12.00",
    ].join("\n");
    const { transactions } = parseCsv(csv);

    // Pre-compute the ID for the first transaction so it's "existing"
    const existingId = generateTransactionId(
      "acc1",
      transactions[0].date,
      transactions[0].amount,
      transactions[0].name
    );
    const existingIds = new Set([existingId]);

    const { unique, duplicateCount } = findDuplicates(
      transactions,
      "acc1",
      existingIds
    );
    expect(duplicateCount).toBe(1);
    expect(unique).toHaveLength(1);
    expect(unique[0].name).toBe("Lunch");
  });

  it("should preserve all transactions when there are no duplicates", () => {
    const csv = [
      "Date,Description,Amount",
      "03/15/2026,Coffee,4.00",
      "03/16/2026,Lunch,12.00",
    ].join("\n");
    const { transactions } = parseCsv(csv);

    const { unique, duplicateCount } = findDuplicates(
      transactions,
      "acc1",
      new Set()
    );
    expect(duplicateCount).toBe(0);
    expect(unique).toHaveLength(2);
  });

  it("should filter all transactions when all are duplicates", () => {
    const csv = [
      "Date,Description,Amount",
      "03/15/2026,Coffee,4.00",
      "03/16/2026,Lunch,12.00",
    ].join("\n");
    const { transactions } = parseCsv(csv);

    const existingIds = new Set(
      transactions.map((t) =>
        generateTransactionId("acc1", t.date, t.amount, t.name)
      )
    );

    const { unique, duplicateCount } = findDuplicates(
      transactions,
      "acc1",
      existingIds
    );
    expect(duplicateCount).toBe(2);
    expect(unique).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Category mapping
// ---------------------------------------------------------------------------

describe("category mapping via parseCsv", () => {
  it('should map First Tech "Shopping" → "GENERAL_MERCHANDISE"', () => {
    const csv = [
      '"Transaction ID","Posting Date","Effective Date","Transaction Type","Amount","Check Number","Reference Number","Description","Transaction Category","Type","Balance","Memo","Extended Description"',
      '"1","3/1/2026","3/1/2026","Debit","-10.00","","","STORE","Shopping","Debit Card","100.00","","STORE"',
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions[0].category).toBe("GENERAL_MERCHANDISE");
  });

  it('should map First Tech "Transfer" → "TRANSFER_OUT"', () => {
    const csv = [
      '"Transaction ID","Posting Date","Effective Date","Transaction Type","Amount","Check Number","Reference Number","Description","Transaction Category","Type","Balance","Memo","Extended Description"',
      '"1","3/1/2026","3/1/2026","Debit","-100.00","","","TRANSFER TO SAVINGS","Transfer","Debit Card","900.00","","TRANSFER TO SAVINGS"',
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions[0].category).toBe("TRANSFER_OUT");
  });

  it('should map First Tech type "Deposit" → "INCOME"', () => {
    const csv = [
      '"Transaction ID","Posting Date","Effective Date","Transaction Type","Amount","Check Number","Reference Number","Description","Transaction Category","Type","Balance","Memo","Extended Description"',
      '"1","3/1/2026","3/1/2026","Credit","500.00","","","PAYCHECK","","Deposit","1500.00","","PAYCHECK"',
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions[0].category).toBe("INCOME");
  });

  it('should map First Tech type "Interest" → "INCOME"', () => {
    const csv = [
      '"Transaction ID","Posting Date","Effective Date","Transaction Type","Amount","Check Number","Reference Number","Description","Transaction Category","Type","Balance","Memo","Extended Description"',
      '"1","3/1/2026","3/1/2026","Credit","1.50","","","INTEREST PAYMENT","","Interest","1001.50","","INTEREST PAYMENT"',
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions[0].category).toBe("INCOME");
  });

  it("should return null for unknown categories", () => {
    const csv = [
      '"Transaction ID","Posting Date","Effective Date","Transaction Type","Amount","Check Number","Reference Number","Description","Transaction Category","Type","Balance","Memo","Extended Description"',
      '"1","3/1/2026","3/1/2026","Debit","-20.00","","","MYSTERY SHOP","Nonexistent Category","Debit Card","980.00","","MYSTERY SHOP"',
    ].join("\n");
    const result = parseCsv(csv);
    expect(result.transactions[0].category).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 9. getAvailableFormats
// ---------------------------------------------------------------------------

describe("getAvailableFormats", () => {
  it("should return all format presets with id and label", () => {
    const formats = getAvailableFormats();
    expect(formats.length).toBeGreaterThanOrEqual(4);

    const ids = formats.map((f) => f.id);
    expect(ids).toContain("first-tech");
    expect(ids).toContain("amex");
    expect(ids).toContain("chase");
    expect(ids).toContain("generic");
  });

  it("should include correct labels", () => {
    const formats = getAvailableFormats();
    const map = Object.fromEntries(formats.map((f) => [f.id, f.label]));
    expect(map["first-tech"]).toBe("First Tech Credit Union");
    expect(map["amex"]).toBe("American Express");
    expect(map["chase"]).toBe("Chase");
    expect(map["generic"]).toBe("Generic CSV");
  });

  it("should return objects with only id and label properties", () => {
    const formats = getAvailableFormats();
    for (const fmt of formats) {
      expect(Object.keys(fmt).sort()).toEqual(["id", "label"]);
    }
  });
});
