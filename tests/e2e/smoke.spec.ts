import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test("app boots and routes to auth/dashboard", async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto("/");
  await expect(page).toHaveTitle(/Flowsmith/i);
  await expect(page).toHaveURL(/\/(sign-in|dashboard)/);
});
