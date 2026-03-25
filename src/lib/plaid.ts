import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { isAxiosError } from "axios";

const plaidEnv = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;

const secretKey =
  plaidEnv === "development"
    ? process.env.PLAID_SECRET_DEVELOPMENT
    : plaidEnv === "production"
      ? process.env.PLAID_SECRET_PRODUCTION
      : process.env.PLAID_SECRET;

const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": secretKey,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
export { plaidEnv };

/**
 * Extract structured error details from a Plaid API error.
 * Plaid errors arrive as AxiosErrors with error info in response.data.
 */
export interface PlaidErrorDetail {
  statusCode: number | undefined;
  errorType: string | undefined;
  errorCode: string | undefined;
  errorMessage: string | undefined;
  displayMessage: string | null | undefined;
  requestId: string | undefined;
}

export function extractPlaidError(error: unknown): PlaidErrorDetail | null {
  if (isAxiosError(error) && error.response?.data) {
    const data = error.response.data;
    return {
      statusCode: error.response.status,
      errorType: data.error_type,
      errorCode: data.error_code,
      errorMessage: data.error_message,
      displayMessage: data.display_message,
      requestId: data.request_id,
    };
  }
  return null;
}

/**
 * Log a Plaid error with full structured details for debugging.
 * Falls back to logging the raw error if it's not a Plaid error.
 */
export function logPlaidError(context: string, error: unknown): void {
  const detail = extractPlaidError(error);
  if (detail) {
    console.error(
      `[Plaid] ${context}:`,
      `status=${detail.statusCode}`,
      `type=${detail.errorType}`,
      `code=${detail.errorCode}`,
      `message="${detail.errorMessage}"`,
      `display="${detail.displayMessage}"`,
      `request_id=${detail.requestId}`
    );
  } else {
    console.error(`[Plaid] ${context}:`, error);
  }
}
