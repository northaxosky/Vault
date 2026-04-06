import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    plaidItem: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    account: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn() }));

import { GET, POST } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

const mockAuth = vi.mocked(auth);
const mockIsDemoMode = vi.mocked(isDemoMode);
const mockFindMany = vi.mocked(prisma.plaidItem.findMany);
const mockTransaction = vi.mocked(prisma.$transaction);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/accounts/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/accounts/manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  // --- GET ---
  describe("GET", () => {
    it("returns 400 in demo mode", async () => {
      mockIsDemoMode.mockReturnValue(true);

      const res = await GET();
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Manual accounts are not available in demo mode",
      });
      expect(mockFindMany).not.toHaveBeenCalled();
    });

    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await GET();
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns manual accounts for the user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockResolvedValue([
        {
          id: "pi-1",
          institutionName: "My Bank",
          accounts: [
            {
              id: "acct-1",
              name: "Checking",
              type: "depository",
              subtype: "checking",
              currentBalance: 1500.5,
            },
          ],
        },
      ] as never);

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("pi-1");
      expect(body[0].institutionName).toBe("My Bank");
      expect(body[0].accounts).toHaveLength(1);
      expect(body[0].accounts[0].name).toBe("Checking");
      expect(body[0].accounts[0].currentBalance).toBe(1500.5);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1", isManual: true },
        include: {
          accounts: {
            select: {
              id: true,
              name: true,
              type: true,
              subtype: true,
              currentBalance: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns empty array when no manual accounts", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockResolvedValue([] as never);

      const res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("returns 0 for null currentBalance", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockResolvedValue([
        {
          id: "pi-1",
          institutionName: "Bank",
          accounts: [
            {
              id: "acct-1",
              name: "Savings",
              type: "depository",
              subtype: null,
              currentBalance: null,
            },
          ],
        },
      ] as never);

      const res = await GET();
      const body = await res.json();
      expect(body[0].accounts[0].currentBalance).toBe(0);
    });

    it("returns 500 when database throws", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockRejectedValue(new Error("DB error"));

      const res = await GET();
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: "Failed to fetch manual accounts",
      });
    });
  });

  // --- POST ---
  describe("POST", () => {
    it("returns 400 in demo mode", async () => {
      mockIsDemoMode.mockReturnValue(true);

      const res = await POST(
        makeRequest({
          institutionName: "Bank",
          accountName: "Checking",
          accountType: "depository",
        }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Manual account creation is not available in demo mode",
      });
    });

    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await POST(
        makeRequest({
          institutionName: "Bank",
          accountName: "Checking",
          accountType: "depository",
        }),
      );
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    // --- Field validation ---
    it("returns 400 when institutionName is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(
        makeRequest({ accountName: "Checking", accountType: "depository" }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "institutionName is required",
      });
    });

    it("returns 400 when accountName is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(
        makeRequest({ institutionName: "Bank", accountType: "depository" }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "accountName is required" });
    });

    it("returns 400 when institutionName exceeds 100 characters", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(
        makeRequest({
          institutionName: "A".repeat(101),
          accountName: "Checking",
          accountType: "depository",
        }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "institutionName must be between 1 and 100 characters",
      });
    });

    it("returns 400 when accountName exceeds 100 characters", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(
        makeRequest({
          institutionName: "Bank",
          accountName: "A".repeat(101),
          accountType: "depository",
        }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "accountName must be between 1 and 100 characters",
      });
    });

    it("returns 400 for invalid accountType", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(
        makeRequest({
          institutionName: "Bank",
          accountName: "Checking",
          accountType: "savings",
        }),
      );
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toContain("accountType must be one of");
    });

    it("returns 400 when accountType is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(
        makeRequest({ institutionName: "Bank", accountName: "Checking" }),
      );
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toContain("accountType must be one of");
    });

    it("returns 400 when accountSubtype exceeds 100 characters", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(
        makeRequest({
          institutionName: "Bank",
          accountName: "Checking",
          accountType: "depository",
          accountSubtype: "A".repeat(101),
        }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "accountSubtype must be a string of at most 100 characters",
      });
    });

    it("returns 400 when startingBalance is not a valid number", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(
        makeRequest({
          institutionName: "Bank",
          accountName: "Checking",
          accountType: "depository",
          startingBalance: "not-a-number",
        }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "startingBalance must be a valid number",
      });
    });

    // --- Success cases ---
    it("creates a manual account with all fields", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockTransaction.mockImplementation(async (callback) => {
        const tx = {
          plaidItem: {
            create: vi.fn().mockResolvedValue({
              id: "pi-1",
              institutionName: "Chase",
            }),
          },
          account: {
            create: vi.fn().mockResolvedValue({
              id: "acct-1",
              name: "Checking",
            }),
          },
        };
        return callback(tx as never);
      });

      const res = await POST(
        makeRequest({
          institutionName: "Chase",
          accountName: "Checking",
          accountType: "depository",
          accountSubtype: "checking",
          startingBalance: 1000,
        }),
      );
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.institutionId).toBe("pi-1");
      expect(body.accountId).toBe("acct-1");
      expect(body.institutionName).toBe("Chase");
      expect(body.accountName).toBe("Checking");
    });

    it("defaults startingBalance to 0 when not provided", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      let capturedAccountData: Record<string, unknown> | undefined;
      mockTransaction.mockImplementation(async (callback) => {
        const tx = {
          plaidItem: {
            create: vi.fn().mockResolvedValue({
              id: "pi-1",
              institutionName: "Bank",
            }),
          },
          account: {
            create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
              capturedAccountData = args.data;
              return Promise.resolve({ id: "acct-1", name: "Savings" });
            }),
          },
        };
        return callback(tx as never);
      });

      const res = await POST(
        makeRequest({
          institutionName: "Bank",
          accountName: "Savings",
          accountType: "depository",
        }),
      );
      expect(res.status).toBe(201);
      expect(capturedAccountData?.currentBalance).toBe(0);
    });

    it("trims institutionName and accountName", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      let capturedItemData: Record<string, unknown> | undefined;
      let capturedAccountData: Record<string, unknown> | undefined;
      mockTransaction.mockImplementation(async (callback) => {
        const tx = {
          plaidItem: {
            create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
              capturedItemData = args.data;
              return Promise.resolve({ id: "pi-1", institutionName: "Chase" });
            }),
          },
          account: {
            create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
              capturedAccountData = args.data;
              return Promise.resolve({ id: "acct-1", name: "Checking" });
            }),
          },
        };
        return callback(tx as never);
      });

      await POST(
        makeRequest({
          institutionName: "  Chase  ",
          accountName: "  Checking  ",
          accountType: "depository",
        }),
      );

      expect(capturedItemData?.institutionName).toBe("Chase");
      expect(capturedAccountData?.name).toBe("Checking");
    });

    it("returns 500 when database throws", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockTransaction.mockRejectedValue(new Error("DB error"));

      const res = await POST(
        makeRequest({
          institutionName: "Bank",
          accountName: "Checking",
          accountType: "depository",
        }),
      );
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: "Failed to create manual account",
      });
    });
  });
});
