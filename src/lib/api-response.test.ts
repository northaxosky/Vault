import { describe, it, expect } from "vitest";
import {
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  validationError,
  successResponse,
} from "./api-response";

describe("errorResponse", () => {
  it("returns JSON with error field and given status", async () => {
    const res = errorResponse("Something broke", 500);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Something broke" });
  });

  it("returns 400 for validation-style errors", async () => {
    const res = errorResponse("Invalid input", 400);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid input" });
  });
});

describe("unauthorizedResponse", () => {
  it("returns 401 with Unauthorized message", async () => {
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });
});

describe("notFoundResponse", () => {
  it("returns 404 with default resource name", async () => {
    const res = notFoundResponse();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Resource not found" });
  });

  it("returns 404 with custom resource name", async () => {
    const res = notFoundResponse("Budget");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Budget not found" });
  });
});

describe("validationError", () => {
  it("returns 400 with the given message", async () => {
    const res = validationError("Name is required");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Name is required" });
  });
});

describe("successResponse", () => {
  it("returns 200 with empty object by default", async () => {
    const res = successResponse();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("returns given data with default 200 status", async () => {
    const res = successResponse({ success: true, count: 3 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, count: 3 });
  });

  it("returns custom status code", async () => {
    const res = successResponse({ id: "abc" }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "abc" });
  });
});
