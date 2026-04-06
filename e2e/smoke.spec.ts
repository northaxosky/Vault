import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("login page loads with expected heading", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("h1")).toHaveText("Vault");
  });

  test("unauthenticated user visiting /dashboard gets no server error", async ({
    page,
  }) => {
    // In demo mode the middleware lets everyone through, so this only
    // verifies the page loads without a 5xx.
    const response = await page.goto("/dashboard");

    expect(response?.status()).toBeLessThan(500);
  });

  test("page has a title", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveTitle(/.+/);
  });
});
