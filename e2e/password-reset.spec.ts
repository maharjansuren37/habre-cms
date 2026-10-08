import { createHash, randomInt, randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { messagesTo, tokenFromMail, waitForMail } from "./helpers/mail.ts";
import { HOST_SPLIT_PORT } from "./helpers/ports.ts";
import { createSite, createSiteAdmin, deleteSite } from "./helpers/sites.ts";
import { withDatabase } from "./helpers/users.ts";

function randomIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const NEUTRAL = (email: string) =>
  `If an account uses ${email}, we’ve sent a link to reset its password.`;

const sites: string[] = [];

test.afterEach(async () => {
  for (const id of sites.splice(0)) await deleteSite(id);
});

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": randomIp() });
});

async function newAdmin() {
  const siteId = await createSite("reset");
  sites.push(siteId);
  const admin = await createSiteAdmin(siteId, "Lena Novak");
  const [settings] = await withDatabase(
    (sql) => sql<{ title: string }[]>`
      select site_title as title from site_settings where site_id = ${siteId}`,
  );
  return { ...admin, siteTitle: settings.title };
}

async function ask(page: Page, email: string) {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send me a link" }).click();
}

type TokenRow = { hash: string; used: Date | null; expires: Date; purpose: string };
function tokensFor(email: string) {
  return withDatabase(
    (sql) => sql<TokenRow[]>`
      select t.token_hash as hash, t.used_at as used, t.expires_at as expires, t.purpose
      from email_tokens t join users u on u.id = t.user_id
      where u.email = ${email} order by t.created_at`,
  );
}

test("the page has one h1, the email field and a way back to log in", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reset your password");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send me a link" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to log in" })).toHaveAttribute(
    "href",
    "/admin/login",
  );
  await expect(page).toHaveTitle("Reset your password - Habre");
});

test("a confirmed admin gets one email with a one-hour link, stored only as a hash", async ({
  page,
}) => {
  const admin = await newAdmin();
  await ask(page, admin.email);
  await expect(page.getByRole("status")).toContainText(NEUTRAL(admin.email));
  await expect(page.getByRole("status")).toContainText("The link works for 1 hour.");

  const [mail] = await waitForMail(admin.email, 1);
  const token = tokenFromMail(mail, "/reset-password");
  expect(mail).toContain(`/reset-password?token=${token}`);

  const rows = await tokensFor(admin.email);
  expect(rows).toHaveLength(1);
  expect(rows[0].purpose).toBe("reset");
  expect(rows[0].hash).toBe(sha256(token));
  expect(rows[0].hash).not.toBe(token);
  const minutes = (rows[0].expires.getTime() - Date.now()) / 60_000;
  expect(minutes).toBeGreaterThan(59);
  expect(minutes).toBeLessThan(61);
});

test("the answer is the same, and no email is sent, for people who cannot reset", async ({
  page,
}) => {
  const admin = await newAdmin();
  await ask(page, admin.email);
  const confirmedText = (await page.getByRole("status").innerText()).replaceAll(
    admin.email,
    "<email>",
  );
  await waitForMail(admin.email, 1);

  const unknown = `e2e-${randomUUID()}@example.test`;
  const unconfirmed = await newAdmin();
  const deactivated = await newAdmin();
  await withDatabase(async (sql) => {
    await sql`update users set email_verified_at = null where email = ${unconfirmed.email}`;
    await sql`
      update site_members set deactivated_at = now()
      where user_id = (select id from users where email = ${deactivated.email})`;
  });

  for (const email of [unknown, unconfirmed.email, deactivated.email]) {
    await ask(page, email);
    await expect(page.getByRole("status")).toContainText(NEUTRAL(email));
    const text = (await page.getByRole("status").innerText()).replaceAll(email, "<email>");
    expect(text).toBe(confirmedText);
  }
  // Sending is asynchronous: give a message that should not exist time to arrive.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  for (const email of [unknown, unconfirmed.email, deactivated.email]) {
    expect(await messagesTo(email)).toHaveLength(0);
  }
});

test("a second request uses up the first link", async ({ page }) => {
  const admin = await newAdmin();
  await ask(page, admin.email);
  const [first] = await waitForMail(admin.email, 1);
  await ask(page, admin.email);
  const mails = await waitForMail(admin.email, 2);
  const second = mails.find((text) => text !== first);
  if (!second) throw new Error("no second email");

  const byHash = new Map((await tokensFor(admin.email)).map((row) => [row.hash, row]));
  expect(byHash.size).toBe(2);
  expect(byHash.get(sha256(tokenFromMail(first, "/reset-password")))?.used).not.toBeNull();
  expect(byHash.get(sha256(tokenFromMail(second, "/reset-password")))?.used).toBeNull();
});

test("a fourth request for one email in an hour answers 429 and sends no fourth email", async ({
  request,
  baseURL,
}) => {
  const admin = await newAdmin();
  const post = (email: string) =>
    request.post("/forgot-password", {
      headers: { Origin: baseURL ?? "", "X-Forwarded-For": randomIp() },
      form: { email },
    });
  for (let i = 0; i < 3; i++) expect((await post(admin.email)).status()).toBe(200);
  const refused = await post(admin.email);
  expect(refused.status()).toBe(429);
  expect(await refused.text()).toContain("Too many requests, wait an hour.");
  await waitForMail(admin.email, 3);
});

test("a sixth request from one IP answers 429", async ({ request, baseURL }) => {
  const ip = randomIp();
  const post = (email: string) =>
    request.post("/forgot-password", {
      headers: { Origin: baseURL ?? "", "X-Forwarded-For": ip },
      form: { email },
    });
  for (let i = 0; i < 5; i++) {
    expect((await post(`e2e-${randomUUID()}@example.test`)).status()).toBe(200);
  }
  expect((await post(`e2e-${randomUUID()}@example.test`)).status()).toBe(429);
});

test("an invalid email is explained beside the field and the typed value is kept", async ({
  page,
}) => {
  await ask(page, "not-an-email");
  const field = page.getByLabel("Email");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription("Enter an email address like name@example.org.");
  const describedBy = (await field.getAttribute("aria-describedby")) ?? "";
  expect(describedBy).not.toBe("");
  for (const id of describedBy.split(" ")) {
    await expect(page.locator(`[id="${id}"]`)).toBeVisible();
  }
  await expect(field).toHaveValue("not-an-email");
});

test("with email off, /forgot-password is Not Found", async ({ request }) => {
  const response = await request.get(`http://127.0.0.1:${HOST_SPLIT_PORT}/forgot-password`, {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});

const NEW_PASSWORD = "a brand new passphrase 42";
const EXPIRED = "This link has expired or was already used.";

/** Asks for a link as the admin and returns the reset path (with token) from the email. */
async function linkFor(page: Page, email: string, count = 1): Promise<string> {
  await ask(page, email);
  const mails = await waitForMail(email, count);
  const rows = await tokensFor(email);
  const live = rows.find((row) => row.used === null);
  const token = mails
    .map((text) => tokenFromMail(text, "/reset-password"))
    .find((t) => sha256(t) === live?.hash);
  if (!token) throw new Error("no live token in the emails");
  return `/reset-password?token=${token}`;
}

async function choose(page: Page, password: string) {
  await page.getByLabel("New password").fill(password);
  await page.getByRole("button", { name: "Save and log in" }).click();
}

async function loginAttempt(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("journey 7: forgot, reset, signed in here and out everywhere else", async ({
  page,
  browser,
  baseURL,
}) => {
  const admin = await newAdmin();
  await logIn(page, admin);

  const other = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { "X-Forwarded-For": randomIp() },
  });
  const b = await other.newPage();
  try {
    await b.goto("/admin/login");
    await b.getByRole("link", { name: "Forgot your password?" }).click();
    await expect(b).toHaveURL(/\/forgot-password$/);
    await b.getByLabel("Email").fill(admin.email);
    await b.getByRole("button", { name: "Send me a link" }).click();
    const [mail] = await waitForMail(admin.email, 1);
    const token = tokenFromMail(mail, "/reset-password");
    await b.goto(`/reset-password?token=${token}`);
    await expect(b.getByRole("heading", { level: 1 })).toHaveText("Choose a new password");
    await expect(b.getByRole("main")).toHaveCount(1);
    await expect(b).toHaveTitle("Choose a new password - Habre");
    await expect(b.getByLabel("New password")).toHaveAttribute("autocomplete", "new-password");
    await expect(b.getByLabel("New password")).toHaveAccessibleDescription(
      "At least 12 characters",
    );
    await choose(b, NEW_PASSWORD);
    await b.waitForURL("**/admin");
    await expect(b.getByRole("heading", { level: 1 })).toBeVisible();
    // Their own site, after the redirect and again on a full page load (F-246).
    await expect(
      b.getByRole("complementary").getByText(admin.siteTitle, { exact: true }),
    ).toBeVisible();
    await b.reload();
    await expect(b).toHaveURL(/\/admin$/);
    await expect(
      b.getByRole("complementary").getByText(admin.siteTitle, { exact: true }),
    ).toBeVisible();
  } finally {
    // keep b open until the checks below
  }

  await page.goto("/admin/posts");
  await expect(page).toHaveURL(/\/admin\/login/);
  await other.close();

  await loginAttempt(page, admin.email, admin.password);
  await expect(page.getByText("That email and password don’t match.")).toBeVisible();
  await loginAttempt(page, admin.email, NEW_PASSWORD);
  await page.waitForURL("**/admin");
});

test("a scanner opening the link does not use it up", async ({ page, playwright, baseURL }) => {
  const admin = await newAdmin();
  const link = await linkFor(page, admin.email);
  const scanner = await playwright.request.newContext({ baseURL });
  const scanned = await scanner.get(link);
  expect(scanned.status()).toBe(200);
  await scanner.dispose();
  expect((await tokensFor(admin.email)).filter((r) => r.used === null)).toHaveLength(1);

  await page.goto(link);
  await choose(page, NEW_PASSWORD);
  await page.waitForURL("**/admin");
});

test("a link works once", async ({ page, baseURL }) => {
  const admin = await newAdmin();
  const link = await linkFor(page, admin.email);
  await page.goto(link);
  await choose(page, NEW_PASSWORD);
  await page.waitForURL("**/admin");
  await page.context().clearCookies();

  const again = await page.goto(link);
  expect(again?.status()).toBe(200);
  await expect(page.getByText(EXPIRED)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask for a new link" })).toHaveAttribute(
    "href",
    "/forgot-password",
  );
  // A second submit with the same token (form posted directly) is refused too.
  const resp = await page.request.post("/reset-password", {
    headers: { Origin: baseURL ?? "" },
    form: { token: link.split("token=")[1], password: "another passphrase 99" },
  });
  expect(await resp.text()).toContain(EXPIRED);

  await loginAttempt(page, admin.email, "another passphrase 99");
  await expect(page.getByText("That email and password don’t match.")).toBeVisible();
  await loginAttempt(page, admin.email, NEW_PASSWORD);
  await page.waitForURL("**/admin");
});

test("only the newest link works", async ({ page }) => {
  const admin = await newAdmin();
  await ask(page, admin.email);
  const [first] = await waitForMail(admin.email, 1);
  const second = await linkFor(page, admin.email, 2);
  await page.goto(`/reset-password?token=${tokenFromMail(first, "/reset-password")}`);
  await expect(page.getByText(EXPIRED)).toBeVisible();
  await page.goto(second);
  await expect(page.getByLabel("New password")).toBeVisible();
});

test("an expired link shows the expired state and changes nothing", async ({ page, baseURL }) => {
  const admin = await newAdmin();
  const link = await linkFor(page, admin.email);
  await page.goto(link);
  await expect(page.getByLabel("New password")).toBeVisible();
  await withDatabase(async (sql) => {
    await sql`
      update email_tokens set expires_at = now() - interval '1 minute'
      where user_id = (select id from users where email = ${admin.email})`;
  });
  await page.reload();
  await expect(page.getByText(EXPIRED)).toBeVisible();

  // The form was loaded while the link was live; posting it now is refused.
  const resp = await page.request.post("/reset-password", {
    headers: { Origin: baseURL ?? "" },
    form: { token: link.split("token=")[1], password: NEW_PASSWORD },
  });
  expect(await resp.text()).toContain(EXPIRED);
  await loginAttempt(page, admin.email, admin.password);
  await page.waitForURL("**/admin");
});

test("a membership deactivated after the request refuses the reset", async ({ page }) => {
  const admin = await newAdmin();
  const link = await linkFor(page, admin.email);
  const hashOf = () =>
    withDatabase(
      (sql) =>
        sql<{ h: string }[]>`select password_hash as h from users where email = ${admin.email}`,
    ).then(([row]) => row.h);
  const before = await hashOf();
  await page.goto(link);
  await withDatabase(async (sql) => {
    await sql`
      update site_members set deactivated_at = now()
      where user_id = (select id from users where email = ${admin.email})`;
  });
  await choose(page, NEW_PASSWORD);
  await expect(page.getByText(EXPIRED)).toBeVisible();
  expect(await hashOf()).toBe(before);
  expect((await tokensFor(admin.email)).filter((r) => r.used === null)).toHaveLength(1);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("a short password is explained beside the field and the link still works", async ({
  page,
}) => {
  const admin = await newAdmin();
  const link = await linkFor(page, admin.email);
  await page.goto(link);
  await choose(page, "short");
  const field = page.getByLabel("New password");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(
    "At least 12 characters Use at least 12 characters for the password.",
  );
  await choose(page, NEW_PASSWORD);
  await page.waitForURL("**/admin");
});

test("the login page links to the reset page; with email off it asks for an admin", async ({
  page,
  request,
}) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
    "href",
    "/forgot-password",
  );
  await page.goto(`http://127.0.0.1:${HOST_SPLIT_PORT}/admin/login`);
  await expect(page.getByText("Ask an admin of this site to reset it")).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveCount(0);
  const response = await request.get(`http://127.0.0.1:${HOST_SPLIT_PORT}/reset-password`, {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});

// F-244: completing a reset proves the person holds the mailbox, so it lifts
// the per-email login lock that their failed attempts set.
test("a completed reset lifts the login lock on that email", async ({ page, browser, baseURL }) => {
  const admin = await newAdmin();
  for (let attempt = 0; attempt < 5; attempt++) {
    await loginAttempt(page, admin.email, "not the password at all");
    await expect(page.getByText("That email and password don’t match.")).toBeVisible();
  }
  await loginAttempt(page, admin.email, admin.password);
  await expect(page.getByText("Too many attempts.")).toBeVisible();

  await page.goto(await linkFor(page, admin.email));
  await choose(page, NEW_PASSWORD);
  await page.waitForURL("**/admin");

  const fresh = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { "X-Forwarded-For": randomIp() },
  });
  try {
    const other = await fresh.newPage();
    await loginAttempt(other, admin.email, NEW_PASSWORD);
    await expect(other).toHaveURL(/\/admin$/);
  } finally {
    await fresh.close();
  }
});
