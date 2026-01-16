import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  
  // Global setup to initialize Clerk Testing Tokens
  globalSetup: require.resolve("./tests/e2e/global.setup.ts"),
  
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  
  // Use 1 worker to avoid overwhelming the server
  workers: 1,
  fullyParallel: false,
  
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  
  use: {
    baseURL,
    trace: "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  
  webServer: {
    // Use production build for stability in CI
    command: process.env.CI 
      ? "npm run start" 
      : "npm run dev:e2e",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
