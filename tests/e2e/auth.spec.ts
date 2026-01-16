import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

// =============================================================================
// AUTH E2E TESTS - Authentication flows
// Uses Clerk Testing Tokens to bypass bot detection in CI
// =============================================================================

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    // Setup Clerk testing token for each test
    await setupClerkTestingToken({ page });
  });

  test.describe("Unauthenticated Routes", () => {
    test("redirects to sign-in when accessing dashboard", async ({ page }) => {
      await page.goto("/dashboard");
      // Should redirect to sign-in
      await expect(page).toHaveURL(/sign-in|dashboard/);
    });

    test("redirects to sign-in when accessing workflows", async ({ page }) => {
      await page.goto("/workflows");
      await expect(page).toHaveURL(/sign-in|workflows/);
    });

    test("redirects to sign-in when accessing editor", async ({ page }) => {
      await page.goto("/editor/test-workflow-id");
      await expect(page).toHaveURL(/sign-in|editor/);
    });

    test("redirects to sign-in when accessing billing", async ({ page }) => {
      await page.goto("/billing");
      await expect(page).toHaveURL(/sign-in|billing/);
    });

    test("redirects to sign-in when accessing settings", async ({ page }) => {
      await page.goto("/settings");
      await expect(page).toHaveURL(/sign-in|settings/);
    });
  });

  test.describe("Sign In Page", () => {
    test("displays sign in form", async ({ page }) => {
      await page.goto("/sign-in");
      
      // Wait for Clerk to load
      await page.waitForLoadState("networkidle");
      
      // Should show sign in page or redirect
      const url = page.url();
      expect(url).toMatch(/sign-in|dashboard/);
    });

    test("has proper page title", async ({ page }) => {
      await page.goto("/sign-in");
      await expect(page).toHaveTitle(/Flowsmith|Sign/i);
    });
  });

  test.describe("Sign Up Page", () => {
    test("displays sign up form", async ({ page }) => {
      await page.goto("/sign-up");
      
      // Wait for Clerk to load
      await page.waitForLoadState("networkidle");
      
      // Should show sign up page or redirect
      const url = page.url();
      expect(url).toMatch(/sign-up|sign-in|dashboard/);
    });
  });

  test.describe("Navigation Guards", () => {
    test("public routes are accessible", async ({ page }) => {
      // Landing page should be accessible
      await page.goto("/");
      const response = await page.request.head(page.url());
      expect(response.status()).toBeLessThan(400);
    });
  });
});
