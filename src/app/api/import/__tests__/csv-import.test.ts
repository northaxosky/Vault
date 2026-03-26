/**
 * @vitest-environment node
 *
 * We use the `node` environment (not jsdom) because these are server-side
 * API route tests.  jsdom replaces the global File/FormData with its own
 * implementations that are incompatible with Node's native
 * Request.formData() parser.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    account: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports — route handlers + mocked modules
// ---------------------------------------------------------------------------

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { POST as createManualAccount } from "@/app/api/accounts/manual/route";
import { GET as getFormats, POST as importCsv } from "../csv/route";
import { GET as getHistory } from "../history/route";
import { DELETE as deleteBatch } from "../history/[batchId]/route";

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockAuth = vi.mocked(auth);
const mockIsDemoMode = vi.mocked(isDemoMode);

const mockAccountFindUnique = vi.mocked(prisma.account.findUnique);
const mockAccountFindMany = vi.mocked(prisma.account.findMany);
// const mockAccountUpdate = vi.mocked(prisma.account.update);
const mockTransactionFindMany = vi.mocked(prisma.transaction.findMany);
const mockTransactionFindFirst = vi.mocked(prisma.transaction.findFirst);
const mockTransactionCreateMany = vi.mocked(prisma.transaction.createMany);
const mockTransactionDeleteMany = vi.mocked(prisma.transaction.deleteMany);
const mockPrismaTransaction = vi.mocked(prisma.$transaction);
const mockPrismaQueryRaw = vi.mocked(prisma.$queryRaw);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonRequest(
  body: unknown,
  url = "http://localhost/api/accounts/manual",
) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Build a multipart/form-data request by hand so we bypass the jsdom ↔ native
 * File/FormData incompatibility that causes `request.formData()` to throw.
 */
function csvFormData(
  csvContent: string,
  accountId: string,
  format?: string,
): Request {
  const boundary = "----VitestBoundary7MA4YWxkTrZu0gW";
  let body = "";

  // file part
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="test.csv"\r\n`;
  body += `Content-Type: text/csv\r\n\r\n`;
  body += csvContent + "\r\n";

  // accountId part
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="accountId"\r\n\r\n`;
  body += accountId + "\r\n";

  // optional format part
  if (format) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="format"\r\n\r\n`;
    body += format + "\r\n";
  }

  body += `--${boundary}--\r\n`;

  return new Request("http://localhost/api/import/csv", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
}

/** Request with no file — only accountId */
function csvFormDataNoFile(accountId: string): Request {
  const boundary = "----VitestBoundary7MA4YWxkTrZu0gW";
  let body = "";
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="accountId"\r\n\r\n`;
  body += accountId + "\r\n";
  body += `--${boundary}--\r\n`;

  return new Request("http://localhost/api/import/csv", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
}

/** Request with file but no accountId */
function csvFormDataNoAccount(csvContent: string): Request {
  const boundary = "----VitestBoundary7MA4YWxkTrZu0gW";
  let body = "";
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="test.csv"\r\n`;
  body += `Content-Type: text/csv\r\n\r\n`;
  body += csvContent + "\r\n";
  body += `--${boundary}--\r\n`;

  return new Request("http://localhost/api/import/csv", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
}

const VALID_CSV = [
  "Date,Description,Amount",
  "01/15/2024,Coffee Shop,4.50",
  "01/16/2024,Grocery Store,52.30",
].join("\n");

// ==========================================================================
// 1. POST /api/accounts/manual
// ==========================================================================

describe("POST /api/accounts/manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const res = await createManualAccount(
      jsonRequest({
        institutionName: "Test Bank",
        accountName: "Checking",
        accountType: "depository",
      }),
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 in demo mode", async () => {
    mockIsDemoMode.mockReturnValue(true);

    const res = await createManualAccount(
      jsonRequest({
        institutionName: "Test Bank",
        accountName: "Checking",
        accountType: "depository",
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("demo mode");
  });

  it("returns 400 for missing institutionName", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    const res = await createManualAccount(
      jsonRequest({ accountName: "Checking", accountType: "depository" }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "institutionName is required" });
  });

  it("returns 400 for missing accountName", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    const res = await createManualAccount(
      jsonRequest({ institutionName: "Test Bank", accountType: "depository" }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "accountName is required" });
  });

  it("returns 400 for invalid accountType", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    const res = await createManualAccount(
      jsonRequest({
        institutionName: "Test Bank",
        accountName: "Checking",
        accountType: "invalid",
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("accountType must be one of");
  });

  it("returns 201 with correct response for valid input", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    const mockPlaidItem = {
      id: "plaid-item-1",
      institutionName: "Test Bank",
      isManual: true,
    };
    const mockAccount = {
      id: "account-1",
      name: "Checking",
      type: "depository",
    };

    mockPrismaTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        plaidItem: { create: vi.fn().mockResolvedValue(mockPlaidItem) },
        account: { create: vi.fn().mockResolvedValue(mockAccount) },
      };
      return cb(tx);
    });

    const res = await createManualAccount(
      jsonRequest({
        institutionName: "Test Bank",
        accountName: "Checking",
        accountType: "depository",
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.institutionId).toBe("plaid-item-1");
    expect(body.accountId).toBe("account-1");
    expect(body.institutionName).toBe("Test Bank");
    expect(body.accountName).toBe("Checking");
  });

  it("creates PlaidItem with isManual=true", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    let capturedPlaidItemData: Record<string, unknown> | null = null;

    mockPrismaTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        plaidItem: {
          create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            capturedPlaidItemData = args.data;
            return { id: "pi-1", institutionName: "My Bank", isManual: true };
          }),
        },
        account: {
          create: vi.fn().mockResolvedValue({ id: "acc-1", name: "Savings" }),
        },
      };
      return cb(tx);
    });

    await createManualAccount(
      jsonRequest({
        institutionName: "My Bank",
        accountName: "Savings",
        accountType: "depository",
      }),
    );

    expect(capturedPlaidItemData).toBeDefined();
    expect(capturedPlaidItemData!.isManual).toBe(true);
    expect(capturedPlaidItemData!.userId).toBe("u1");
    expect(capturedPlaidItemData!.institutionName).toBe("My Bank");
    expect(capturedPlaidItemData!.accessToken).toBe("manual");
  });

  it("creates Account with correct fields", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    let capturedAccountData: Record<string, unknown> | null = null;

    mockPrismaTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        plaidItem: {
          create: vi.fn().mockResolvedValue({
            id: "pi-1",
            institutionName: "Bank",
            isManual: true,
          }),
        },
        account: {
          create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            capturedAccountData = args.data;
            return { id: "acc-1", name: "Credit Card" };
          }),
        },
      };
      return cb(tx);
    });

    await createManualAccount(
      jsonRequest({
        institutionName: "Bank",
        accountName: "Credit Card",
        accountType: "credit",
        accountSubtype: "visa",
        startingBalance: 1500.5,
      }),
    );

    expect(capturedAccountData).toBeDefined();
    expect(capturedAccountData!.plaidItemId).toBe("pi-1");
    expect(capturedAccountData!.name).toBe("Credit Card");
    expect(capturedAccountData!.type).toBe("credit");
    expect(capturedAccountData!.subtype).toBe("visa");
    expect(capturedAccountData!.currentBalance).toBe(1500.5);
    expect(capturedAccountData!.currency).toBe("USD");
  });
});

// ==========================================================================
// 2. POST /api/import/csv
// ==========================================================================

describe("POST /api/import/csv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const res = await importCsv(csvFormData(VALID_CSV, "acc-1"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 in demo mode", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockIsDemoMode.mockReturnValue(true);

    const res = await importCsv(csvFormData(VALID_CSV, "acc-1"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("demo mode");
  });

  it("returns 400 for missing file", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    const res = await importCsv(csvFormDataNoFile("acc-1"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "A CSV file is required" });
  });

  it("returns 400 for missing accountId", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    const res = await importCsv(csvFormDataNoAccount(VALID_CSV));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "accountId is required" });
  });

  it("returns 404 when account does not belong to user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockAccountFindUnique.mockResolvedValue({
      plaidItem: { userId: "other-user" },
    } as never);

    const res = await importCsv(csvFormData(VALID_CSV, "acc-1"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not found");
  });

  it("returns 200 with correct import summary for valid CSV", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockAccountFindUnique.mockResolvedValue({
      plaidItem: { userId: "u1" },
    } as never);
    mockTransactionFindMany.mockResolvedValue([] as never);
    mockTransactionCreateMany.mockResolvedValue({ count: 2 } as never);

    const res = await importCsv(csvFormData(VALID_CSV, "acc-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.imported).toBe(2);
    expect(body.duplicates).toBe(0);
    expect(body.batchId).toBeDefined();
    expect(typeof body.batchId).toBe("string");
    expect(body.format).toBeDefined();
  });

  it("detects duplicates when re-importing same CSV", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockAccountFindUnique.mockResolvedValue({
      plaidItem: { userId: "u1" },
    } as never);

    // First import — no existing transactions
    mockTransactionFindMany.mockResolvedValue([] as never);
    mockTransactionCreateMany.mockResolvedValue({ count: 2 } as never);

    const res1 = await importCsv(csvFormData(VALID_CSV, "acc-1"));
    const body1 = await res1.json();
    expect(body1.imported).toBe(2);
    expect(body1.duplicates).toBe(0);

    // Capture the IDs that were written so we can pretend they already exist
    const createManyCall = mockTransactionCreateMany.mock.calls[0][0] as {
      data: { plaidTransactionId: string }[];
    };
    const existingIds = createManyCall.data.map((r) => ({
      plaidTransactionId: r.plaidTransactionId,
    }));

    // Second import — same CSV, existing IDs returned from DB
    mockTransactionFindMany.mockResolvedValue(existingIds as never);
    mockTransactionCreateMany.mockClear();

    const res2 = await importCsv(csvFormData(VALID_CSV, "acc-1"));
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(body2.imported).toBe(0);
    expect(body2.duplicates).toBe(2);
    // createMany should not be called when everything is a duplicate
    expect(mockTransactionCreateMany).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// 3. GET /api/import/csv — available formats
// ==========================================================================

describe("GET /api/import/csv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const res = await getFormats();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns list of available formats", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    const res = await getFormats();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.formats).toBeInstanceOf(Array);
    expect(body.formats.length).toBeGreaterThan(0);

    // Every entry should have an id and a label
    for (const fmt of body.formats) {
      expect(fmt).toHaveProperty("id");
      expect(fmt).toHaveProperty("label");
    }

    // Verify well-known format IDs are present
    const ids = body.formats.map((f: { id: string }) => f.id);
    expect(ids).toContain("generic");
    expect(ids).toContain("chase");
    expect(ids).toContain("amex");
    expect(ids).toContain("first-tech");
  });
});

// ==========================================================================
// 4. GET /api/import/history
// ==========================================================================

describe("GET /api/import/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const res = await getHistory();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns empty array in demo mode", async () => {
    mockIsDemoMode.mockReturnValue(true);

    const res = await getHistory();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns import batches for authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    const mockBatches = [
      {
        importBatchId: "import_batch-1",
        accountId: "acc-1",
        transactionCount: BigInt(5),
        minDate: new Date("2024-01-01"),
        maxDate: new Date("2024-01-31"),
        importedAt: new Date("2024-02-01T10:00:00Z"),
      },
    ];
    mockPrismaQueryRaw.mockResolvedValue(mockBatches as never);

    mockAccountFindMany.mockResolvedValue([
      {
        id: "acc-1",
        name: "Checking",
        plaidItem: { institutionName: "Test Bank" },
      },
    ] as never);

    const res = await getHistory();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].batchId).toBe("import_batch-1");
    expect(body[0].accountId).toBe("acc-1");
    expect(body[0].accountName).toBe("Checking");
    expect(body[0].institutionName).toBe("Test Bank");
    expect(body[0].transactionCount).toBe(5);
    expect(body[0].dateRange.from).toBe("2024-01-01");
    expect(body[0].dateRange.to).toBe("2024-01-31");
    expect(body[0].importedAt).toBeDefined();
  });
});

// ==========================================================================
// 5. DELETE /api/import/history/[batchId]
// ==========================================================================

describe("DELETE /api/import/history/[batchId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  const batchParams = (batchId: string) => ({
    params: Promise.resolve({ batchId }),
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const res = await deleteBatch(
      new Request("http://localhost/api/import/history/batch-1", {
        method: "DELETE",
      }),
      batchParams("batch-1"),
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 in demo mode", async () => {
    mockIsDemoMode.mockReturnValue(true);

    const res = await deleteBatch(
      new Request("http://localhost/api/import/history/batch-1", {
        method: "DELETE",
      }),
      batchParams("batch-1"),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("demo mode");
  });

  it("returns 404 for non-existent batchId", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockTransactionFindFirst.mockResolvedValue(null as never);

    const res = await deleteBatch(
      new Request("http://localhost/api/import/history/nonexistent", {
        method: "DELETE",
      }),
      batchParams("nonexistent"),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Import batch not found" });
  });

  it("returns 200 with deleted count for valid batch", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockTransactionFindFirst.mockResolvedValue({ id: "txn-1" } as never);
    mockTransactionDeleteMany.mockResolvedValue({ count: 5 } as never);

    const res = await deleteBatch(
      new Request("http://localhost/api/import/history/batch-1", {
        method: "DELETE",
      }),
      batchParams("batch-1"),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deleted).toBe(5);
  });
});
