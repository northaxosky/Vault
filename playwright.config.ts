import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DEMO_MODE: "true",
      AUTH_SECRET: "e2e-test-secret-do-not-use-in-production",
    },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
