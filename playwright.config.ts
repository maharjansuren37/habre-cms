import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  // Only e2e/ - Playwright's default pattern would also collect node:test's *.test.ts files.
  testDir: "e2e",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Tests the production build, which is what ships. Needs the dev database running.
    command: `npm run build && PORT=${PORT} npm start`,
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
