const OPTIONAL_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "NEXTAUTH_URL",
] as const;

export interface EnvConfig {
  demoMode: boolean;
  databaseUrl: string;
  nextAuthSecret: string;
  encryptionKey: string;
  plaidEnv: string;
  plaidClientId: string;
  plaidSecret: string;
  googleClientId?: string;
  googleClientSecret?: string;
  resendApiKey?: string;
  emailFrom?: string;
  nextAuthUrl?: string;
}

function requireVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateEncryptionKey(value: string): void {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes for AES-256)",
    );
  }
}

function resolvePlaidSecret(): string {
  const plaidEnv = process.env.PLAID_ENV || "sandbox";

  const candidates = [
    process.env.PLAID_SECRET,
    process.env[`PLAID_SECRET_${plaidEnv.toUpperCase()}`],
  ];

  const secret = candidates.find(Boolean);
  if (!secret) {
    throw new Error(
      `Missing Plaid secret for env "${plaidEnv}". Set PLAID_SECRET or PLAID_SECRET_${plaidEnv.toUpperCase()}.`,
    );
  }
  return secret;
}

type OptionalConfig = Pick<
  EnvConfig,
  "googleClientId" | "googleClientSecret" | "resendApiKey" | "emailFrom" | "nextAuthUrl"
>;

const OPTIONAL_KEY_MAP: Record<(typeof OPTIONAL_VARS)[number], keyof OptionalConfig> = {
  GOOGLE_CLIENT_ID: "googleClientId",
  GOOGLE_CLIENT_SECRET: "googleClientSecret",
  RESEND_API_KEY: "resendApiKey",
  EMAIL_FROM: "emailFrom",
  NEXTAUTH_URL: "nextAuthUrl",
};

function warnOptionalVars(): OptionalConfig {
  const result = {} as Record<string, string | undefined>;

  for (const name of OPTIONAL_VARS) {
    const value = process.env[name];
    if (!value) {
      console.warn(`[env] Optional variable ${name} is not set`);
    }
    result[OPTIONAL_KEY_MAP[name]] = value;
  }

  return result as OptionalConfig;
}

export function validateEnv(): EnvConfig {
  if (process.env.DEMO_MODE === "true") {
    return {
      demoMode: true,
      databaseUrl: process.env.DATABASE_URL ?? "",
      nextAuthSecret: process.env.NEXTAUTH_SECRET ?? "",
      encryptionKey: process.env.ENCRYPTION_KEY ?? "",
      plaidEnv: process.env.PLAID_ENV ?? "sandbox",
      plaidClientId: process.env.PLAID_CLIENT_ID ?? "",
      plaidSecret: "",
    };
  }

  const databaseUrl = requireVar("DATABASE_URL");
  const nextAuthSecret = requireVar("NEXTAUTH_SECRET");
  const encryptionKey = requireVar("ENCRYPTION_KEY");
  validateEncryptionKey(encryptionKey);

  const plaidEnv = process.env.PLAID_ENV || "sandbox";
  const plaidClientId = requireVar("PLAID_CLIENT_ID");
  const plaidSecret = resolvePlaidSecret();

  const optionals = warnOptionalVars();

  return {
    demoMode: false,
    databaseUrl,
    nextAuthSecret,
    encryptionKey,
    plaidEnv,
    plaidClientId,
    plaidSecret,
    ...optionals,
  };
}
