import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractPlaidError, logPlaidError } from "./plaid";
import { AxiosError, AxiosHeaders } from "axios";

function makePlaidAxiosError(
  status: number,
  data: Record<string, unknown>
): AxiosError {
  const headers = new AxiosHeaders();
  const error = new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "Bad Request",
    headers,
    config: { headers },
    data,
  });
  return error;
}

describe("extractPlaidError", () => {
  it("extracts structured error from a Plaid AxiosError", () => {
    const error = makePlaidAxiosError(400, {
      error_type: "INVALID_REQUEST",
      error_code: "INVALID_FIELD",
      error_message: "products must not be empty",
      display_message: null,
      request_id: "abc123",
    });

    const detail = extractPlaidError(error);
    expect(detail).toEqual({
      statusCode: 400,
      errorType: "INVALID_REQUEST",
      errorCode: "INVALID_FIELD",
      errorMessage: "products must not be empty",
      displayMessage: null,
      requestId: "abc123",
    });
  });

  it("extracts INSTITUTION_ERROR details", () => {
    const error = makePlaidAxiosError(400, {
      error_type: "INSTITUTION_ERROR",
      error_code: "INSTITUTION_NOT_RESPONDING",
      error_message: "the institution is not responding",
      display_message: "Something went wrong — Internal Error Occurred",
      request_id: "def456",
    });

    const detail = extractPlaidError(error);
    expect(detail).not.toBeNull();
    expect(detail!.errorType).toBe("INSTITUTION_ERROR");
    expect(detail!.errorCode).toBe("INSTITUTION_NOT_RESPONDING");
    expect(detail!.displayMessage).toBe(
      "Something went wrong — Internal Error Occurred"
    );
  });

  it("returns null for non-Axios errors", () => {
    expect(extractPlaidError(new Error("random"))).toBeNull();
    expect(extractPlaidError("string error")).toBeNull();
    expect(extractPlaidError(null)).toBeNull();
    expect(extractPlaidError(undefined)).toBeNull();
  });

  it("returns null for AxiosError without response data", () => {
    const error = new AxiosError("Network error");
    expect(extractPlaidError(error)).toBeNull();
  });
});

describe("logPlaidError", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logs structured Plaid error details", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = makePlaidAxiosError(400, {
      error_type: "INVALID_REQUEST",
      error_code: "INVALID_FIELD",
      error_message: "bad field",
      display_message: null,
      request_id: "req123",
    });

    logPlaidError("test-context", error);

    expect(spy).toHaveBeenCalledWith(
      "[Plaid] test-context:",
      "status=400",
      "type=INVALID_REQUEST",
      "code=INVALID_FIELD",
      'message="bad field"',
      'display="null"',
      "request_id=req123"
    );
  });

  it("falls back to raw logging for non-Plaid errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("network failure");

    logPlaidError("test-context", error);

    expect(spy).toHaveBeenCalledWith("[Plaid] test-context:", error);
  });
});
