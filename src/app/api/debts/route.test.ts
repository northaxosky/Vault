import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    debtAccount: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/lib/demo", () => ({ isDemoMode: () => false }));

import { GET, POST, PATCH, DELETE } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockFindMany = vi.mocked(prisma.debtAccount.findMany);
const mockCreate = vi.mocked(prisma.debtAccount.create);
const mockFindUnique = vi.mocked(prisma.debtAccount.findUnique);
const mockUpdate = vi.mocked(prisma.debtAccount.update);
const mockDebtDelete = vi.mocked(prisma.debtAccount.delete);
const mockAccountFindFirst = vi.mocked(prisma.account.findFirst);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/debts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validDebt = {
  name: "Credit Card",
  balance: 5000,
  interestRate: 19.99,
  minimumPayment: 150,
};

describe("/api/debts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- GET ---
  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await GET();
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns debts with linked account details", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockResolvedValue([
        {
          id: "d1",
          name: "Credit Card",
          balance: 5000,
          interestRate: 19.99,
          minimumPayment: 150,
          linkedAccountId: "acc-1",
          linkedAccount: { name: "Chase Sapphire", currentBalance: 5000 },
        },
        {
          id: "d2",
          name: "Student Loan",
          balance: 25000,
          interestRate: 5.5,
          minimumPayment: 300,
          linkedAccountId: null,
          linkedAccount: null,
        },
      ] as never);

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.debts).toHaveLength(2);
      expect(body.debts[0]).toEqual({
        id: "d1",
        name: "Credit Card",
        balance: 5000,
        interestRate: 19.99,
        minimumPayment: 150,
        linkedAccountId: "acc-1",
        linkedAccountName: "Chase Sapphire",
      });
      expect(body.debts[1].linkedAccountName).toBeNull();
    });
  });

  // --- POST ---
  describe("POST", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await POST(makeRequest(validDebt));
      expect(res.status).toBe(401);
    });

    it("returns 400 when name is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ ...validDebt, name: undefined }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Name is required" });
    });

    it("returns 400 when name is not a string", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ ...validDebt, name: 42 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Name is required" });
    });

    it("returns 400 when balance is not positive", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ ...validDebt, balance: 0 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Balance must be positive" });
    });

    it("returns 400 when interest rate is below 0", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ ...validDebt, interestRate: -1 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Interest rate must be between 0 and 100" });
    });

    it("returns 400 when interest rate is above 100", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ ...validDebt, interestRate: 101 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Interest rate must be between 0 and 100" });
    });

    it("returns 400 when minimum payment is not positive", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ ...validDebt, minimumPayment: 0 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Minimum payment must be positive" });
    });

    it("returns 404 when linked account does not belong to user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockAccountFindFirst.mockResolvedValue(null as never);

      const res = await POST(makeRequest({ ...validDebt, linkedAccountId: "bad-acc" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Account not found" });
    });

    it("creates debt successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockCreate.mockResolvedValue({
        id: "d-new",
        name: "Credit Card",
        balance: 5000,
        interestRate: 19.99,
        minimumPayment: 150,
        linkedAccountId: null,
      } as never);

      const res = await POST(makeRequest(validDebt));
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.debt).toEqual({
        id: "d-new",
        name: "Credit Card",
        balance: 5000,
        interestRate: 19.99,
        minimumPayment: 150,
        linkedAccountId: null,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          name: "Credit Card",
          balance: 5000,
          interestRate: 19.99,
          minimumPayment: 150,
          linkedAccountId: null,
        },
      });
    });

    it("creates debt with linked account when valid", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);
      mockCreate.mockResolvedValue({
        id: "d-new",
        name: "Credit Card",
        balance: 5000,
        interestRate: 19.99,
        minimumPayment: 150,
        linkedAccountId: "acc-1",
      } as never);

      const res = await POST(makeRequest({ ...validDebt, linkedAccountId: "acc-1" }));
      expect(res.status).toBe(201);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ linkedAccountId: "acc-1" }),
      });
    });
  });

  // --- PATCH ---
  describe("PATCH", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await PATCH(makeRequest({ id: "d1", balance: 4500 }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when id is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await PATCH(makeRequest({ balance: 4500 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Debt ID is required" });
    });

    it("returns 404 when debt does not exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue(null as never);

      const res = await PATCH(makeRequest({ id: "nonexistent", balance: 4500 }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Debt not found" });
    });

    it("returns 404 when debt belongs to another user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "d1", userId: "other-user" } as never);

      const res = await PATCH(makeRequest({ id: "d1", balance: 4500 }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Debt not found" });
    });

    it("returns 400 when balance is invalid on update", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "d1", userId: "user-1" } as never);

      const res = await PATCH(makeRequest({ id: "d1", balance: -100 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Balance must be positive" });
    });

    it("returns 400 when interest rate is out of range on update", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "d1", userId: "user-1" } as never);

      const res = await PATCH(makeRequest({ id: "d1", interestRate: 150 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Interest rate must be between 0 and 100" });
    });

    it("returns 400 when minimum payment is invalid on update", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "d1", userId: "user-1" } as never);

      const res = await PATCH(makeRequest({ id: "d1", minimumPayment: 0 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Minimum payment must be positive" });
    });

    it("updates debt successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "d1", userId: "user-1" } as never);
      mockUpdate.mockResolvedValue({
        id: "d1",
        name: "Credit Card",
        balance: 4000,
        interestRate: 17.5,
        minimumPayment: 125,
        linkedAccountId: null,
      } as never);

      const res = await PATCH(makeRequest({ id: "d1", balance: 4000, interestRate: 17.5, minimumPayment: 125 }));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.debt.balance).toBe(4000);
      expect(body.debt.interestRate).toBe(17.5);
      expect(body.debt.minimumPayment).toBe(125);
    });
  });

  // --- DELETE ---
  describe("DELETE", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await DELETE(makeRequest({ id: "d1" }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when id is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await DELETE(makeRequest({}));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Debt ID is required" });
    });

    it("returns 404 when debt does not exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue(null as never);

      const res = await DELETE(makeRequest({ id: "nonexistent" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Debt not found" });
    });

    it("returns 404 when debt belongs to another user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "d1", userId: "other-user" } as never);

      const res = await DELETE(makeRequest({ id: "d1" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Debt not found" });
    });

    it("deletes debt successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "d1", userId: "user-1" } as never);
      mockDebtDelete.mockResolvedValue({} as never);

      const res = await DELETE(makeRequest({ id: "d1" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });

      expect(mockDebtDelete).toHaveBeenCalledWith({ where: { id: "d1" } });
    });
  });
});
