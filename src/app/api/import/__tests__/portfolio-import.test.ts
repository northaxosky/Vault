/**
 * @vitest-environment node
 *
 * Integration tests for the portfolio import API routes:
 *   GET  /api/import/portfolio
 *   POST /api/import/portfolio
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    plaidItem: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    account: {
      update: vi.fn(),
    },
    security: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    investmentHolding: {
      upsert: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports — route handlers + mocked modules
// ---------------------------------------------------------------------------

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { GET, POST } from "../portfolio/route";

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockAuth = vi.mocked(auth);
const mockIsDemoMode = vi.mocked(isDemoMode);

const mockPlaidItemFindFirst = vi.mocked(prisma.plaidItem.findFirst);
const mockPlaidItemCreate = vi.mocked(prisma.plaidItem.create);
const mockAccountUpdate = vi.mocked(prisma.account.update);
const mockSecurityFindFirst = vi.mocked(prisma.security.findFirst);
const mockSecurityCreate = vi.mocked(prisma.security.create);
const mockSecurityUpdate = vi.mocked(prisma.security.update);
const mockHoldingUpsert = vi.mocked(prisma.investmentHolding.upsert);

// ---------------------------------------------------------------------------
// Fixture — Fidelity positions CSV
// ---------------------------------------------------------------------------

const FIDELITY_CSV = `Account Number,Account Name,Symbol,Description,Quantity,Last Price,Last Price Change,Current Value,Today's Gain/Loss Dollar,Today's Gain/Loss Percent,Total Gain/Loss Dollar,Total Gain/Loss Percent,Percent Of Account,Cost Basis Total,Average Cost Basis,Type
Z12345678,ESPP Stocks,FCASH**,HELD IN FCASH,,,,$450.25,,,,,0.85%,,,Cash,
Z12345678,ESPP Stocks,MSFT,MICROSOFT CORP,50.0000,$371.04,-$1.70,$18552.00,-$85.00,-0.46%,-$1448.00,-7.24%,99.15%,$20000.00,$400.00,Cash,
987654321,BrokerageLink,FDRXX**,HELD IN MONEY MARKET,,,,$3200.50,,,,,5.50%,,,Cash,
987654321,BrokerageLink,VTI,VANGUARD INDEX FDS VANGUARD TOTAL STK MKT ETF,25.000,$325.15,+$1.97,$8128.75,+$49.25,+0.61%,-$171.25,-2.06%,13.96%,$8300.00,$332.00,Cash,
987654321,BrokerageLink,QQQ,INVESCO QQQ TR UNIT SER 1,40.000,$587.82,+$3.84,$23512.80,+$153.60,+0.66%,+$2512.80,+11.96%,40.40%,$21000.00,$525.00,Cash,
987654321,BrokerageLink,FXAIX,FIDELITY 500 INDEX FUND,75.000,$229.58,+$1.24,$17218.50,+$93.00,+0.54%,+$2218.50,+14.79%,29.58%,$15000.00,$200.00,Cash,
987654321,BrokerageLink,AMZN,AMAZON.COM INC,15.000,$211.71,+$4.47,$3175.65,+$67.05,+2.16%,-$324.35,-9.27%,5.45%,$3500.00,$233.33,Cash,
111222333,Health Savings Account,FDRXX**,HELD IN MONEY MARKET,,,,$275.50,,,,,100.00%,,,Cash,
111222333,Health Savings Account,Pending activity,,,,,-$150.00,,,,,,,,,`;

const AMEX_CSV = `Date,Description,Amount
01/15/2024,Coffee Shop,4.50
01/16/2024,Grocery Store,52.30`;

// ---------------------------------------------------------------------------
// Helpers — multipart form-data builders
// ---------------------------------------------------------------------------

/**
 * Build a multipart/form-data POST request carrying a CSV file.
 * Uses hand-built body to avoid jsdom ↔ native File/FormData issues.
 */
function portfolioFormData(csvContent: string, filename = "positions.csv"): Request {
  const boundary = "----VitestBoundary7MA4YWxkTrZu0gW";
  let body = "";

  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
  body += `Content-Type: text/csv\r\n\r\n`;
  body += csvContent + "\r\n";

  body += `--${boundary}--\r\n`;

  return new Request("http://localhost/api/import/portfolio", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
}

/** Build a multipart POST with no file part at all. */
function portfolioFormDataNoFile(): Request {
  const boundary = "----VitestBoundary7MA4YWxkTrZu0gW";
  let body = "";

  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="dummy"\r\n\r\n`;
  body += "nothing\r\n";

  body += `--${boundary}--\r\n`;

  return new Request("http://localhost/api/import/portfolio", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
}

/**
 * Build a multipart POST whose CSV content is exactly `size` bytes.
 * The content is padded with 'X' characters so file.size > MAX_FILE_SIZE.
 */
function portfolioFormDataOversized(sizeBytes: number): Request {
  const csvContent = "X".repeat(sizeBytes);
  return portfolioFormData(csvContent, "huge.csv");
}

// ---------------------------------------------------------------------------
// Helpers — common Prisma mock setup for the happy-path (POST 200)
// ---------------------------------------------------------------------------

let securityIdCounter: number;

function setupPrismaHappyPath() {
  securityIdCounter = 0;

  // PlaidItem.findFirst → not found (first import)
  mockPlaidItemFindFirst.mockResolvedValue(null as never);

  // PlaidItem.create → returns a new item with one account
  mockPlaidItemCreate.mockImplementation(async (args: Record<string, unknown>) => ({
    id: `plaid-item-${args.data.institutionName}`,
    ...args.data,
    accounts: [
      {
        id: `acct-${args.data.accounts.create.name}`,
        name: args.data.accounts.create.name,
        type: "investment",
        currentBalance: args.data.accounts.create.currentBalance,
      },
    ],
  }) as never);

  // Account.update → noop
  mockAccountUpdate.mockResolvedValue({} as never);

  // Security.findFirst → not found (new security)
  mockSecurityFindFirst.mockResolvedValue(null as never);

  // Security.create → returns a new security with an incremented id
  mockSecurityCreate.mockImplementation(async (args: Record<string, unknown>) => ({
    id: `sec-${++securityIdCounter}`,
    ...args.data,
  }) as never);

  // Security.update → noop
  mockSecurityUpdate.mockResolvedValue({} as never);

  // InvestmentHolding.upsert → noop
  mockHoldingUpsert.mockResolvedValue({} as never);
}

// ==========================================================================
// 1. GET /api/import/portfolio
// ==========================================================================

describe("GET /api/import/portfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns supported: true with description when authenticated", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.supported).toBe(true);
    expect(body.description).toBeDefined();
    expect(typeof body.description).toBe("string");
    expect(body.description).toContain("Fidelity");
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });
});

// ==========================================================================
// 2. POST /api/import/portfolio
// ==========================================================================

describe("POST /api/import/portfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  // --- Auth & guard checks -----------------------------------------------

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const res = await POST(portfolioFormData(FIDELITY_CSV));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 in demo mode", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    mockIsDemoMode.mockReturnValue(true);

    const res = await POST(portfolioFormData(FIDELITY_CSV));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("demo mode");
  });

  it("returns 400 for missing file", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    const res = await POST(portfolioFormDataNoFile());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "A CSV file is required" });
  });

  it("returns 400 for oversized file (>5 MB)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    const res = await POST(portfolioFormDataOversized(5 * 1024 * 1024 + 1));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("5 MB");
  });

  it("returns 400 for non-portfolio CSV (Amex format)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);

    const res = await POST(portfolioFormData(AMEX_CSV));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("does not appear to be a Fidelity");
  });

  // --- Happy path: valid Fidelity CSV ------------------------------------

  it("returns 200 with correct summary for valid Fidelity CSV", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    setupPrismaHappyPath();

    const res = await POST(portfolioFormData(FIDELITY_CSV));

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);

    // 3 accounts: ESPP Stocks, BrokerageLink, Health Savings Account
    expect(body.accounts).toBe(3);

    // 5 equity positions: MSFT, VTI, QQQ, FXAIX, AMZN
    expect(body.positions).toBe(5);

    // 3 cash positions: FCASH**, FDRXX** (BrokerageLink), FDRXX** (HSA)
    expect(body.cashPositions).toBe(3);

    // totalValue = sum of all account balances (positions + cash per account)
    // ESPP:  18552.00 + 450.25 = 19002.25
    // BLink: 8128.75 + 23512.80 + 17218.50 + 3175.65 + 3200.50 = 55236.20
    // HSA:   0 + 275.50 = 275.50
    // Total: 19002.25 + 55236.20 + 275.50 = 74513.95
    expect(body.totalValue).toBeCloseTo(74513.95, 2);
  });

  // --- Security upsert verification --------------------------------------

  it("creates Securities with correct ticker, name, and type", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    setupPrismaHappyPath();

    await POST(portfolioFormData(FIDELITY_CSV));

    // 5 securities should be created (all new — findFirst returns null)
    expect(mockSecurityCreate).toHaveBeenCalledTimes(5);

    // Collect all created tickers
    const createdSecurities = mockSecurityCreate.mock.calls.map(
      (call: unknown[]) => call[0].data,
    );

    // MSFT — stock
    const msft = createdSecurities.find((s: Record<string, unknown>) => s.ticker === "MSFT");
    expect(msft).toBeDefined();
    expect(msft.name).toBe("MICROSOFT CORP");
    expect(msft.type).toBe("stock");

    // VTI — etf (known ETF)
    const vti = createdSecurities.find((s: Record<string, unknown>) => s.ticker === "VTI");
    expect(vti).toBeDefined();
    expect(vti.name).toContain("VANGUARD");
    expect(vti.type).toBe("etf");

    // QQQ — etf (known ETF)
    const qqq = createdSecurities.find((s: Record<string, unknown>) => s.ticker === "QQQ");
    expect(qqq).toBeDefined();
    expect(qqq.type).toBe("etf");

    // FXAIX — mutual fund (5-char ending in X + "FUND" in description)
    const fxaix = createdSecurities.find((s: Record<string, unknown>) => s.ticker === "FXAIX");
    expect(fxaix).toBeDefined();
    expect(fxaix.type).toBe("mutual fund");

    // AMZN — stock
    const amzn = createdSecurities.find((s: Record<string, unknown>) => s.ticker === "AMZN");
    expect(amzn).toBeDefined();
    expect(amzn.name).toBe("AMAZON.COM INC");
    expect(amzn.type).toBe("stock");
  });

  it("updates existing Security name/type when already in DB", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    setupPrismaHappyPath();

    // Override: MSFT already exists in the DB
    const existingMsft = {
      id: "existing-sec-msft",
      plaidSecurityId: "manual_sec_MSFT",
      name: "OLD MICROSOFT NAME",
      ticker: "MSFT",
      type: "stock",
    };

    mockSecurityFindFirst.mockImplementation(async (args: Record<string, unknown>) => {
      if (args.where.ticker === "MSFT") return existingMsft as never;
      return null as never;
    });

    await POST(portfolioFormData(FIDELITY_CSV));

    // Security.update should be called for MSFT with updated name
    expect(mockSecurityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "existing-sec-msft" },
        data: expect.objectContaining({
          name: "MICROSOFT CORP",
        }),
      }),
    );
  });

  // --- InvestmentHolding upsert verification ------------------------------

  it("upserts InvestmentHoldings with correct quantity, costBasis, currentValue", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } } as never);
    setupPrismaHappyPath();

    await POST(portfolioFormData(FIDELITY_CSV));

    // 5 holdings should be upserted
    expect(mockHoldingUpsert).toHaveBeenCalledTimes(5);

    // Find the MSFT upsert call — it's the first security created (sec-1)
    // and accountId is "acct-ESPP Stocks"
    const msftCall = mockHoldingUpsert.mock.calls.find(
      (call: unknown[]) =>
        call[0].where.accountId_securityId.accountId === "acct-ESPP Stocks",
    );
    expect(msftCall).toBeDefined();

    const msftArgs = (msftCall as unknown[])[0];
    expect(msftArgs.update.quantity).toBe(50);
    expect(msftArgs.update.costBasis).toBe(20000);
    expect(msftArgs.update.currentValue).toBe(18552);

    expect(msftArgs.create.quantity).toBe(50);
    expect(msftArgs.create.costBasis).toBe(20000);
    expect(msftArgs.create.currentValue).toBe(18552);
    expect(msftArgs.create.currency).toBe("USD");

    // Find a BrokerageLink holding — e.g. QQQ (40 shares, $21000 cost, $23512.80 value)
    const brokeCalls = mockHoldingUpsert.mock.calls.filter(
      (call: unknown[]) =>
        call[0].where.accountId_securityId.accountId === "acct-BrokerageLink",
    );
    // BrokerageLink has 4 positions: VTI, QQQ, FXAIX, AMZN
    expect(brokeCalls.length).toBe(4);

    // Look for the QQQ call by matching quantity = 40
    const qqqCall = brokeCalls.find(
      (call: unknown[]) => call[0].update.quantity === 40,
    );
    expect(qqqCall).toBeDefined();
    const qqqArgs = (qqqCall as unknown[])[0];
    expect(qqqArgs.update.costBasis).toBe(21000);
    expect(qqqArgs.update.currentValue).toBe(23512.80);
  });
});
