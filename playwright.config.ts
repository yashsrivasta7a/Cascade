import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

// Provide safe defaults so the app can boot in CI.
const CLERK_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  // Clerk expects a pk_test_* shaped value; use a valid-looking placeholder
  // so Next/Clerk can initialize in CI without real secrets.
  "pk_test_00000000000000000000000000000000";
const CLERK_SECRET_KEY =
  process.env.CLERK_SECRET_KEY ??
  // Valid-looking placeholder for server-side init.
  "sk_test_00000000000000000000000000000000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev:e2e",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: String(PORT),
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: CLERK_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY,
      // Some environments/tools look for this if webhook routes are hit:
      CLERK_WEBHOOK_SECRET:
        process.env.CLERK_WEBHOOK_SECRET ?? "whsec_0000000000000000000000000000",
    },
  },
});
