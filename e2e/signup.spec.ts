import { createHash, randomInt } from "node:crypto";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createInvite, deleteInvites, hashInvite, randomAddress } from "./helpers/invites.ts";
import { tokenFromMail, waitForMail } from "./helpers/mail.ts";
import { HOST_SPLIT_PORT } from "./helpers/ports.ts";
import { deleteSite } from "./helpers/sites.ts";
import { withDatabase } from "./helpers/users.ts";

function randomIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

// What each test made, removed in afterEach.
const tracked: { addresses: string[]; codes: string[] } = { addresses: [], codes: [] };

async function newSignup() {
  const address = randomAddress();
  const code = await createInvite();
  tracked.addresses.push(address);
  tracked.codes.push(code);
  return {
    name: "Lena Novak",
    email: `e2e-${randomInt(1e9)}-${Date.now()}@example.test`,
    address,
    code,
  };
}

async function fillSignup(
  page: Page,
  v: { name: string; email: string; address: string; code: string },
  { submit = true } = {},
) {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(v.name);
  await page.getByLabel("Email").fill(v.email);
  await page.getByLabel("Password").fill("a long enough password");
  await page.getByLabel("Your website’s address").fill(v.address);
  await page.getByLabel("Invite code").fill(v.code);
  if (submit) await page.getByRole("button", { name: "Create my website" }).click();
}

test.afterEach(async () => {
  const addresses = tracked.addresses.splice(0);
  const codes = tracked.codes.splice(0);
  for (const address of addresses) {
    const ids = await withDatabase(
      (sql) => sql<{ id: string }[]>`select id from sites where subdomain = ${address}`,
    );
    for (const { id } of ids) await deleteSite(id);
  }
  await deleteInvites(codes);
});

// Each test gets its own address, so the per-IP limits added in step 7 never
// count one test's attempts towards another's (the pattern in auth.spec.ts).
test.beforeEach(async ({ page }) => {
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": ip });
});

test("the signup page shows its five fields by label", async ({ page }) => {
  await page.goto("/signup");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create your website");
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByLabel("Your website’s address")).toBeVisible();
  await expect(page.getByLabel("Invite code")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create my website" })).toBeVisible();
});

test("two errors are summarised, shown beside their fields, and the input is kept", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Lena Novak");
  await page.getByLabel("Email").fill("lena@example.test");
  await page.getByLabel("Password").fill("short");
  await page.getByLabel("Your website’s address").fill("-bad-");
  await page.getByLabel("Invite code").fill("7K2Q-M9XD-HC4V");
  await page.getByRole("button", { name: "Create my website" }).click();

  await expect(page.getByRole("alert")).toContainText("2 things to fix");

  const address = page.getByLabel("Your website’s address");
  const password = page.getByLabel("Password");
  await expect(address).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  // The error text is the field's accessible description, so a screen reader
  // reads it with the field.
  await expect(address).toHaveAccessibleDescription(/start or end with a dash/i);
  await expect(password).toHaveAccessibleDescription(/use at least 12 characters/i);
  for (const field of [address, password]) {
    const describedBy = (await field.getAttribute("aria-describedby")) ?? "";
    expect(describedBy.split(" ").length).toBeGreaterThan(0);
    for (const id of describedBy.split(" ")) {
      await expect(page.locator(`[id="${id}"]`)).toBeVisible();
    }
  }

  await expect(page.getByLabel("Your name")).toHaveValue("Lena Novak");
  await expect(page.getByLabel("Email")).toHaveValue("lena@example.test");
  await expect(address).toHaveValue("-bad-");
  await expect(page.getByLabel("Invite code")).toHaveValue("7K2Q-M9XD-HC4V");
  await expect(password).toHaveValue("");
});

test("a signup creates the site, the admin membership and settings, and sends one email", async ({
  page,
}) => {
  const { email, address, code } = await newSignup();
  await fillSignup(page, { name: "Lena Novak", email, address, code });

  await expect(page).toHaveURL(/\/signup\/sent/);
  const rows = await withDatabase(async (sql) => {
    const [site] = await sql<{ id: string }[]>`select id from sites where subdomain = ${address}`;
    const [user] = await sql<
      { id: string; verified: Date | null; name: string }[]
    >`select id, email_verified_at as verified, name from users where email = ${email}`;
    const members = await sql<{ role: string }[]>`
      select role from site_members where site_id = ${site.id} and user_id = ${user.id}`;
    const settings = await sql<{ title: string }[]>`
      select site_title as title from site_settings where site_id = ${site.id}`;
    const tokens = await sql<{ hash: string; purpose: string }[]>`
      select token_hash as hash, purpose from email_tokens where user_id = ${user.id}`;
    const [invite] = await sql<{ usedBy: string | null }[]>`
      select used_by_site_id as "usedBy" from invites where code_hash = ${hashInvite(code)}`;
    return { site, user, members, settings, tokens, invite };
  });
  expect(rows.user.verified).toBeNull();
  expect(rows.user.name).toBe("Lena Novak");
  expect(rows.members).toEqual([{ role: "admin" }]);
  expect(rows.settings).toEqual([{ title: address }]);
  expect(rows.invite.usedBy).toBe(rows.site.id);

  const [mail] = await waitForMail(email, 1);
  const token = tokenFromMail(mail);
  expect(mail).toContain(`/verify?token=${token}`);
  // Only the token's SHA-256 is stored; the token itself is not.
  expect(rows.tokens).toEqual([
    { hash: createHash("sha256").update(token).digest("hex"), purpose: "verify" },
  ]);
  expect(rows.tokens.some((row) => row.hash === token)).toBe(false);
});

test("an invite code works once", async ({ page, browser }) => {
  const first = await newSignup();
  await fillSignup(page, first);
  await expect(page).toHaveURL(/\/signup\/sent/);

  const other = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } });
  const second = await newSignup();
  const otherPage = await other.newPage();
  await fillSignup(otherPage, { ...second, code: first.code });
  await expect(otherPage.getByLabel("Invite code")).toHaveAccessibleDescription(
    "That invite code isn’t valid or has been used.",
  );
  await expect(otherPage.getByLabel("Invite code")).toHaveValue(first.code);
  await other.close();

  const counts = await withDatabase(async (sql) => {
    const [sites] = await sql<{ n: number }[]>`
      select count(*)::int as n from sites where subdomain = ${second.address}`;
    const [users] = await sql<{ n: number }[]>`
      select count(*)::int as n from users where email = ${second.email}`;
    return { sites: sites.n, users: users.n };
  });
  expect(counts).toEqual({ sites: 0, users: 0 });
});

test("a taken address is refused with two free suggestions, and the input is kept", async ({
  page,
  browser,
}) => {
  const first = await newSignup();
  await fillSignup(page, first);
  await expect(page).toHaveURL(/\/signup\/sent/);

  const other = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } });
  const second = await newSignup();
  const otherPage = await other.newPage();
  await fillSignup(otherPage, { ...second, address: first.address, name: "Lena Novak" });

  const field = otherPage.getByLabel("Your website’s address");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveValue(first.address);
  const description = (await field.getAttribute("aria-describedby")) ?? "";
  const text = (
    await Promise.all(
      description.split(" ").map((id) => otherPage.locator(`[id="${id}"]`).innerText()),
    )
  ).join(" ");
  const match = new RegExp(`${first.address} is taken\\. Try (\\S+) or (\\S+)\\.`).exec(text);
  expect(match, text).not.toBeNull();
  const suggestions = [match?.[1] ?? "", match?.[2] ?? ""];
  expect(suggestions[0]).toBe("lenanovak");
  const taken = await withDatabase(
    (sql) => sql<{ subdomain: string }[]>`
      select subdomain from sites where subdomain in ${sql(suggestions)}`,
  );
  expect(taken).toEqual([]);
  await expect(otherPage.getByLabel("Email")).toHaveValue(second.email);
  await expect(otherPage.getByLabel("Invite code")).toHaveValue(second.code);
  await other.close();
});

test("a taken email is refused, with a link to log in", async ({ page, browser }) => {
  const first = await newSignup();
  await fillSignup(page, first);
  await expect(page).toHaveURL(/\/signup\/sent/);

  const other = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } });
  const second = await newSignup();
  const otherPage = await other.newPage();
  await fillSignup(otherPage, { ...second, email: first.email });

  await expect(otherPage.getByLabel("Email")).toHaveAccessibleDescription(
    /An account with this email already exists/,
  );
  await expect(otherPage.getByRole("alert").getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/admin/login",
  );
  await other.close();
});

test("without a valid invite code, a taken email is not revealed", async ({ page, browser }) => {
  const first = await newSignup();
  await fillSignup(page, first);
  await expect(page).toHaveURL(/\/signup\/sent/);

  const other = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } });
  const second = await newSignup();
  const otherPage = await other.newPage();
  await fillSignup(otherPage, { ...second, email: first.email, code: first.code });

  await expect(otherPage.getByLabel("Invite code")).toHaveAccessibleDescription(
    "That invite code isn’t valid or has been used.",
  );
  await expect(otherPage.getByRole("alert")).not.toContainText("already exists");
  await other.close();
});

test("a reserved address is refused", async ({ page }) => {
  const signup = await newSignup();
  await fillSignup(page, { ...signup, address: "www" });

  await expect(page.getByLabel("Your website’s address")).toHaveAccessibleDescription(/reserved/);
  const count = await withDatabase(async (sql) => {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int as n from users where email = ${signup.email}`;
    return row.n;
  });
  expect(count).toBe(0);
});

test("two signups at once for one address: one wins, the other sees the taken error", async ({
  browser,
}) => {
  const address = randomAddress();
  const people = await Promise.all([newSignup(), newSignup()]);
  tracked.addresses.push(address);
  const contexts = await Promise.all(
    people.map(() => browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } })),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  await Promise.all(
    pages.map((page, i) => fillSignup(page, { ...people[i], address }, { submit: false })),
  );
  await Promise.all(
    pages.map((page) => page.getByRole("button", { name: "Create my website" }).click()),
  );

  await Promise.all(
    pages.map((page) =>
      expect(page.getByRole("heading", { level: 1 }).or(page.getByRole("alert"))).toBeVisible(),
    ),
  );
  await expect.poll(() => pages.filter((page) => /\/signup\/sent/.test(page.url())).length).toBe(1);
  const loser = pages.find((page) => !/\/signup\/sent/.test(page.url()));
  expect(loser).toBeDefined();
  await expect(loser?.getByRole("alert") as Locator).toContainText("is taken");
  await Promise.all(contexts.map((context) => context.close()));
});

test("the 11th signup attempt from one address within the hour is refused with 429", async ({
  request,
  baseURL,
}) => {
  const ip = randomIp();
  const send = (email: string) =>
    request.post("/signup", {
      headers: { Origin: baseURL ?? "", "X-Forwarded-For": ip },
      // Invalid on purpose (short password): it costs no password hashing but is counted.
      form: { name: "Lena", email, password: "short", address: "lena", invite: "x" },
      maxRedirects: 0,
    });
  for (let attempt = 1; attempt <= 10; attempt++) {
    expect((await send(`e2e-rl-${attempt}-${randomInt(1e9)}@example.test`)).status()).toBe(400);
  }
  const signup = await newSignup();
  const response = await request.post("/signup", {
    headers: { Origin: baseURL ?? "", "X-Forwarded-For": ip },
    form: {
      name: "Lena Novak",
      email: signup.email,
      password: "a long enough password",
      address: signup.address,
      invite: signup.code,
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(429);
  const count = await withDatabase(async (sql) => {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int as n from users where email = ${signup.email}`;
    return row.n;
  });
  expect(count).toBe(0);
});

test("the login page links to signup while signup is on", async ({ page }) => {
  await page.goto("/admin/login");

  const link = page.getByRole("link", { name: "Create your website" });
  await expect(link).toHaveAttribute("href", "/signup");
});

test("with signup off, /signup is Not Found", async ({ request }) => {
  const response = await request.get(`http://127.0.0.1:${HOST_SPLIT_PORT}/signup`, {
    maxRedirects: 0,
  });
  // The host-split server's admin host is `localhost`, so 127.0.0.1 (the public
  // host) redirects a platform path there; follow it to the answer.
  expect([302, 404]).toContain(response.status());
  const final = await request.get(`http://localhost:${HOST_SPLIT_PORT}/signup`, {
    maxRedirects: 0,
  });
  expect(final.status()).toBe(404);
});
