import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  test("login form has email and password inputs with correct types", async ({
    page,
  }) => {
    await page.goto("/login");

    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");

    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("email and password are required fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("#email")).toHaveAttribute("required", "");
    await expect(page.locator("#password")).toHaveAttribute("required", "");
  });

  test("sign-in button is present and enabled", async ({ page }) => {
    await page.goto("/login");

    const signInButton = page.getByRole("button", { name: "Sign In", exact: true });

    await expect(signInButton).toBeVisible();
    await expect(signInButton).toBeEnabled();
  });

  test("can toggle to registration mode", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: /create one/i }).click();

    await expect(page.locator("#name")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create account/i }),
    ).toBeVisible();
  });

  test("can toggle back to login mode from registration", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: /create one/i }).click();
    await expect(page.locator("#name")).toBeVisible();

    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("#name")).not.toBeVisible();
  });

  test("forgot password link is visible in login mode", async ({ page }) => {
    await page.goto("/login");

    const forgotLink = page.getByRole("link", { name: /forgot password/i });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute("href", "/forgot-password");
  });

  test("Google sign-in button is present", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("button", { name: /sign in with google/i }),
    ).toBeVisible();
  });
});
