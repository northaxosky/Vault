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

import { buildEmailHtml, sendAlertEmail } from "./email";

describe("buildEmailHtml", () => {
  it("renders title in an h2 tag", () => {
    const html = buildEmailHtml({
      title: "Test Title",
      bodyLines: ["Hello world"],
    });
    expect(html).toContain("<h2>Test Title</h2>");
  });

  it("wraps each body line in a paragraph tag", () => {
    const html = buildEmailHtml({
      title: "Title",
      bodyLines: ["Line one", "Line two"],
    });
    expect(html).toContain("<p>Line one</p>");
    expect(html).toContain("<p>Line two</p>");
  });

  it("renders the shared outer layout", () => {
    const html = buildEmailHtml({
      title: "Title",
      bodyLines: ["Body"],
    });
    expect(html).toContain("font-family: sans-serif");
    expect(html).toContain("max-width: 480px");
    expect(html).toContain("margin: 0 auto");
  });

  it("renders CTA button when ctaUrl and ctaLabel are provided", () => {
    const html = buildEmailHtml({
      title: "Title",
      bodyLines: ["Body"],
      ctaUrl: "https://example.com/action",
      ctaLabel: "Click Me",
    });
    expect(html).toContain('href="https://example.com/action"');
    expect(html).toContain("Click Me");
    expect(html).toContain("background: #2563eb");
  });

  it("omits CTA button when ctaUrl is missing", () => {
    const html = buildEmailHtml({
      title: "Title",
      bodyLines: ["Body"],
      ctaLabel: "Click Me",
    });
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("Click Me");
  });

  it("omits CTA button when ctaLabel is missing", () => {
    const html = buildEmailHtml({
      title: "Title",
      bodyLines: ["Body"],
      ctaUrl: "https://example.com",
    });
    expect(html).not.toContain("<a ");
  });

  it("renders footer when provided", () => {
    const html = buildEmailHtml({
      title: "Title",
      bodyLines: ["Body"],
      footer: "Some disclaimer text",
    });
    expect(html).toContain("Some disclaimer text");
    expect(html).toContain("font-size: 13px");
    expect(html).toContain("color: #666");
  });

  it("omits footer when not provided", () => {
    const html = buildEmailHtml({
      title: "Title",
      bodyLines: ["Body"],
    });
    // Should only have the body paragraph, no footer paragraph with disclaimer styling
    expect(html).not.toContain("color: #666");
  });
});

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

  it("uses buildEmailHtml for the HTML body", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-5" }, error: null });
    await sendAlertEmail("test@example.com", {
      type: "LARGE_TRANSACTION",
      title: "Large transaction",
      message: "Amazon: $150.00",
    });
    const call = sendMock.mock.calls[0][0];
    expect(call.html).toContain("max-width: 480px");
    expect(call.html).toContain("Amazon: $150.00");
    expect(call.html).toContain("View Dashboard");
  });
});
