import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { textDocument } from "./helpers/documents.ts";
import { HOST_SPLIT_PORT } from "./helpers/ports.ts";
import { createSite, createSiteAdmin, deleteSite } from "./helpers/sites.ts";
import { setRole, type TestUser, withDatabase } from "./helpers/users.ts";

// Item 18b3, Step 4: /start, step 1. The primary server runs AI_PROVIDERS=fake
// (playwright.config.ts); the host-split server has AI off. Each test makes its
// own empty site and admin, never site 1.
let siteId: string;
let admin: TestUser;

test.beforeEach(async ({ page }) => {
  // Failed and busy logins are limited per IP; see auth.spec.ts.
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  });
  siteId = await createSite("onboarding");
  admin = await createSiteAdmin(siteId, "Start Admin");
});

test.afterEach(async () => {
  await deleteSite(siteId);
});

async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function logInThenOpen(page: Page, path: string): Promise<void> {
  await page.goto(`/admin/login?redirectTo=${encodeURIComponent(path)}`);
  await signIn(page, admin);
  await page.waitForURL(`**${path}`);
}

test("a new admin of an empty site sees step 1, and Continue is reachable by keyboard alone", async ({
  page,
}) => {
  await logInThenOpen(page, "/start");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What do you want to create?");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByText("Step 1 of 2")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start blank instead" })).toHaveAttribute(
    "href",
    "/admin",
  );

  const group = page.getByRole("group", { name: "Kind of website" });
  await expect(group.getByRole("radio")).toHaveCount(4);
  for (const name of ["Website", "Blog", "Business", "Portfolio"]) {
    await expect(group.getByRole("radio", { name })).toBeVisible();
  }

  // Tab into the group, arrow to Business (Website -> Blog -> Business), Tab to
  // Continue, Enter. Nothing is clicked.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Start blank instead" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(group.getByRole("radio", { name: "Website" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: "Business" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(group.getByRole("radio", { name: "Business" })).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Continue" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/start/about?kind=business");
});

test("/start?kind=blog pre-checks Blog", async ({ page }) => {
  await logInThenOpen(page, "/start?kind=blog");
  await expect(page.getByRole("radio", { name: "Blog" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Website" })).not.toBeChecked();
});

test("signed out, /start goes to sign in and back to /start", async ({ page }) => {
  await page.goto("/start");
  await page.waitForURL("**/admin/login?redirectTo=%2Fstart");
  await signIn(page, admin);
  await page.waitForURL("**/start");
  await expect(
    page.getByRole("heading", { level: 1, name: "What do you want to create?" }),
  ).toBeVisible();
});

test("an author of the same site gets Not Found", async ({ page }) => {
  await setRole(admin.email, "author");
  await page.goto("/admin/login");
  await signIn(page, admin);
  await page.waitForURL("**/admin/posts");
  const response = await page.goto("/start");
  expect(response?.status()).toBe(404);
});

test("a site with a published page goes to /admin", async ({ page }) => {
  await withDatabase(async (sql) => {
    await sql`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
      select ${siteId}, 'page', 'About', 'about', ${sql.json(textDocument("Hello.") as never)}, 'v4',
             'published', now(), id
      from users where email = ${admin.email}
    `;
  });
  await page.goto("/admin/login");
  await signIn(page, admin);
  await page.waitForURL("**/admin/posts");
  await page.goto("/start");
  await page.waitForURL("**/admin/posts");
  expect(new URL(page.url()).pathname).toBe("/admin/posts");
});

test("a suspended site goes to /admin", async ({ page }) => {
  await page.goto("/admin/login");
  await signIn(page, admin);
  await page.waitForURL("**/admin/posts");
  await withDatabase(async (sql) => {
    await sql`update sites set suspended_at = now() where id = ${siteId}`;
  });
  await page.goto("/start");
  await page.waitForURL("**/admin/posts");
});

test("with AI off, /start goes to /admin", async ({ page }) => {
  const off = `http://127.0.0.1:${HOST_SPLIT_PORT}`;
  await page.goto(`${off}/admin/login`);
  await signIn(page, admin);
  await page.waitForURL("**/admin/posts");
  await page.goto(`${off}/start`);
  await page.waitForURL("**/admin/posts");
});

test("step 1 has no horizontal scroll at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logInThenOpen(page, "/start");
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
    true,
  );
});

// Item 18b3, Step 5: /start/about. Tests that start a run share one serial
// block: the process allows two runs at once, and parallel workers could be
// refused as busy.
type RunRow = { kind: string; description: string; status: string };

async function runRows(): Promise<RunRow[]> {
  return withDatabase(
    (sql) => sql<RunRow[]>`select kind, description, status from ai_runs where site_id = ${siteId}`,
  );
}

async function openAbout(page: Page, kind = "business"): Promise<void> {
  await logInThenOpen(page, `/start/about?kind=${kind}`);
}

test.describe("step 2, Tell us about it", () => {
  test.describe.configure({ mode: "serial" });

  test("shows the step with a labelled textarea, a hint and Back", async ({ page }) => {
    await openAbout(page, "blog");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tell us about it");
    await expect(page.getByText("Step 2 of 2")).toBeVisible();
    await expect(
      page.getByText(
        "A sentence or two is enough: what it's called, what you do and who it's for.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("About your blog")).toBeVisible();
    await expect(page.getByText("10 to 2,000 characters.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/start?kind=blog",
    );
  });

  test("a missing or unknown kind goes back to step 1", async ({ page }) => {
    await logInThenOpen(page, "/start");
    await page.goto("/start/about");
    await page.waitForURL("**/start");
    await page.goto("/start/about?kind=castle");
    await page.waitForURL("**/start");
  });

  test("a 9-character description shows the field error and starts no run", async ({ page }) => {
    await openAbout(page);
    await page.getByLabel("About your business").fill("123456789");
    await page.getByRole("button", { name: "Build my site" }).click();
    const field = page.getByLabel("About your business");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveValue("123456789");
    await expect(page.getByText("Write at least 10 characters.")).toBeVisible();
    expect(await runRows()).toHaveLength(0);
  });

  test("a valid description starts a run and lands on its page", async ({ page }) => {
    await openAbout(page, "portfolio");
    await page.getByLabel("About your portfolio").fill("  Photos of mountains by Lena.  ");
    await page.getByRole("button", { name: "Build my site" }).click();
    await page.waitForURL(/\/start\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const rows = await runRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "portfolio",
      description: "Photos of mountains by Lena.",
    });
  });

  test("a site out of allowance sees the renewal date and no run starts", async ({ page }) => {
    await withDatabase(async (sql) => {
      await sql`
        insert into ai_runs (site_id, kind, description, status, credits, finished_at)
        values (${siteId}, 'website', 'earlier', 'succeeded', 1000, now())
      `;
    });
    await openAbout(page);
    await page.getByLabel("About your business").fill("A bakery in Fitzroy called Crumb.");
    await page.getByRole("button", { name: "Build my site" }).click();
    const now = new Date();
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const renews = `1 ${months[(now.getUTCMonth() + 1) % 12]}`;
    await expect(page.getByRole("alert")).toContainText(`It renews on ${renews}.`);
    await expect(page.getByLabel("About your business")).toHaveValue(
      "A bakery in Fitzroy called Crumb.",
    );
    expect(await runRows()).toHaveLength(1);
  });

  test("a running run sends step 1 and step 2 to its page", async ({ page }) => {
    const runId = await withDatabase(async (sql) => {
      const [row] = await sql<{ id: string }[]>`
        insert into ai_runs (site_id, kind, description, status)
        values (${siteId}, 'website', 'in flight', 'running')
        returning id
      `;
      return row.id;
    });
    await page.goto("/admin/login");
    await signIn(page, admin);
    await page.waitForURL("**/admin/posts");
    await page.goto("/start");
    await page.waitForURL(`**/start/${runId}`);
    await page.goto("/start/about?kind=blog");
    await page.waitForURL(`**/start/${runId}`);
  });

  test("from= prefills the description of this site's run", async ({ page }) => {
    const runId = await withDatabase(async (sql) => {
      const [row] = await sql<{ id: string }[]>`
        insert into ai_runs (site_id, kind, description, status, error, finished_at)
        values (${siteId}, 'blog', 'A blog about tea.', 'failed', 'unavailable', now())
        returning id
      `;
      return row.id;
    });
    await logInThenOpen(page, `/start/about?kind=blog&from=${runId}`);
    await expect(page.getByLabel("About your blog")).toHaveValue("A blog about tea.");
    await page.goto("/start/about?kind=blog&from=not-a-uuid");
    await expect(page.getByLabel("About your blog")).toHaveValue("");
  });

  test("a POST to /start/about for a site with a published page starts no run", async ({
    page,
  }) => {
    await withDatabase(async (sql) => {
      await sql`
        insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
        select ${siteId}, 'page', 'About', 'about', ${sql.json(textDocument("Hello.") as never)}, 'v4',
               'published', now(), id
        from users where email = ${admin.email}
      `;
    });
    await page.goto("/admin/login");
    await signIn(page, admin);
    await page.waitForURL("**/admin/posts");
    const finalPath = await page.evaluate(async () => {
      const body = new URLSearchParams({
        kind: "business",
        description: "A bakery in Fitzroy called Crumb.",
      });
      const response = await fetch("/start/about", { method: "POST", body });
      return new URL(response.url).pathname;
    });
    expect(finalPath).not.toMatch(/^\/start\/[0-9a-f-]{36}$/);
    expect(await runRows()).toHaveLength(0);
  });
});
