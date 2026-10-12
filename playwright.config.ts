import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { HOST_SPLIT_PORT, PORT, PROXIED_PORT } from "./e2e/helpers/ports.ts";
import {
  STRIPE_E2E_KEY,
  STRIPE_E2E_PRICE_MONTHLY,
  STRIPE_E2E_PRICE_YEARLY,
  STRIPE_E2E_WEBHOOK_SECRET,
} from "./e2e/helpers/stripe.ts";

// Billing is on for the primary server with values no test sends anywhere (item
// 21b), and blank on the other two so a local .env never turns it on there.
const STRIPE_ON = `STRIPE_SECRET_KEY=${STRIPE_E2E_KEY} STRIPE_WEBHOOK_SECRET=${STRIPE_E2E_WEBHOOK_SECRET} STRIPE_PRICE_MONTHLY=${STRIPE_E2E_PRICE_MONTHLY} STRIPE_PRICE_YEARLY=${STRIPE_E2E_PRICE_YEARLY} BILLING_TRIAL_DAYS=14`;
const STRIPE_OFF =
  "STRIPE_SECRET_KEY= STRIPE_WEBHOOK_SECRET= STRIPE_PRICE_MONTHLY= STRIPE_PRICE_YEARLY= BILLING_TRIAL_DAYS=";

// The tests' helpers reach the development database, and the server needs its
// secrets. Variables already set in the environment win over the file.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  // Only e2e/ - Playwright's default pattern would also collect node:test's *.test.ts files.
  testDir: "e2e",
  // Site 1 is Pro for the run, so the specs that visit Users keep working (item 20).
  globalSetup: "./e2e/helpers/pro-site-one.ts",
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
      // PLATFORM_URL must match the origin the tests sign in on, or the cross-site check
      // refuses logins. Public pages are at http://<address>.localhost:<port> (SITES_URL),
      // which Chromium and Node resolve to loopback; the platform is on 127.0.0.1.
      // STORAGE_LIMIT_MB and LAUNCH_STORAGE_LIMIT_MB are pinned so a local .env cannot change what the tests assume.
      // AI_PROVIDERS and AI_CREDITS_PER_MONTH are pinned (18b3): fake turns AI on with no
      // network, and a local .env's real key or allowance changes nothing.
      command: `npm run build && PORT=${PORT} SITES_URL=http://localhost:${PORT} PLATFORM_URL=http://127.0.0.1:${PORT} SEARCH_INDEXING=on SIGNUP_MODE=invite ${STRIPE_ON} AI_PROVIDERS=fake AI_CREDITS_PER_MONTH=1000 STORAGE_LIMIT_MB=500 LAUNCH_STORAGE_LIMIT_MB=1000 SMTP_URL=smtp://127.0.0.1:1025 EMAIL_FROM='Habre <hello@example.test>' npm start`,
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
      command: `until curl -sf http://127.0.0.1:${PORT}/healthz >/dev/null 2>&1; do sleep 0.5; done; PORT=${PROXIED_PORT} SEARCH_INDEXING=on ${STRIPE_OFF} STORAGE_LIMIT_MB=500 LAUNCH_STORAGE_LIMIT_MB=1000 SITES_URL=https://localhost:${PROXIED_PORT} PLATFORM_URL=https://127.0.0.1:${PROXIED_PORT} npm start`,
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
      command: `until curl -sf http://127.0.0.1:${PORT}/healthz >/dev/null 2>&1; do sleep 0.5; done; SIGNUP_MODE=off SEARCH_INDEXING=off ${STRIPE_OFF} OPENROUTER_API_KEY= STORAGE_LIMIT_MB=500 LAUNCH_STORAGE_LIMIT_MB=1000 SMTP_URL= EMAIL_FROM= PORT=${HOST_SPLIT_PORT} SITES_URL=http://localhost:${HOST_SPLIT_PORT} PLATFORM_URL=http://127.0.0.1:${HOST_SPLIT_PORT} npm start`,
      url: `http://127.0.0.1:${HOST_SPLIT_PORT}/healthz`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
