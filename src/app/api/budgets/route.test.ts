import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    budget: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("@/lib/demo", () => ({ isDemoMode: () => false }));

import { GET, POST, PATCH, DELETE } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockFindMany = vi.mocked(prisma.budget.findMany);
const mockCreate = vi.mocked(prisma.budget.create);
const mockFindUnique = vi.mocked(prisma.budget.findUnique);
const mockUpdate = vi.mocked(prisma.budget.update);
const mockDelete = vi.mocked(prisma.budget.delete);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/budgets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/budgets", () => {
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

    it("returns user budgets sorted by category", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockResolvedValue([
        { id: "b1", userId: "user-1", category: "ENTERTAINMENT", amount: 200 },
        { id: "b2", userId: "user-1", category: "FOOD_AND_DRINK", amount: 500 },
      ] as never);

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.budgets).toHaveLength(2);
      expect(body.budgets[0]).toEqual({ id: "b1", category: "ENTERTAINMENT", amount: 200 });
      expect(body.budgets[1]).toEqual({ id: "b2", category: "FOOD_AND_DRINK", amount: 500 });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { category: "asc" },
      });
    });

    it("returns empty array when no budgets exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockResolvedValue([] as never);

      const res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ budgets: [] });
    });
  });

  // --- POST ---
  describe("POST", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await POST(makeRequest({ category: "FOOD_AND_DRINK", amount: 500 }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when category is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ amount: 500 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid category" });
    });

    it("returns 400 for invalid category", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ category: "FAKE_CATEGORY", amount: 500 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid category" });
    });

    it("returns 400 when amount is not a positive number", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ category: "FOOD_AND_DRINK", amount: -10 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Amount must be a positive number" });
    });

    it("returns 400 when amount is zero", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ category: "FOOD_AND_DRINK", amount: 0 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Amount must be a positive number" });
    });

    it("returns 409 when budget for category already exists", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockCreate.mockRejectedValue(new Error("Unique constraint failed"));

      const res = await POST(makeRequest({ category: "FOOD_AND_DRINK", amount: 500 }));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "A budget already exists for this category" });
    });

    it("creates budget successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockCreate.mockResolvedValue({
        id: "b-new",
        userId: "user-1",
        category: "FOOD_AND_DRINK",
        amount: 500,
      } as never);

      const res = await POST(makeRequest({ category: "FOOD_AND_DRINK", amount: 500 }));
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.budget).toEqual({ id: "b-new", category: "FOOD_AND_DRINK", amount: 500 });

      expect(mockCreate).toHaveBeenCalledWith({
        data: { userId: "user-1", category: "FOOD_AND_DRINK", amount: 500 },
      });
    });
  });

  // --- PATCH ---
  describe("PATCH", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await PATCH(makeRequest({ id: "b1", amount: 300 }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when id is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await PATCH(makeRequest({ amount: 300 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Budget ID is required" });
    });

    it("returns 400 when amount is invalid", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await PATCH(makeRequest({ id: "b1", amount: -5 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Amount must be a positive number" });
    });

    it("returns 404 when budget does not exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue(null as never);

      const res = await PATCH(makeRequest({ id: "nonexistent", amount: 300 }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Budget not found" });
    });

    it("returns 404 when budget belongs to another user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "b1", userId: "other-user" } as never);

      const res = await PATCH(makeRequest({ id: "b1", amount: 300 }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Budget not found" });
    });

    it("updates budget successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "b1", userId: "user-1" } as never);
      mockUpdate.mockResolvedValue({
        id: "b1",
        category: "FOOD_AND_DRINK",
        amount: 750,
      } as never);

      const res = await PATCH(makeRequest({ id: "b1", amount: 750 }));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.budget).toEqual({ id: "b1", category: "FOOD_AND_DRINK", amount: 750 });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: { amount: 750 },
      });
    });
  });

  // --- DELETE ---
  describe("DELETE", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await DELETE(makeRequest({ id: "b1" }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when id is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await DELETE(makeRequest({}));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Budget ID is required" });
    });

    it("returns 404 when budget does not exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue(null as never);

      const res = await DELETE(makeRequest({ id: "nonexistent" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Budget not found" });
    });

    it("returns 404 when budget belongs to another user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "b1", userId: "other-user" } as never);

      const res = await DELETE(makeRequest({ id: "b1" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Budget not found" });
    });

    it("deletes budget successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "b1", userId: "user-1" } as never);
      mockDelete.mockResolvedValue({} as never);

      const res = await DELETE(makeRequest({ id: "b1" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });

      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "b1" } });
    });
  });
});
