import { createHash, randomInt } from "node:crypto";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { textDocument } from "./helpers/documents.ts";
import { createInvite, deleteInvites, hashInvite, randomAddress } from "./helpers/invites.ts";
import { messagesTo, tokenFromMail, waitForMail } from "./helpers/mail.ts";
import { HOST_SPLIT_PORT } from "./helpers/ports.ts";
import { createSite, createSiteAdmin, deleteSite, siteOneId } from "./helpers/sites.ts";
import { createDraftFor, deleteEntriesBy, deleteTestUser, withDatabase } from "./helpers/users.ts";

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

test("the address field's description includes the sites domain suffix", async ({ page }) => {
  await page.goto("/signup");

  // The suffix is plain text after the input, and part of its accessible description.
  await expect(page.getByText(".localhost:3100", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your website’s address")).toHaveAccessibleDescription(
    /\.localhost:3100/,
  );
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your email");
  await expect(page.getByRole("main")).toContainText(`We sent a link to ${email}`);
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
  expect(response.status()).toBe(404);
});

const NEUTRAL = (email: string) => `If ${email} is waiting to be confirmed, we’ve sent a new link.`;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

test("/signup/sent without the cookie asks for the email; ?failed=1 says the send failed", async ({
  page,
}) => {
  await page.goto("/signup/sent");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your email");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send it again" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.goto("/signup/sent?failed=1");
  await expect(page.getByRole("alert")).toContainText("We couldn’t send the email");
});

test("Send it again sends a second email and only the newest link stays valid", async ({
  page,
}) => {
  const { email, address, code } = await newSignup();
  await fillSignup(page, { name: "Lena Novak", email, address, code });
  await expect(page).toHaveURL(/\/signup\/sent/);
  const [first] = await waitForMail(email, 1);

  await page.getByRole("button", { name: "Send it again" }).click();
  await expect(page.getByRole("status")).toContainText(NEUTRAL(email));
  const mails = await waitForMail(email, 2);
  const second = mails.find((text) => text !== first);
  if (!second) throw new Error("no second email");

  const rows = await withDatabase(
    (sql) => sql<{ hash: string; used: Date | null; live: boolean }[]>`
      select t.token_hash as hash, t.used_at as used, t.expires_at > now() as live
      from email_tokens t join users u on u.id = t.user_id
      where u.email = ${email} and t.purpose = 'verify'`,
  );
  expect(rows).toHaveLength(2);
  const byHash = new Map(rows.map((row) => [row.hash, row]));
  expect(byHash.get(sha256(tokenFromMail(first)))?.used).not.toBeNull();
  const newest = byHash.get(sha256(tokenFromMail(second)));
  expect(newest?.used).toBeNull();
  expect(newest?.live).toBe(true);

  // The first link no longer confirms; the second does.
  await page.goto(`/verify?token=${tokenFromMail(first)}`);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page.getByRole("alert")).toContainText("This link has expired or was already used");
  expect(await isConfirmed(email)).toBe(false);
  await page.goto(`/verify?token=${tokenFromMail(second)}`);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await page.waitForURL("**/start");
  expect(await isConfirmed(email)).toBe(true);
});

test("the reply is the same for no account, an unconfirmed one and a confirmed one", async ({
  browser,
}) => {
  const ask = async (email: string) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { "X-Forwarded-For": randomIp() },
    });
    const page = await context.newPage();
    await page.goto("/signup/sent");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send it again" }).click();
    const reply = await page.getByRole("status").innerText();
    await context.close();
    return reply;
  };
  const none = `e2e-none-${randomInt(1e9)}@example.test`;
  // A confirmed account: createSiteAdmin inserts its user as confirmed.
  const confirmedAddress = randomAddress();
  tracked.addresses.push(confirmedAddress);
  const { email: confirmed } = await createSiteAdmin(await createSite(confirmedAddress));

  const noneReply = await ask(none);
  const confirmedReply = await ask(confirmed);
  expect(noneReply).toContain(NEUTRAL(none));
  expect(confirmedReply).toContain(NEUTRAL(confirmed));
  expect(noneReply.replace(none, "X")).toBe(confirmedReply.replace(confirmed, "X"));

  await new Promise((resolve) => setTimeout(resolve, 1500));
  expect(await messagesTo(none)).toHaveLength(0);
  expect(await messagesTo(confirmed)).toHaveLength(0);
});

test("the fourth resend for one email in an hour is refused, from four different addresses", async ({
  page,
  request,
  baseURL,
}) => {
  const { email, address, code } = await newSignup();
  await fillSignup(page, { name: "Lena Novak", email, address, code });
  await expect(page).toHaveURL(/\/signup\/sent/);
  const resend = () =>
    request.post("/signup/sent", {
      headers: { Origin: baseURL ?? "", "X-Forwarded-For": randomIp() },
      form: { email },
      maxRedirects: 0,
    });
  for (let attempt = 1; attempt <= 3; attempt++) {
    expect((await resend()).status()).toBe(200);
  }
  const refused = await resend();
  expect(refused.status()).toBe(429);
  expect(await refused.text()).toContain("Too many requests, wait an hour");

  // The signup email and three resends; a fifth never arrives.
  expect(await waitForMail(email, 4)).toHaveLength(4);
});

const EXPIRED = "This link has expired or was already used";

async function isConfirmed(email: string): Promise<boolean> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ verified: Date | null }[]>`
      select email_verified_at as verified from users where email = ${email}`;
    return row.verified !== null;
  });
}

/** Signs up and returns the person and the link from their one email. */
async function signUpAndGetLink(page: Page) {
  const signup = await newSignup();
  await fillSignup(page, signup);
  await expect(page).toHaveURL(/\/signup\/sent/);
  const [mail] = await waitForMail(signup.email, 1);
  return { ...signup, token: tokenFromMail(mail), link: `/verify?token=${tokenFromMail(mail)}` };
}

test("journey 1: sign up, open the emailed link, confirm, and land in your own empty site", async ({
  page,
}) => {
  // Site 1 has content the new admin must never see.
  const owner = await createSiteAdmin(await siteOneId());
  const title = `Site one only ${randomInt(1e9)}`;
  await createDraftFor(owner.email, title, textDocument("hello"));
  try {
    const signup = await signUpAndGetLink(page);
    await page.goto(signup.link);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confirm your email");
    await page.getByRole("button", { name: "Confirm my email" }).click();

    await page.waitForURL("**/start");
    await page.getByRole("link", { name: "Start blank instead" }).click();
    await page.waitForURL("**/admin/posts");
    await expect(page.getByRole("complementary")).toContainText(signup.address);
    await expect(page.getByText(title)).toHaveCount(0);
    await page.goto("/admin/pages");
    await expect(page.getByText(title)).toHaveCount(0);
    expect(await isConfirmed(signup.email)).toBe(true);
    const [row] = await withDatabase(
      (sql) => sql<{ n: number }[]>`
        select count(*)::int as n from entries e join sites s on s.id = e.site_id
        where s.subdomain = ${signup.address}`,
    );
    expect(row.n).toBe(0);
  } finally {
    await deleteEntriesBy(owner.email);
    await deleteTestUser(owner.email);
  }
});

test("before confirming, the right password lands on Check your email and gives no session", async ({
  page,
}) => {
  const signup = await signUpAndGetLink(page);
  await page.context().clearCookies();
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(signup.email);
  await page.getByLabel("Password").fill("a long enough password");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/signup\/sent/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your email");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("a scanner opening the link first does not use it up", async ({ page, request }) => {
  const signup = await signUpAndGetLink(page);
  const scan = await request.get(signup.link, { headers: { "X-Forwarded-For": randomIp() } });
  expect(scan.status()).toBe(200);
  expect(await isConfirmed(signup.email)).toBe(false);

  await page.goto(signup.link);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await page.waitForURL("**/start");
});

test("pressing Confirm twice signs no one in the second time", async ({
  page,
  request,
  baseURL,
}) => {
  const signup = await signUpAndGetLink(page);
  await page.goto(signup.link);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await page.waitForURL("**/start");

  const again = await request.post("/verify", {
    headers: { Origin: baseURL ?? "", "X-Forwarded-For": randomIp() },
    form: { token: signup.token },
    maxRedirects: 0,
  });
  expect(again.status()).toBe(200);
  // The token is used up, and its account is confirmed, so the page says so.
  expect(await again.text()).toContain("Your email is already confirmed");
  expect(again.headers()["set-cookie"]).toBeUndefined();
});

test("an expired token confirms nothing", async ({ page }) => {
  const signup = await signUpAndGetLink(page);
  await withDatabase(async (sql) => {
    await sql`update email_tokens set expires_at = now() - interval '1 minute'
      where token_hash = ${sha256(signup.token)}`;
  });
  await page.goto(signup.link);
  await page.getByRole("button", { name: "Confirm my email" }).click();

  await expect(page.getByRole("alert")).toContainText(EXPIRED);
  expect(await isConfirmed(signup.email)).toBe(false);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("/verify with no token, or an unknown one, shows the expired-or-used state with a way to get a new link", async ({
  page,
}) => {
  await page.goto("/verify");
  await expect(page.getByRole("alert")).toContainText(EXPIRED);
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send me a new link" })).toBeVisible();
});

test("a token of an already confirmed account says so, with a link to log in", async ({ page }) => {
  const signup = await signUpAndGetLink(page);
  await page.goto(signup.link);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await page.waitForURL("**/start");
  await page.context().clearCookies();

  await page.goto(signup.link);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page.getByRole("main")).toContainText("Your email is already confirmed");
  await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/admin/login");
});
