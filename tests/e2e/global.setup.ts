import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

/**
 * Global setup for Playwright E2E tests.
 * This runs once before all tests to initialize Clerk Testing Tokens.
 * 
 * Testing Tokens bypass Clerk's bot detection, allowing automated
 * browser tests to interact with Clerk-powered authentication.
 */
setup("global setup", async ({}) => {
  await clerkSetup();
});
