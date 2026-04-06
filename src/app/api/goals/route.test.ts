import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    savingsGoal: {
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
const mockFindMany = vi.mocked(prisma.savingsGoal.findMany);
const mockCreate = vi.mocked(prisma.savingsGoal.create);
const mockFindUnique = vi.mocked(prisma.savingsGoal.findUnique);
const mockUpdate = vi.mocked(prisma.savingsGoal.update);
const mockGoalDelete = vi.mocked(prisma.savingsGoal.delete);
const mockAccountFindFirst = vi.mocked(prisma.account.findFirst);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/goals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/goals", () => {
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

    it("returns goals with linked account details", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockResolvedValue([
        {
          id: "g1",
          name: "Emergency Fund",
          targetAmount: 10000,
          currentAmount: 2500,
          deadline: new Date("2025-12-31"),
          linkedAccountId: "acc-1",
          linkedAccount: { name: "Savings Account", currentBalance: 5000 },
        },
        {
          id: "g2",
          name: "Vacation",
          targetAmount: 3000,
          currentAmount: 500,
          deadline: null,
          linkedAccountId: null,
          linkedAccount: null,
        },
      ] as never);

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.goals).toHaveLength(2);
      expect(body.goals[0]).toEqual({
        id: "g1",
        name: "Emergency Fund",
        targetAmount: 10000,
        currentAmount: 2500,
        deadline: "2025-12-31T00:00:00.000Z",
        linkedAccountId: "acc-1",
        linkedAccountName: "Savings Account",
        linkedAccountBalance: 5000,
      });
      expect(body.goals[1].linkedAccountName).toBeNull();
      expect(body.goals[1].linkedAccountBalance).toBeNull();
    });
  });

  // --- POST ---
  describe("POST", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await POST(makeRequest({ name: "Fund", targetAmount: 1000 }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when name is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ targetAmount: 1000 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Name is required" });
    });

    it("returns 400 when name is not a string", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ name: 123, targetAmount: 1000 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Name is required" });
    });

    it("returns 400 when target amount is not positive", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ name: "Fund", targetAmount: 0 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Target amount must be positive" });
    });

    it("returns 404 when linked account does not belong to user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockAccountFindFirst.mockResolvedValue(null as never);

      const res = await POST(makeRequest({ name: "Fund", targetAmount: 1000, linkedAccountId: "bad-acc" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Account not found" });

      expect(mockAccountFindFirst).toHaveBeenCalledWith({
        where: { id: "bad-acc", plaidItem: { userId: "user-1" } },
      });
    });

    it("creates goal successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockCreate.mockResolvedValue({
        id: "g-new",
        name: "Vacation",
        targetAmount: 3000,
        currentAmount: 0,
        deadline: new Date("2026-06-01"),
        linkedAccountId: null,
      } as never);

      const res = await POST(makeRequest({ name: "Vacation", targetAmount: 3000, deadline: "2026-06-01" }));
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.goal.id).toBe("g-new");
      expect(body.goal.name).toBe("Vacation");
      expect(body.goal.targetAmount).toBe(3000);
      expect(body.goal.currentAmount).toBe(0);
    });

    it("creates goal with linked account when valid", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);
      mockCreate.mockResolvedValue({
        id: "g-new",
        name: "Fund",
        targetAmount: 5000,
        currentAmount: 0,
        deadline: null,
        linkedAccountId: "acc-1",
      } as never);

      const res = await POST(makeRequest({ name: "Fund", targetAmount: 5000, linkedAccountId: "acc-1" }));
      expect(res.status).toBe(201);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          name: "Fund",
          targetAmount: 5000,
          deadline: null,
          linkedAccountId: "acc-1",
        },
      });
    });
  });

  // --- PATCH ---
  describe("PATCH", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await PATCH(makeRequest({ id: "g1", name: "Updated" }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when id is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await PATCH(makeRequest({ name: "Updated" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Goal ID is required" });
    });

    it("returns 404 when goal does not exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue(null as never);

      const res = await PATCH(makeRequest({ id: "nonexistent", name: "Updated" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Goal not found" });
    });

    it("returns 404 when goal belongs to another user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "g1", userId: "other-user" } as never);

      const res = await PATCH(makeRequest({ id: "g1", name: "Steal" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Goal not found" });
    });

    it("returns 400 when target amount is invalid", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "g1", userId: "user-1" } as never);

      const res = await PATCH(makeRequest({ id: "g1", targetAmount: -100 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Target amount must be positive" });
    });

    it("returns 400 when current amount is negative", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "g1", userId: "user-1" } as never);

      const res = await PATCH(makeRequest({ id: "g1", currentAmount: -50 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Current amount must be non-negative" });
    });

    it("updates goal successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "g1", userId: "user-1" } as never);
      mockUpdate.mockResolvedValue({
        id: "g1",
        name: "Updated Goal",
        targetAmount: 8000,
        currentAmount: 3000,
        deadline: null,
        linkedAccountId: null,
      } as never);

      const res = await PATCH(makeRequest({ id: "g1", name: "Updated Goal", targetAmount: 8000, currentAmount: 3000 }));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.goal.name).toBe("Updated Goal");
      expect(body.goal.targetAmount).toBe(8000);
      expect(body.goal.currentAmount).toBe(3000);
    });
  });

  // --- DELETE ---
  describe("DELETE", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await DELETE(makeRequest({ id: "g1" }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when id is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await DELETE(makeRequest({}));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Goal ID is required" });
    });

    it("returns 404 when goal does not exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue(null as never);

      const res = await DELETE(makeRequest({ id: "nonexistent" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Goal not found" });
    });

    it("returns 404 when goal belongs to another user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "g1", userId: "other-user" } as never);

      const res = await DELETE(makeRequest({ id: "g1" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Goal not found" });
    });

    it("deletes goal successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "g1", userId: "user-1" } as never);
      mockGoalDelete.mockResolvedValue({} as never);

      const res = await DELETE(makeRequest({ id: "g1" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });

      expect(mockGoalDelete).toHaveBeenCalledWith({ where: { id: "g1" } });
    });
  });
});
