import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { HOST_SPLIT_PORT, PORT, PROXIED_PORT } from "./e2e/helpers/ports.ts";

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
  // A committed test.only would quietly shrink the suite CI runs.
  forbidOnly: !!process.env.CI,
  // CI keeps the report so a red run can be read afterwards (uploaded by ci.yml).
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Tests the production build, which is what ships. Needs the dev database running.
      // PUBLIC_URL/ADMIN_URL must match the test origin, or the cross-site check refuses
      // logins. Equal, so the app is single-host here and redirects nothing.
      // STORAGE_LIMIT_MB is pinned so a local .env cannot change what the tests assume.
      command: `npm run build && PORT=${PORT} PUBLIC_URL=http://127.0.0.1:${PORT} ADMIN_URL=http://127.0.0.1:${PORT} SIGNUP_MODE=invite STORAGE_LIMIT_MB=500 SMTP_URL=smtp://127.0.0.1:1025 EMAIL_FROM='Habre <hello@example.test>' npm start`,
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
      command: `until curl -sf http://127.0.0.1:${PORT}/healthz >/dev/null 2>&1; do sleep 0.5; done; PORT=${PROXIED_PORT} STORAGE_LIMIT_MB=500 PUBLIC_URL=https://127.0.0.1:${PROXIED_PORT} ADMIN_URL=https://127.0.0.1:${PROXIED_PORT} npm start`,
      url: `http://127.0.0.1:${PROXIED_PORT}/healthz`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // SMTP_URL= and EMAIL_FROM= are blank on purpose: this server is email-off, and
      // node --env-file-if-exists=.env would otherwise fill them from a local .env
      // (it never overrides a variable already set, blank included).
      // Also waits for the primary build (same reason as the proxied server
      // above): npm start reads whatever is in build/, and starting while it
      // is still being written serves a build no test intended to run against.
      command: `until curl -sf http://127.0.0.1:${PORT}/healthz >/dev/null 2>&1; do sleep 0.5; done; SIGNUP_MODE=off STORAGE_LIMIT_MB=500 SMTP_URL= EMAIL_FROM= PORT=${HOST_SPLIT_PORT} PUBLIC_URL=http://127.0.0.1:${HOST_SPLIT_PORT} ADMIN_URL=http://localhost:${HOST_SPLIT_PORT} npm start`,
      url: `http://127.0.0.1:${HOST_SPLIT_PORT}/healthz`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
