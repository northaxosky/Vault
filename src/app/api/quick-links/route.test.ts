import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    quickLink: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/demo", () => ({
  isDemoMode: vi.fn(),
}));

import { GET, POST, PATCH, DELETE } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

const mockAuth = vi.mocked(auth);
const mockIsDemoMode = vi.mocked(isDemoMode);
const mockFindMany = vi.mocked(prisma.quickLink.findMany);
const mockCreate = vi.mocked(prisma.quickLink.create);
const mockFindUnique = vi.mocked(prisma.quickLink.findUnique);
const mockUpdate = vi.mocked(prisma.quickLink.update);
const mockDelete = vi.mocked(prisma.quickLink.delete);
const mockCount = vi.mocked(prisma.quickLink.count);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/quick-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/quick-links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  // --- Auth tests ---
  describe("authentication", () => {
    it("GET returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const response = await GET();
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("POST returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const response = await POST(makeRequest({ label: "Test", url: "https://test.com" }));
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("PATCH returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const response = await PATCH(makeRequest({ id: "1", label: "Test" }));
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("DELETE returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const response = await DELETE(makeRequest({ id: "1" }));
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });
  });

  // --- Demo mode ---
  describe("demo mode", () => {
    it("GET returns mock links in demo mode", async () => {
      mockIsDemoMode.mockReturnValue(true);

      const response = await GET();
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.links).toHaveLength(4);
      expect(body.links[0].label).toBe("Chase");
      expect(body.links[1].label).toBe("Robinhood");
      expect(body.links[2].label).toBe("Mint");
      expect(body.links[3].label).toBe("Credit Karma");
      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });

  // --- GET ---
  describe("GET", () => {
    it("returns links sorted by sortOrder", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const mockLinks = [
        { id: "l1", userId: "user-1", label: "Bank", url: "https://bank.com", icon: "🏦", sortOrder: 0, createdAt: new Date() },
        { id: "l2", userId: "user-1", label: "Invest", url: "https://invest.com", icon: "📈", sortOrder: 1, createdAt: new Date() },
      ];
      mockFindMany.mockResolvedValue(mockLinks as never);

      const response = await GET();
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.links).toHaveLength(2);
      expect(body.links[0].label).toBe("Bank");
      expect(body.links[1].label).toBe("Invest");

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { sortOrder: "asc" },
      });
    });

    it("returns empty array when no links", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindMany.mockResolvedValue([] as never);

      const response = await GET();
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.links).toEqual([]);
    });
  });

  // --- POST ---
  describe("POST", () => {
    it("creates a quick link", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockCount.mockResolvedValue(3 as never);

      const created = {
        id: "new-1",
        userId: "user-1",
        label: "My Bank",
        url: "https://mybank.com",
        icon: "🏦",
        sortOrder: 3,
        createdAt: new Date(),
      };
      mockCreate.mockResolvedValue(created as never);

      const response = await POST(
        makeRequest({ label: "My Bank", url: "https://mybank.com", icon: "🏦" })
      );
      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.link.label).toBe("My Bank");
      expect(body.link.url).toBe("https://mybank.com");

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          label: "My Bank",
          url: "https://mybank.com",
          icon: "🏦",
          sortOrder: 3,
        },
      });
    });

    it("uses provided sortOrder when given", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockCount.mockResolvedValue(5 as never);
      mockCreate.mockResolvedValue({ id: "new-1", sortOrder: 0 } as never);

      await POST(
        makeRequest({ label: "First", url: "https://first.com", sortOrder: 0 })
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ sortOrder: 0 }),
      });
    });

    it("rejects missing label", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const response = await POST(makeRequest({ url: "https://test.com" }));
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Label is required");
    });

    it("rejects label exceeding 50 characters", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const response = await POST(
        makeRequest({ label: "A".repeat(51), url: "https://test.com" })
      );
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Label must be 50 characters or less");
    });

    it("rejects missing URL", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const response = await POST(makeRequest({ label: "Test" }));
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("URL is required");
    });

    it("rejects invalid URL", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const response = await POST(
        makeRequest({ label: "Test", url: "ftp://bad.com" })
      );
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("URL must start with http:// or https://");
    });

    it("rejects icon exceeding 10 characters", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const response = await POST(
        makeRequest({ label: "Test", url: "https://test.com", icon: "A".repeat(11) })
      );
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Icon must be 10 characters or less");
    });

    it("enforces maximum of 20 links", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockCount.mockResolvedValue(20 as never);

      const response = await POST(
        makeRequest({ label: "Test", url: "https://test.com" })
      );
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Maximum of 20 quick links allowed");
    });
  });

  // --- PATCH ---
  describe("PATCH", () => {
    it("updates a quick link", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "l1",
        userId: "user-1",
        label: "Old",
        url: "https://old.com",
        icon: null,
        sortOrder: 0,
      } as never);

      const updated = {
        id: "l1",
        userId: "user-1",
        label: "New Label",
        url: "https://new.com",
        icon: "🌟",
        sortOrder: 0,
        createdAt: new Date(),
      };
      mockUpdate.mockResolvedValue(updated as never);

      const response = await PATCH(
        makeRequest({ id: "l1", label: "New Label", url: "https://new.com", icon: "🌟" })
      );
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.link.label).toBe("New Label");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: { label: "New Label", url: "https://new.com", icon: "🌟" },
      });
    });

    it("rejects missing id", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const response = await PATCH(makeRequest({ label: "Test" }));
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Quick link ID is required");
    });

    it("rejects when link not found", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue(null as never);

      const response = await PATCH(makeRequest({ id: "nonexistent", label: "Test" }));
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error).toBe("Quick link not found");
    });

    it("rejects when user does not own the link", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "l1",
        userId: "other-user",
        label: "Not Mine",
        url: "https://notmine.com",
      } as never);

      const response = await PATCH(makeRequest({ id: "l1", label: "Steal" }));
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error).toBe("Quick link not found");
    });

    it("validates label on update", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "l1", userId: "user-1" } as never);

      const response = await PATCH(
        makeRequest({ id: "l1", label: "A".repeat(51) })
      );
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Label must be 50 characters or less");
    });

    it("validates URL on update", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "l1", userId: "user-1" } as never);

      const response = await PATCH(
        makeRequest({ id: "l1", url: "ftp://bad.com" })
      );
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("URL must start with http:// or https://");
    });
  });

  // --- DELETE ---
  describe("DELETE", () => {
    it("deletes a quick link", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "l1", userId: "user-1" } as never);
      mockDelete.mockResolvedValue({} as never);

      const response = await DELETE(makeRequest({ id: "l1" }));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);

      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "l1" } });
    });

    it("rejects missing id", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

      const response = await DELETE(makeRequest({}));
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Quick link ID is required");
    });

    it("rejects when link not found", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue(null as never);

      const response = await DELETE(makeRequest({ id: "nonexistent" }));
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error).toBe("Quick link not found");
    });

    it("rejects when user does not own the link", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({ id: "l1", userId: "other-user" } as never);

      const response = await DELETE(makeRequest({ id: "l1" }));
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error).toBe("Quick link not found");
    });
  });
});
