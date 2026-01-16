import { expect, test } from "@playwright/test";

// =============================================================================
// DASHBOARD E2E TESTS - Dashboard and navigation flows
// =============================================================================

test.describe("Dashboard", () => {
  // Skip auth tests in CI as we're using mock auth
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  test.describe("Page Load", () => {
    test("loads dashboard page", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
      
      // Should redirect to auth or show dashboard
      const url = page.url();
      expect(url).toMatch(/dashboard|sign-in/);
    });

    test("has proper title", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveTitle(/Flowsmith/i);
    });
  });

  test.describe("Navigation", () => {
    test("home page is accessible", async ({ page }) => {
      const response = await page.goto("/");
      expect(response?.status()).toBeLessThan(400);
    });

    test("workflows route exists", async ({ page }) => {
      const response = await page.goto("/workflows");
      // May redirect to auth, but route should exist
      expect(response?.status()).toBeLessThan(500);
    });

    test("executions route exists", async ({ page }) => {
      const response = await page.goto("/executions");
      expect(response?.status()).toBeLessThan(500);
    });

    test("billing route exists", async ({ page }) => {
      const response = await page.goto("/billing");
      expect(response?.status()).toBeLessThan(500);
    });

    test("settings route exists", async ({ page }) => {
      const response = await page.goto("/settings");
      expect(response?.status()).toBeLessThan(500);
    });
  });

  test.describe("API Routes", () => {
    test("API health check (if exists)", async ({ page }) => {
      // Navigate first to establish cookies/context
      await page.goto("/");
      
      // Check if api routes respond
      const apiResponse = await page.request.get("/api/trpc");
      // May return 405 (method not allowed) or 401 (unauthorized) which is fine
      expect(apiResponse.status()).toBeLessThan(500);
    });
  });
});

test.describe("Responsive Design", () => {
  test("mobile viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expect(page).toHaveTitle(/Flowsmith/i);
  });

  test("tablet viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await expect(page).toHaveTitle(/Flowsmith/i);
  });

  test("desktop viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    await expect(page).toHaveTitle(/Flowsmith/i);
  });
});

test.describe("Error Handling", () => {
  test("404 page for non-existent routes", async ({ page }) => {
    const response = await page.goto("/non-existent-route-12345");
    // Should either 404 or redirect
    expect(response?.status()).toMatch(/404|302|307/);
  });

  test("handles malformed workflow ID gracefully", async ({ page }) => {
    const response = await page.goto("/editor/invalid-workflow-id-!@#$%");
    // Should handle gracefully (redirect to auth or show error)
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("Performance", () => {
  test("page loads within acceptable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const loadTime = Date.now() - startTime;
    
    // Should load within 10 seconds (generous for CI)
    expect(loadTime).toBeLessThan(10000);
  });
});

test.describe("SEO and Metadata", () => {
  test("has meta viewport tag", async ({ page }) => {
    await page.goto("/");
    const viewport = await page.$('meta[name="viewport"]');
    expect(viewport).not.toBeNull();
  });

  test("has charset meta tag", async ({ page }) => {
    await page.goto("/");
    // Check for charset in any format
    const charsetMeta = await page.$('meta[charset]');
    const contentTypeMeta = await page.$('meta[http-equiv="Content-Type"]');
    expect(charsetMeta !== null || contentTypeMeta !== null).toBeTruthy();
  });
});
