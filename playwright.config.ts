import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests expect the stack to be running:
 *   make dev            (frontend :3000 + backend :8000 in mock mode)
 *   npm run test:e2e
 * Override the target with PLAYWRIGHT_BASE_URL.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
