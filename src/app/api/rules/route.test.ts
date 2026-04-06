import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionRule: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transaction: {
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/demo", () => ({ isDemoMode: () => false }));

import { GET, POST, PATCH, DELETE } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockFindMany = vi.mocked(prisma.transactionRule.findMany);
const mockCreate = vi.mocked(prisma.transactionRule.create);
const mockFindUnique = vi.mocked(prisma.transactionRule.findUnique);
const mockUpdate = vi.mocked(prisma.transactionRule.update);
const mockRuleDelete = vi.mocked(prisma.transactionRule.delete);
const mockTxUpdateMany = vi.mocked(prisma.transaction.updateMany);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validRule = {
  matchField: "name",
  matchPattern: "Netflix",
  overrideName: null,
  overrideCategory: "ENTERTAINMENT",
};

describe("/api/rules", () => {
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

    it("returns rules for authenticated user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      const rules = [
        { id: "r1", matchField: "name", matchPattern: "Netflix", overrideName: null, overrideCategory: "ENTERTAINMENT", createdAt: new Date() },
        { id: "r2", matchField: "merchantName", matchPattern: "Uber", overrideName: "Uber Ride", overrideCategory: "TRANSPORTATION", createdAt: new Date() },
      ];
      mockFindMany.mockResolvedValue(rules as never);

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.rules).toHaveLength(2);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  // --- POST ---
  describe("POST", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await POST(makeRequest(validRule));
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid matchField", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ ...validRule, matchField: "invalid" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "matchField must be 'name' or 'merchantName'" });
    });

    it("returns 400 for missing matchField", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ ...validRule, matchField: undefined }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "matchField must be 'name' or 'merchantName'" });
    });

    it("returns 400 for empty matchPattern", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ ...validRule, matchPattern: "   " }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "matchPattern is required" });
    });

    it("returns 400 for invalid overrideCategory", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({ ...validRule, overrideCategory: "FAKE_CAT" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid overrideCategory" });
    });

    it("returns 400 when neither overrideName nor overrideCategory is provided", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await POST(makeRequest({
        matchField: "name",
        matchPattern: "Netflix",
        overrideName: null,
        overrideCategory: null,
      }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "At least one of overrideName or overrideCategory is required" });
    });

    it("creates rule and applies retroactively", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      const createdRule = {
        id: "r-new",
        userId: "user-1",
        matchField: "name",
        matchPattern: "Netflix",
        overrideName: null,
        overrideCategory: "ENTERTAINMENT",
      };
      mockCreate.mockResolvedValue(createdRule as never);
      mockTxUpdateMany.mockResolvedValue({ count: 5 } as never);

      const res = await POST(makeRequest(validRule));
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.rule.id).toBe("r-new");

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          matchField: "name",
          matchPattern: "Netflix",
          overrideName: null,
          overrideCategory: "ENTERTAINMENT",
        },
      });

      // Retroactive application should have been called
      expect(mockTxUpdateMany).toHaveBeenCalledWith({
        where: {
          account: { plaidItem: { userId: "user-1" } },
          name: { contains: "Netflix", mode: "insensitive" },
        },
        data: { userCategory: "ENTERTAINMENT" },
      });
    });

    it("creates rule with overrideName only", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockCreate.mockResolvedValue({
        id: "r-new",
        matchField: "merchantName",
        matchPattern: "AMZN",
        overrideName: "Amazon",
        overrideCategory: null,
      } as never);
      mockTxUpdateMany.mockResolvedValue({ count: 0 } as never);

      const res = await POST(makeRequest({
        matchField: "merchantName",
        matchPattern: "AMZN",
        overrideName: "Amazon",
        overrideCategory: null,
      }));
      expect(res.status).toBe(201);

      expect(mockTxUpdateMany).toHaveBeenCalledWith({
        where: {
          account: { plaidItem: { userId: "user-1" } },
          merchantName: { contains: "AMZN", mode: "insensitive" },
        },
        data: { name: "Amazon" },
      });
    });
  });

  // --- PATCH ---
  describe("PATCH", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await PATCH(makeRequest({ id: "r1", ...validRule }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when id is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await PATCH(makeRequest(validRule));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Rule ID is required" });
    });

    it("returns 400 for invalid matchField on update", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await PATCH(makeRequest({ id: "r1", ...validRule, matchField: "bad" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "matchField must be 'name' or 'merchantName'" });
    });

    it("returns 404 when rule does not exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue(null as never);

      const res = await PATCH(makeRequest({ id: "nonexistent", ...validRule }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Rule not found" });
    });

    it("returns 404 when rule belongs to another user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "r1", userId: "other-user" } as never);

      const res = await PATCH(makeRequest({ id: "r1", ...validRule }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Rule not found" });
    });

    it("updates rule and re-applies retroactively", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "r1", userId: "user-1" } as never);
      const updatedRule = {
        id: "r1",
        matchField: "name",
        matchPattern: "Netflix",
        overrideName: "Netflix Streaming",
        overrideCategory: "ENTERTAINMENT",
      };
      mockUpdate.mockResolvedValue(updatedRule as never);
      mockTxUpdateMany.mockResolvedValue({ count: 3 } as never);

      const res = await PATCH(makeRequest({
        id: "r1",
        matchField: "name",
        matchPattern: "Netflix",
        overrideName: "Netflix Streaming",
        overrideCategory: "ENTERTAINMENT",
      }));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.rule.overrideName).toBe("Netflix Streaming");

      expect(mockTxUpdateMany).toHaveBeenCalled();
    });
  });

  // --- DELETE ---
  describe("DELETE", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await DELETE(makeRequest({ id: "r1" }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when id is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const res = await DELETE(makeRequest({}));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Rule ID is required" });
    });

    it("returns 404 when rule does not exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue(null as never);

      const res = await DELETE(makeRequest({ id: "nonexistent" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Rule not found" });
    });

    it("returns 404 when rule belongs to another user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "r1", userId: "other-user" } as never);

      const res = await DELETE(makeRequest({ id: "r1" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Rule not found" });
    });

    it("deletes rule successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "r1", userId: "user-1" } as never);
      mockRuleDelete.mockResolvedValue({} as never);

      const res = await DELETE(makeRequest({ id: "r1" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });

      expect(mockRuleDelete).toHaveBeenCalledWith({ where: { id: "r1" } });
    });
  });
});
