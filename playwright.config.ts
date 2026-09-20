import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// A second server started as if it were behind Caddy: its APP_URL is https,
// so a request must carry X-Forwarded-Proto: https to look same-origin (F-21).
const PROXIED_PORT = 3101;

// The tests' helpers reach the development database, and the server needs its
// secrets. Variables already set in the environment win over the file.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  // Only e2e/ - Playwright's default pattern would also collect node:test's *.test.ts files.
  testDir: "e2e",
  // Login allows two password checks at once and answers "Login is busy" past
  // that (login-rate-limit.server.ts). Almost every test logs in, so more workers
  // than slots made a test fail at random once the suite grew (item 2b, step 6).
  workers: 2,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Tests the production build, which is what ships. Needs the dev database running.
      // APP_URL must match the test origin, or the cross-site check refuses logins.
      command: `npm run build && PORT=${PORT} APP_URL=http://127.0.0.1:${PORT} npm start`,
      url: `http://127.0.0.1:${PORT}/healthz`,
      // Never reuse: a server left running from an earlier run keeps serving the
      // build it started with, so a run can pass against code that is no longer
      // there. That happened here - a deliberately reverted fix still passed.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // Playwright starts both servers at once, and the build is not safe to run
      // twice in parallel - so this one waits for the first, which builds, to be
      // serving before it starts on the same build output. Without the wait it
      // would start on whatever build/ held from a previous run, which is how a
      // deliberately reverted fix once passed every test here.
      command: `until curl -sf http://127.0.0.1:${PORT}/healthz >/dev/null 2>&1; do sleep 0.5; done; PORT=${PROXIED_PORT} APP_URL=https://127.0.0.1:${PROXIED_PORT} npm start`,
      url: `http://127.0.0.1:${PROXIED_PORT}/healthz`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
