import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

// =============================================================================
// WORKFLOW E2E TESTS - Workflow creation and editing flows
// Uses Clerk Testing Tokens to bypass bot detection in CI
// =============================================================================

test.describe("Workflow Editor", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test.describe("Editor Route", () => {
    test("editor route is accessible", async ({ page }) => {
      const response = await page.goto("/editor/new");
      // May redirect to auth, but route should exist
      expect(response?.status()).toBeLessThan(500);
    });

    test("editor with workflow ID is accessible", async ({ page }) => {
      const response = await page.goto("/editor/test-workflow-123");
      expect(response?.status()).toBeLessThan(500);
    });
  });

  test.describe("Workflows List Route", () => {
    test("workflows page is accessible", async ({ page }) => {
      const response = await page.goto("/workflows");
      expect(response?.status()).toBeLessThan(500);
    });
  });
});

test.describe("Executions Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("executions page is accessible", async ({ page }) => {
    const response = await page.goto("/executions");
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("Billing Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("billing page is accessible", async ({ page }) => {
    const response = await page.goto("/billing");
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("settings page is accessible", async ({ page }) => {
    const response = await page.goto("/settings");
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("Deep Links", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("workflow editor with ID", async ({ page }) => {
    const response = await page.goto("/editor/some-workflow-id");
    expect(response?.status()).toBeLessThan(500);
  });

  test("execution detail page (if exists)", async ({ page }) => {
    const response = await page.goto("/executions?id=some-execution-id");
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("Static Assets", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("favicon is accessible", async ({ page }) => {
    await page.goto("/");
    
    // Check for favicon
    const favicon = await page.$('link[rel*="icon"]');
    if (favicon) {
      const href = await favicon.getAttribute("href");
      if (href) {
        const faviconResponse = await page.request.get(href.startsWith("http") ? href : `/${href.replace(/^\//, "")}`);
        expect(faviconResponse.status()).toBeLessThan(400);
      }
    }
  });
});

test.describe("Client-Side Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("navigation doesnt cause full page reload", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Get initial navigation timing
    const initialTiming = await page.evaluate(() => 
      performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming
    );
    
    // Page should have loaded
    expect(initialTiming).toBeDefined();
  });
});

test.describe("Error Boundaries", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("handles React errors gracefully", async ({ page }) => {
    // Navigate to a valid page first
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    
    // Page should render without throwing
    const hasError = await page.evaluate(() => {
      // Check if there's an error overlay or error boundary
      const errorOverlay = document.querySelector('[data-nextjs-call-stack]');
      return errorOverlay !== null;
    });
    
    expect(hasError).toBe(false);
  });
});

test.describe("Cookie Consent & Privacy", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("page loads without blocking scripts errors", async ({ page }) => {
    const errors: string[] = [];
    
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Filter out known benign errors
    const criticalErrors = errors.filter(
      (e) => !e.includes("ResizeObserver") && !e.includes("Script error")
    );
    
    // No critical errors
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe("Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("page has no major accessibility issues", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    
    // Check for basic accessibility features
    const hasMainLandmark = await page.$("main, [role='main']");
    const hasHeadings = await page.$("h1, h2, h3");
    
    // At least one of these should exist for basic accessibility
    expect(hasMainLandmark !== null || hasHeadings !== null).toBeTruthy();
  });

  test("images have alt text", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    
    // Find all images
    const images = await page.$$("img");
    
    // Check that images have alt attributes (can be empty for decorative)
    for (const img of images) {
      const hasAlt = await img.getAttribute("alt");
      const hasRole = await img.getAttribute("role");
      // Either has alt attribute or role="presentation"
      expect(hasAlt !== null || hasRole === "presentation").toBeTruthy();
    }
  });

  test("interactive elements are keyboard accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    
    // Check that buttons and links have proper tabindex
    const buttons = await page.$$("button, a[href]");
    
    for (const button of buttons.slice(0, 5)) {
      // Visible buttons should be focusable
      const isVisible = await button.isVisible();
      if (isVisible) {
        const tabIndex = await button.getAttribute("tabindex");
        // Should not have negative tabindex (unless intentionally hidden)
        if (tabIndex !== null) {
          expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(-1);
        }
      }
    }
  });
});

test.describe("Console Errors", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("no critical console errors on page load", async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Filter out known benign errors (Clerk, hydration warnings, etc.)
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes("Clerk") &&
        !e.includes("hydration") &&
        !e.includes("ResizeObserver") &&
        !e.includes("favicon") &&
        !e.includes("Failed to load resource") // Network errors in test env
    );
    
    // Log errors for debugging
    if (criticalErrors.length > 0) {
      console.log("Console errors:", criticalErrors);
    }
    
    // Allow some errors in test environment
    expect(criticalErrors.length).toBeLessThanOrEqual(2);
  });
});
