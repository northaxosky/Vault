import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn() }));

import { PATCH } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

const mockAuth = vi.mocked(auth);
const mockIsDemoMode = vi.mocked(isDemoMode);
const mockFindUnique = vi.mocked(prisma.transaction.findUnique);
const mockUpdate = vi.mocked(prisma.transaction.update);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/transactions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/transactions PATCH", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  // --- Demo mode ---
  it("returns success in demo mode without touching DB", async () => {
    mockIsDemoMode.mockReturnValue(true);

    const res = await PATCH(makeRequest({ id: "txn-1", notes: "test" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  // --- Auth ---
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const res = await PATCH(makeRequest({ id: "txn-1", notes: "test" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  // --- Validation ---
  it("returns 400 when transaction ID is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const res = await PATCH(makeRequest({ notes: "test" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Transaction ID is required" });
  });

  it("returns 400 for invalid category", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const res = await PATCH(
      makeRequest({ id: "txn-1", userCategory: "NONEXISTENT_CATEGORY" }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid category" });
  });

  // --- Ownership ---
  it("returns 404 when transaction does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue(null as never);

    const res = await PATCH(makeRequest({ id: "txn-missing", notes: "test" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Transaction not found" });
  });

  it("returns 404 when transaction belongs to another user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      account: { plaidItem: { userId: "other-user" } },
    } as never);

    const res = await PATCH(makeRequest({ id: "txn-1", notes: "test" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Transaction not found" });
  });

  // --- Success cases ---
  it("successfully updates transaction notes", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      account: { plaidItem: { userId: "user-1" } },
    } as never);
    mockUpdate.mockResolvedValue({
      id: "txn-1",
      notes: "grocery run",
      userCategory: null,
    } as never);

    const res = await PATCH(makeRequest({ id: "txn-1", notes: "grocery run" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.transaction).toEqual({
      id: "txn-1",
      notes: "grocery run",
      userCategory: null,
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { notes: "grocery run" },
    });
  });

  it("successfully overrides transaction category", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      account: { plaidItem: { userId: "user-1" } },
    } as never);
    mockUpdate.mockResolvedValue({
      id: "txn-1",
      notes: null,
      userCategory: "FOOD_AND_DRINK",
    } as never);

    const res = await PATCH(
      makeRequest({ id: "txn-1", userCategory: "FOOD_AND_DRINK" }),
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.transaction.userCategory).toBe("FOOD_AND_DRINK");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { userCategory: "FOOD_AND_DRINK" },
    });
  });

  it("clears notes when empty string is provided", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      account: { plaidItem: { userId: "user-1" } },
    } as never);
    mockUpdate.mockResolvedValue({
      id: "txn-1",
      notes: null,
      userCategory: null,
    } as never);

    const res = await PATCH(makeRequest({ id: "txn-1", notes: "" }));
    expect(res.status).toBe(200);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { notes: null },
    });
  });

  it("clears category when empty string is provided", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      account: { plaidItem: { userId: "user-1" } },
    } as never);
    mockUpdate.mockResolvedValue({
      id: "txn-1",
      notes: null,
      userCategory: null,
    } as never);

    const res = await PATCH(makeRequest({ id: "txn-1", userCategory: "" }));
    expect(res.status).toBe(200);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { userCategory: null },
    });
  });

  it("allows null as a valid userCategory value", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      account: { plaidItem: { userId: "user-1" } },
    } as never);
    mockUpdate.mockResolvedValue({
      id: "txn-1",
      notes: null,
      userCategory: null,
    } as never);

    const res = await PATCH(makeRequest({ id: "txn-1", userCategory: null }));
    expect(res.status).toBe(200);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { userCategory: null },
    });
  });

  it("updates both notes and category in one request", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      account: { plaidItem: { userId: "user-1" } },
    } as never);
    mockUpdate.mockResolvedValue({
      id: "txn-1",
      notes: "rent payment",
      userCategory: "RENT_AND_UTILITIES",
    } as never);

    const res = await PATCH(
      makeRequest({
        id: "txn-1",
        notes: "rent payment",
        userCategory: "RENT_AND_UTILITIES",
      }),
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.transaction.notes).toBe("rent payment");
    expect(body.transaction.userCategory).toBe("RENT_AND_UTILITIES");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { notes: "rent payment", userCategory: "RENT_AND_UTILITIES" },
    });
  });

  it("returns 500 when database throws", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockRejectedValue(new Error("DB connection lost"));

    const res = await PATCH(makeRequest({ id: "txn-1", notes: "test" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Failed to update transaction",
    });
  });
});
