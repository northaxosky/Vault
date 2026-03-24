import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendMock } = vi.hoisted(() => {
  const sendMock = vi.fn();
  return { sendMock };
});

vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = { send: sendMock };
    },
  };
});

import { sendAlertEmail } from "./email";

describe("sendAlertEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends email with correct subject for LARGE_TRANSACTION", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    await sendAlertEmail("test@example.com", {
      type: "LARGE_TRANSACTION",
      title: "Large transaction detected",
      message: "Amazon: $150.00 USD",
    });
    expect(sendMock).toHaveBeenCalledOnce();
    const call = sendMock.mock.calls[0][0];
    expect(call.subject).toContain("💳");
    expect(call.to).toBe("test@example.com");
  });

  it("sends email with correct subject for LOW_BALANCE", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-2" }, error: null });
    await sendAlertEmail("test@example.com", {
      type: "LOW_BALANCE",
      title: "Low balance warning",
      message: "Checking balance is $45.00 USD",
    });
    const call = sendMock.mock.calls[0][0];
    expect(call.subject).toContain("⚠️");
  });

  it("sends email with correct subject for BUDGET_OVERSPEND", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-3" }, error: null });
    await sendAlertEmail("test@example.com", {
      type: "BUDGET_OVERSPEND",
      title: "Budget exceeded",
      message: "FOOD_AND_DRINK: $500 spent of $400 budget",
    });
    const call = sendMock.mock.calls[0][0];
    expect(call.subject).toContain("📊");
  });

  it("throws when Resend returns error", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: "API key invalid" },
    });
    await expect(
      sendAlertEmail("test@example.com", {
        type: "LARGE_TRANSACTION",
        title: "Test",
        message: "Test",
      })
    ).rejects.toThrow("API key invalid");
  });

  it("uses default icon for unknown alert type", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-4" }, error: null });
    await sendAlertEmail("test@example.com", {
      type: "UNKNOWN_TYPE",
      title: "Unknown alert",
      message: "Something happened",
    });
    const call = sendMock.mock.calls[0][0];
    expect(call.subject).toContain("🔔");
  });
});
