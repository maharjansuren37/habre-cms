import { createHash, randomInt, randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
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
  return createSiteAdmin(siteId, "Lena Novak");
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
  const response = await request.get(`http://localhost:${HOST_SPLIT_PORT}/forgot-password`, {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});
