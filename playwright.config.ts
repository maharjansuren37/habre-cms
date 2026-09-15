import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// The tests' helpers reach the development database, and the server needs its
// secrets. Variables already set in the environment win over the file.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  // Only e2e/ - Playwright's default pattern would also collect node:test's *.test.ts files.
  testDir: "e2e",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Tests the production build, which is what ships. Needs the dev database running.
    // APP_URL must match the test origin, or the cross-site check refuses logins.
    command: `npm run build && PORT=${PORT} APP_URL=http://127.0.0.1:${PORT} npm start`,
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
