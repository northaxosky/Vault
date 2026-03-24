import { vi } from "vitest";

/**
 * Mock the auth module for testing API routes and components
 * that depend on session state.
 */
export function mockSession(user: {
  id: string;
  email: string;
  name?: string | null;
} | null) {
  vi.mock("@/lib/auth", () => ({
    auth: vi.fn().mockResolvedValue(
      user
        ? {
            user: {
              id: user.id,
              email: user.email,
              name: user.name ?? null,
            },
          }
        : null
    ),
  }));
}

/**
 * Mock the email module to avoid sending real emails in tests.
 */
export function mockEmail() {
  const sendVerificationEmail = vi.fn().mockResolvedValue({ id: "mock-email-id" });
  const sendPasswordResetEmail = vi.fn().mockResolvedValue({ id: "mock-email-id" });

  vi.mock("@/lib/email", () => ({
    sendVerificationEmail,
    sendPasswordResetEmail,
  }));

  return { sendVerificationEmail, sendPasswordResetEmail };
}

/**
 * Create a mock Request object for testing API routes.
 */
export function mockRequest(
  url: string,
  options?: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  }
) {
  return new Request(url, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  });
}
