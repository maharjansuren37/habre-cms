import { randomInt, randomUUID } from "node:crypto";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { messagesTo, tokenFromMail, waitForMail } from "./helpers/mail.ts";
import { HOST_SPLIT_PORT } from "./helpers/ports.ts";
import {
  createAdmin,
  deactivateUser,
  deleteTestUser,
  setRole,
  type TestUser,
  withDatabase,
} from "./helpers/users.ts";

test.beforeEach(async ({ page }) => {
  // Failed logins are rate-limited per IP; see auth.spec.ts.
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": ip });
});

test("an author changes their name from the shell link", async ({ page }) => {
  const user = createAdmin("Before Name");
  await setRole(user.email, "author");
  try {
    await logIn(page, user);
    await page.getByRole("link", { name: "Your account" }).click();
    await expect(page).toHaveURL("/admin/account");
    await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();

    await page.getByRole("textbox", { name: "Name", exact: true }).fill("After Name");
    await page.getByRole("button", { name: "Save name" }).click();

    await expect(page).toHaveURL("/admin/account?saved=name");
    await expect(page.getByRole("status")).toContainText("Your name is saved.");
    await expect(page.getByRole("complementary").getByText("After Name")).toBeVisible();
  } finally {
    await deleteTestUser(user.email);
  }
});

test("a blank name is refused below the field and what was typed is kept", async ({ page }) => {
  const user = createAdmin("Keep Name");
  await setRole(user.email, "author");
  try {
    await logIn(page, user);
    await page.goto("/admin/account");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("   ");
    await page.getByRole("button", { name: "Save name" }).click();

    const field = page.getByRole("textbox", { name: "Name", exact: true });
    await expect(page.getByText("Enter a name.")).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveValue("   ");
  } finally {
    await deleteTestUser(user.email);
  }
});

test("signed out, Your account leads to sign-in and back", async ({ page }) => {
  const user = createAdmin("Round Trip");
  try {
    await page.goto("/admin/account");
    await expect(page).toHaveURL("/admin/login?redirectTo=%2Fadmin%2Faccount");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL("/admin/account");
    await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
  } finally {
    await deleteTestUser(user.email);
  }
});

const NEW_PASSWORD = "a brand new passphrase";

function randomIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

async function savePassword(page: Page, current: string, next: string): Promise<void> {
  const section = page.getByRole("region", { name: "Password", exact: true });
  await section.getByLabel("Current password").fill(current);
  await section.getByLabel("New password").fill(next);
  // Waits for the answer: a repeated attempt shows the same message as the one
  // before it, so asserting on the page alone could pass on the stale one.
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/admin/account"),
  );
  await section.getByRole("button", { name: "Save password" }).click();
  await answered;
}

test("changing the password keeps this browser in and signs the other one out", async ({
  browser,
}) => {
  const user = createAdmin("Two Browsers");
  const contexts = [
    await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } }),
    await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } }),
  ];
  try {
    const [first, second] = await Promise.all(contexts.map((context) => context.newPage()));
    await logIn(first, user);
    await logIn(second, user);

    await first.goto("/admin/account");
    await savePassword(first, user.password, NEW_PASSWORD);
    await expect(first).toHaveURL("/admin/account?saved=password");
    await expect(first.getByRole("status")).toContainText("Your password is saved.");
    await first.reload();
    await expect(first).toHaveURL(/\/admin\/account/);
    await expect(first.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();

    await second.goto("/admin/account");
    await expect(second).toHaveURL(/\/admin\/login/);

    const fresh = await browser.newContext({
      extraHTTPHeaders: { "X-Forwarded-For": randomIp() },
    });
    contexts.push(fresh);
    const page = await fresh.newPage();
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.getByLabel("Password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL("/admin/posts");
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await deleteTestUser(user.email);
  }
});

test("a wrong current password is refused below its field and changes nothing", async ({
  page,
  browser,
}) => {
  const user = createAdmin("Wrong Current");
  try {
    await logIn(page, user);
    await page.goto("/admin/account");
    await savePassword(page, "not the password", NEW_PASSWORD);

    const field = page
      .getByRole("region", { name: "Password", exact: true })
      .getByLabel("Current password");
    await expect(page.getByText("That's not your current password.")).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");

    const fresh = await browser.newContext({
      extraHTTPHeaders: { "X-Forwarded-For": randomIp() },
    });
    try {
      await logIn(await fresh.newPage(), user);
    } finally {
      await fresh.close();
    }
  } finally {
    await deleteTestUser(user.email);
  }
});

test("five wrong current passwords lock the check, even for the right one", async ({
  page,
  browser,
}) => {
  const user = createAdmin("Lock Out");
  const otherContext = await browser.newContext({
    extraHTTPHeaders: { "X-Forwarded-For": randomIp() },
  });
  try {
    await logIn(page, user);
    const other = await otherContext.newPage();
    await logIn(other, user);
    await page.goto("/admin/account");
    for (let attempt = 0; attempt < 5; attempt++) {
      await savePassword(page, "not the password", NEW_PASSWORD);
      await expect(page.getByText("That's not your current password.")).toBeVisible();
    }
    await savePassword(page, "not the password", NEW_PASSWORD);
    await expect(page.getByText("Too many attempts. Try again in 15 minutes.")).toBeVisible();

    await savePassword(page, user.password, NEW_PASSWORD);
    await expect(page.getByText("Too many attempts. Try again in 15 minutes.")).toBeVisible();
    await expect(page).not.toHaveURL(/saved=password/);

    // Nothing changed: the other browser's session still holds, which a
    // password change (it bumps token_version) would have ended.
    await other.goto("/admin/account");
    await expect(other).toHaveURL("/admin/account");
  } finally {
    await otherContext.close();
    await deleteTestUser(user.email);
  }
});

// Email off: the server on HOST_SPLIT_PORT has no SMTP, so a change is immediate.
const OFF = `http://localhost:${HOST_SPLIT_PORT}`;

async function logInOff(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${OFF}/admin/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function saveEmail(page: Page, newEmail: string, password: string): Promise<void> {
  const section = page.getByRole("region", { name: "Email", exact: true });
  await section.getByLabel("New email").fill(newEmail);
  await section.getByLabel("Current password").fill(password);
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/admin/account"),
  );
  await section.getByRole("button", { name: "Save email" }).click();
  await answered;
}

async function openOff(page: Page, user: TestUser): Promise<void> {
  await logInOff(page, user.email, user.password);
  await page.waitForURL("**/admin/posts");
  await page.goto(`${OFF}/admin/account`);
}

test("with email off, a new email takes effect at once and the old one stops signing in", async ({
  page,
}) => {
  const user = createAdmin("Email Mover");
  const newEmail = `moved-${randomInt(1e9)}@example.test`;
  try {
    await openOff(page, user);
    await saveEmail(page, newEmail, user.password);
    await expect(page).toHaveURL(`${OFF}/admin/account?saved=email`);
    await expect(page.getByRole("status")).toContainText(`Your email is now ${newEmail}.`);

    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL("**/admin/login");
    await logInOff(page, user.email, user.password);
    await expect(page.getByText("That email and password don’t match.")).toBeVisible();
    await logInOff(page, newEmail, user.password);
    await expect(page).toHaveURL(`${OFF}/admin/posts`);
  } finally {
    await deleteTestUser(newEmail);
    await deleteTestUser(user.email);
  }
});

test("with email off, the current address is refused below the field and the input kept", async ({
  page,
}) => {
  const user = createAdmin("Same Email");
  try {
    await openOff(page, user);
    const typed = user.email.toUpperCase();
    await saveEmail(page, typed, user.password);
    const section = page.getByRole("region", { name: "Email", exact: true });
    await expect(section.getByText("That's already your email.")).toBeVisible();
    await expect(section.getByLabel("New email")).toHaveAttribute("aria-invalid", "true");
    await expect(section.getByLabel("New email")).toHaveValue(typed);
  } finally {
    await deleteTestUser(user.email);
  }
});

test("with email off, another account's address is refused below the field and the input kept", async ({
  page,
}) => {
  const user = createAdmin("Taker");
  const other = createAdmin("Holder");
  try {
    await openOff(page, user);
    await saveEmail(page, other.email, user.password);
    const section = page.getByRole("region", { name: "Email", exact: true });
    await expect(section.getByText("That email is already used by another account.")).toBeVisible();
    await expect(section.getByLabel("New email")).toHaveValue(other.email);
  } finally {
    await deleteTestUser(user.email);
    await deleteTestUser(other.email);
  }
});

test("with email off, a wrong current password is refused below its field and changes nothing", async ({
  page,
  browser,
}) => {
  const user = createAdmin("Wrong Pw Email");
  const newEmail = `unchanged-${randomInt(1e9)}@example.test`;
  try {
    await openOff(page, user);
    await saveEmail(page, newEmail, "not the password");
    const section = page.getByRole("region", { name: "Email", exact: true });
    await expect(section.getByText("That's not your current password.")).toBeVisible();
    await expect(section.getByLabel("Current password")).toHaveAttribute("aria-invalid", "true");
    await expect(section.getByLabel("New email")).toHaveValue(newEmail);

    const fresh = await browser.newContext({
      extraHTTPHeaders: { "X-Forwarded-For": randomIp() },
    });
    try {
      const other = await fresh.newPage();
      await logInOff(other, user.email, user.password);
      await expect(other).toHaveURL(`${OFF}/admin/posts`);
    } finally {
      await fresh.close();
    }
  } finally {
    await deleteTestUser(user.email);
  }
});

// Email on: the primary server sends through Mailpit.
async function requestLink(page: Page, newEmail: string, password: string): Promise<void> {
  const section = page.getByRole("region", { name: "Email", exact: true });
  await section.getByLabel("New email").fill(newEmail);
  await section.getByLabel("Current password").fill(password);
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/admin/account"),
  );
  await section.getByRole("button", { name: "Send a confirmation link" }).click();
  await answered;
}

test("with email on, a link goes to the new address and nothing changes yet", async ({
  page,
  browser,
}) => {
  const user = createAdmin("Link Sender");
  const newEmail = `e2e-${randomUUID()}@example.test`;
  try {
    await logIn(page, user);
    await page.goto("/admin/account");
    await requestLink(page, newEmail, user.password);
    await expect(page).toHaveURL("/admin/account?saved=link");
    const [text] = await waitForMail(newEmail, 1);
    expect(text).toContain("/confirm-email?token=");
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: `We sent a link to ${newEmail}. It works for 24 hours.` }),
    ).toBeVisible();

    const fresh = await browser.newContext({
      extraHTTPHeaders: { "X-Forwarded-For": randomIp() },
    });
    try {
      const other = await fresh.newPage();
      await other.goto("/admin/login");
      await other.getByLabel("Email").fill(newEmail);
      await other.getByLabel("Password").fill(user.password);
      await other.getByRole("button", { name: "Log in" }).click();
      await expect(other.getByText("That email and password don’t match.")).toBeVisible();
      await logIn(other, user);
    } finally {
      await fresh.close();
    }
  } finally {
    await deleteTestUser(user.email);
  }
});

test("with email on, a fourth request for one address is refused and sends nothing", async ({
  page,
}) => {
  const user = createAdmin("Link Limit");
  const newEmail = `e2e-${randomUUID()}@example.test`;
  try {
    await logIn(page, user);
    await page.goto("/admin/account");
    for (let attempt = 0; attempt < 3; attempt++) {
      await requestLink(page, newEmail, user.password);
      await expect(page).toHaveURL("/admin/account?saved=link");
      await page.goto("/admin/account");
    }
    await waitForMail(newEmail, 3);
    await requestLink(page, newEmail, user.password);
    await expect(page.getByText("Too many emails to that address. Try again later.")).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await messagesTo(newEmail)).toHaveLength(3);
  } finally {
    await deleteTestUser(user.email);
  }
});

test("with email on, the current address is refused below the field and nothing is sent", async ({
  page,
}) => {
  const user = createAdmin("Same Email On");
  try {
    await logIn(page, user);
    await page.goto("/admin/account");
    await requestLink(page, user.email, user.password);
    const section = page.getByRole("region", { name: "Email", exact: true });
    await expect(section.getByText("That's already your email.")).toBeVisible();
    await expect(section.getByLabel("New email")).toHaveValue(user.email);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await messagesTo(user.email)).toHaveLength(0);
  } finally {
    await deleteTestUser(user.email);
  }
});

test("with email on, another account's address is refused below the field and nothing is sent", async ({
  page,
}) => {
  const user = createAdmin("Taker On");
  const other = createAdmin("Holder On");
  try {
    await logIn(page, user);
    await page.goto("/admin/account");
    await requestLink(page, other.email, user.password);
    const section = page.getByRole("region", { name: "Email", exact: true });
    await expect(section.getByText("That email is already used by another account.")).toBeVisible();
    await expect(section.getByLabel("New email")).toHaveValue(other.email);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await messagesTo(other.email)).toHaveLength(0);
  } finally {
    await deleteTestUser(user.email);
    await deleteTestUser(other.email);
  }
});

// Step 6: /confirm-email, through Mailpit.
const NOT_USED = "This link has expired or was already used.";

async function emailOf(userEmail: string): Promise<string | undefined> {
  const rows = await withDatabase(
    (sql) => sql<{ email: string }[]>`select email from users where email = ${userEmail}`,
  );
  return rows[0]?.email;
}

function changeTokensFor(userEmail: string) {
  return withDatabase(
    (sql) => sql<{ used: Date | null }[]>`
      select t.used_at as used from email_tokens t join users u on u.id = t.user_id
      where u.email = ${userEmail} and t.purpose = 'email_change' order by t.created_at`,
  );
}

async function linkTo(page: Page, newEmail: string, password: string, nth: number) {
  await page.goto("/admin/account");
  await requestLink(page, newEmail, password);
  await expect(page).toHaveURL("/admin/account?saved=link");
  const texts = await waitForMail(newEmail, nth);
  return `/confirm-email?token=${tokenFromMail(texts[0], "/confirm-email")}`;
}

async function signIn(browser: Browser, email: string, password: string): Promise<string> {
  const context = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } });
  try {
    const page = await context.newPage();
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForLoadState("networkidle");
    return page.url();
  } finally {
    await context.close();
  }
}

test("confirming changes the email only on the button, then tells the old address", async ({
  page,
  browser,
}) => {
  const user = createAdmin("Confirmer");
  const newEmail = `e2e-${randomUUID()}@example.test`;
  try {
    await logIn(page, user);
    const link = await linkTo(page, newEmail, user.password, 1);
    await page.goto(link);
    await expect(
      page.getByRole("heading", { level: 1, name: "Confirm your new email" }),
    ).toBeVisible();
    expect(await emailOf(user.email)).toBe(user.email);

    await page.getByRole("button", { name: "Confirm new email" }).click();
    await expect(page).toHaveURL("/admin/account?saved=email");
    await expect(page.getByRole("status")).toContainText(`Your email is now ${newEmail}.`);
    expect(await emailOf(user.email)).toBeUndefined();

    expect(await signIn(browser, newEmail, user.password)).toMatch(/\/admin\/posts$/);
    expect(await signIn(browser, user.email, user.password)).toMatch(/\/admin\/login/);

    const [notice] = await waitForMail(user.email, 1);
    expect(notice).toContain("The email address for your Habre account was just changed.");
    expect(notice).not.toContain(newEmail);
  } finally {
    await deleteTestUser(newEmail);
    await deleteTestUser(user.email);
  }
});

test("the same link a second time shows the expired state", async ({ page }) => {
  const user = createAdmin("Twice");
  const newEmail = `e2e-${randomUUID()}@example.test`;
  try {
    await logIn(page, user);
    const link = await linkTo(page, newEmail, user.password, 1);
    await page.goto(link);
    await page.getByRole("button", { name: "Confirm new email" }).click();
    await expect(page).toHaveURL("/admin/account?saved=email");

    await page.goto(link);
    await page.getByRole("button", { name: "Confirm new email" }).click();
    await expect(page.getByText(NOT_USED)).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Your account" })).toHaveAttribute(
      "href",
      "/admin/account",
    );
    expect(await emailOf(newEmail)).toBe(newEmail);
  } finally {
    await deleteTestUser(newEmail);
    await deleteTestUser(user.email);
  }
});

test("a link older than the newest shows the expired state and changes nothing", async ({
  page,
}) => {
  const user = createAdmin("Older Link");
  const first = `e2e-${randomUUID()}@example.test`;
  const second = `e2e-${randomUUID()}@example.test`;
  try {
    await logIn(page, user);
    const oldLink = await linkTo(page, first, user.password, 1);
    await linkTo(page, second, user.password, 1);
    await page.goto(oldLink);
    await page.getByRole("button", { name: "Confirm new email" }).click();
    await expect(page.getByText(NOT_USED)).toBeVisible();
    expect(await emailOf(user.email)).toBe(user.email);
  } finally {
    await deleteTestUser(user.email);
  }
});

test("an address taken in between shows the taken state and uses nothing up", async ({ page }) => {
  const user = createAdmin("Late Taker");
  const other = createAdmin("Early Bird");
  const wanted = `e2e-${randomUUID()}@example.test`;
  try {
    await logIn(page, user);
    const link = await linkTo(page, wanted, user.password, 1);
    await withDatabase(
      (sql) => sql`update users set email = ${wanted} where email = ${other.email}`,
    );
    await page.goto(link);
    await page.getByRole("button", { name: "Confirm new email" }).click();
    await expect(page.getByText("That email is now used by another account.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Your account" })).toBeVisible();
    expect(await emailOf(user.email)).toBe(user.email);
    expect((await changeTokensFor(user.email)).map((row) => row.used)).toEqual([null]);
  } finally {
    await deleteTestUser(user.email);
    await deleteTestUser(wanted);
  }
});

test("a link used after the member was deactivated shows expired and uses nothing up", async ({
  page,
}) => {
  const user = createAdmin("Deactivated Later");
  const newEmail = `e2e-${randomUUID()}@example.test`;
  try {
    await logIn(page, user);
    const link = await linkTo(page, newEmail, user.password, 1);
    await deactivateUser(user.email);
    await page.goto(link);
    await page.getByRole("button", { name: "Confirm new email" }).click();
    await expect(page.getByText(NOT_USED)).toBeVisible();
    expect(await emailOf(user.email)).toBe(user.email);
    expect((await changeTokensFor(user.email)).map((row) => row.used)).toEqual([null]);
  } finally {
    await deleteTestUser(user.email);
  }
});

test("a reset link requested before the change stops working", async ({ page }) => {
  const user = createAdmin("Reset First");
  const newEmail = `e2e-${randomUUID()}@example.test`;
  try {
    await logIn(page, user);
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Send me a link" }).click();
    const [resetMail] = await waitForMail(user.email, 1);
    const resetToken = tokenFromMail(resetMail, "/reset-password");

    const link = await linkTo(page, newEmail, user.password, 1);
    await page.goto(link);
    await page.getByRole("button", { name: "Confirm new email" }).click();
    await expect(page).toHaveURL("/admin/account?saved=email");
    await waitForMail(user.email, 2);

    await page.goto(`/reset-password?token=${resetToken}`);
    await expect(page.getByText(NOT_USED)).toBeVisible();
  } finally {
    await deleteTestUser(newEmail);
    await deleteTestUser(user.email);
  }
});

test("with email off, /confirm-email is Not Found", async ({ request }) => {
  const response = await request.get(`http://localhost:${HOST_SPLIT_PORT}/confirm-email?token=x`, {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});
