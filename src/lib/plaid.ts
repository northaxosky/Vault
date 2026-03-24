import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

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
