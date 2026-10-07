import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { textDocument } from "./helpers/documents.ts";
import { createInvite, deleteInvites, randomAddress } from "./helpers/invites.ts";
import { tokenFromMail, waitForMail } from "./helpers/mail.ts";
import { HOST_SPLIT_PORT } from "./helpers/ports.ts";
import { createSite, createSiteAdmin, deleteSite, siteUrl } from "./helpers/sites.ts";
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

// Fills the login form the page is on. Tries again once when the login answers
// 503 ("Login is busy."), as helpers/auth.ts's logIn does (F-231): another
// worker can hold both password slots.
async function signIn(page: Page, user: TestUser): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    const answer = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /^\/admin\/login(\.data)?$/.test(new URL(response.url()).pathname),
    );
    await page.getByRole("button", { name: "Log in" }).click();
    if ((await answer).status() !== 503 || attempt === 2) return;
    await page.waitForTimeout(500);
  }
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

// The shape app/features/ai/test-proposal.ts's validProposal() has, inlined: the
// browser specs' tsconfig does not include app/.
function validProposal() {
  const hero = {
    kind: "hero",
    heading: "Welcome",
    body: "We make bread.",
    buttonLabel: "Visit",
    buttonTarget: "p2",
  };
  const text = { kind: "text", heading: "Details", paragraphs: ["One.", "Two."] };
  return {
    siteDescription: "A bakery.",
    brandColor: "#aa5500",
    pages: [
      {
        key: "p1",
        title: "Home",
        seoTitle: "Home - Bakery",
        seoDescription: "Fresh bread.",
        sections: [
          hero,
          { kind: "image-text", heading: "Our story", body: "Since 1999." },
          { kind: "cta", heading: "Talk to us", body: "We reply fast.", buttonLabel: "Contact" },
          text,
        ],
      },
      {
        key: "p2",
        title: "About",
        seoTitle: "About",
        seoDescription: "About us.",
        sections: [text],
      },
    ],
    navigation: ["p1", "p2"],
  };
}

// A review section, found by its h2 (a section without a label is not a region).
function sectionOf(page: Page, title: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) });
}

// Item 18b3, Step 6: /start/:runId, the wait. States are seeded and advanced as
// the owner, so no assertion races the fake provider's timer.
const UUID_PATH = /\/start\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function seedRun(
  status: string,
  options: {
    error?: string;
    kind?: string;
    description?: string;
    ageSeconds?: number;
    result?: unknown;
  } = {},
): Promise<string> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      insert into ai_runs (site_id, kind, description, status, error, result, created_at, finished_at)
      values (${siteId}, ${options.kind ?? "business"}, ${options.description ?? "A bakery called Crumb."},
              ${status}, ${options.error ?? null},
              ${options.result === undefined ? null : sql.json(options.result as never)},
              now() - make_interval(secs => ${options.ageSeconds ?? 5}),
              ${status === "running" ? null : new Date()})
      returning id
    `;
    return row.id;
  });
}

test.describe("the wait", () => {
  test.describe.configure({ mode: "serial" });

  test("a running run shows Building your site and a progress element", async ({ page }) => {
    const runId = await seedRun("running");
    await logInThenOpen(page, `/start/${runId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Building your site");
    await expect(page.getByRole("status")).toContainText(
      "Writing your pages, menu and search descriptions. This usually takes about a minute.",
    );
    await expect(page.getByRole("progressbar", { name: "Building your site" })).toBeVisible();
    await expect(page.getByText(/\d+ seconds? so far/)).toBeVisible();
  });

  test("a running run becoming succeeded changes the same status element, without a reload", async ({
    page,
  }) => {
    const runId = await seedRun("running");
    await logInThenOpen(page, `/start/${runId}`);
    const status = page.getByRole("status");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Building your site");
    await expect(status).toContainText("Writing your pages");
    await page.evaluate("window.__noReload = true");
    await status.evaluate((element) => {
      (element as unknown as { __mark: number }).__mark = 1;
    });
    await withDatabase(async (sql) => {
      await sql`
        update ai_runs set status = 'succeeded', finished_at = now(),
          result = ${sql.json(validProposal() as never)}
        where id = ${runId}
      `;
    });
    await expect(status).toHaveText("Your draft is ready to review.", { timeout: 5000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your draft is ready");
    expect(
      await status.evaluate((element) => (element as unknown as { __mark?: number }).__mark),
    ).toBe(1);
    expect(await page.evaluate("window.__noReload === true")).toBe(true);
  });

  test("a succeeded run shows the review: pages, sections, search text, menu, colour", async ({
    page,
  }) => {
    const runId = await seedRun("succeeded", { result: validProposal() });
    await logInThenOpen(page, `/start/${runId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your draft is ready");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("status")).toHaveText("Your draft is ready to review.");
    const pageHeadings = page.getByRole("heading", { level: 2 });
    await expect(pageHeadings).toHaveText(["Home", "About", "Menu", "Your site"]);

    const home = sectionOf(page, "Home");
    await expect(home.getByText("Home page", { exact: true })).toBeVisible();
    await expect(home.getByRole("listitem")).toHaveText([
      "Hero: Welcome",
      "Image and text: Our story",
      "Call to action: Talk to us",
      "Text: Details",
    ]);
    await expect(home.getByRole("term")).toHaveText(["Title in search results", "Description"]);
    await expect(home.getByRole("definition")).toHaveText(["Home - Bakery", "Fresh bread."]);
    const about = sectionOf(page, "About");
    await expect(about.getByRole("listitem")).toHaveText(["Text: Details"]);
    await expect(about.getByRole("definition")).toHaveText(["About", "About us."]);

    await expect(sectionOf(page, "Menu").getByRole("listitem")).toHaveText(["Home", "About"]);
    const site = sectionOf(page, "Your site");
    await expect(site.getByText("A bakery.")).toBeVisible();
    await expect(site.getByText("#aa5500")).toBeVisible();
    await expect(page.getByText("2 places for a photo are empty.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Change the description" })).toHaveAttribute(
      "href",
      `/start/about?kind=business&from=${runId}`,
    );
    await expect(page.getByRole("button", { name: "Use this draft" })).toBeVisible();
  });

  test("a site with a brand colour set shows no colour in the review", async ({ page }) => {
    await withDatabase(async (sql) => {
      await sql`update site_settings set brand_color = '#336699' where site_id = ${siteId}`;
    });
    const runId = await seedRun("succeeded", { result: validProposal() });
    await logInThenOpen(page, `/start/${runId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your draft is ready");
    await expect(page.getByText("Brand colour")).toHaveCount(0);
    await expect(page.getByText("#aa5500")).toHaveCount(0);
    await expect(page.getByText("#336699")).toHaveCount(0);
  });

  test("a succeeded run whose result is {} reads as failed and offers Try again", async ({
    page,
  }) => {
    const runId = await seedRun("succeeded", { result: {} });
    await logInThenOpen(page, `/start/${runId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Couldn't build your site");
    await expect(page.getByRole("status")).toContainText("Something went wrong on our side.");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("the review has no horizontal scroll at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const runId = await seedRun("succeeded", { result: validProposal() });
    await logInThenOpen(page, `/start/${runId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your draft is ready");
    expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
      true,
    );
  });

  test("a failed timeout run offers Try again, which starts a new run", async ({ page }) => {
    const runId = await seedRun("failed", { error: "timeout", kind: "blog" });
    await logInThenOpen(page, `/start/${runId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Couldn't build your site");
    await expect(page.getByRole("status")).toContainText(
      "Something went wrong on our side. Try again, or start blank.",
    );
    await expect(page.getByRole("link", { name: "Change the description" })).toHaveAttribute(
      "href",
      `/start/about?kind=blog&from=${runId}`,
    );
    await page.getByRole("button", { name: "Try again" }).click();
    await page.waitForURL((url) => UUID_PATH.test(url.pathname) && !url.pathname.includes(runId));
    const rows = await runRows();
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.kind === "blog")).toHaveLength(2);
  });

  test("a refused run offers only Change the description, and a retry is refused", async ({
    page,
  }) => {
    const runId = await seedRun("failed", { error: "refused", kind: "blog", description: "Tea." });
    await logInThenOpen(page, `/start/${runId}`);
    await expect(page.getByRole("status")).toContainText(
      "The AI wouldn't write a site from that description. Change it and try again, or start blank.",
    );
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    await page.getByRole("link", { name: "Change the description" }).click();
    await page.waitForURL("**/start/about?**");
    await expect(page.getByLabel("About your blog")).toHaveValue("Tea.");

    const status = await page.evaluate(async (id) => {
      const body = new URLSearchParams({ intent: "retry" });
      const response = await fetch(`/start/${id}`, { method: "POST", body });
      return response.status;
    }, runId);
    expect(status).toBe(400);
    expect(await runRows()).toHaveLength(1);
  });

  test("another site's run and a non-uuid are Not Found", async ({ page }) => {
    const otherSite = await createSite("onboarding-other");
    try {
      const otherRun = await withDatabase(async (sql) => {
        const [row] = await sql<{ id: string }[]>`
          insert into ai_runs (site_id, kind, description, status)
          values (${otherSite}, 'website', 'theirs', 'running') returning id
        `;
        return row.id;
      });
      await logInThenOpen(page, "/start");
      const foreign = await page.goto(`/start/${otherRun}`);
      expect(foreign?.status()).toBe(404);
      const bad = await page.goto("/start/not-a-uuid");
      expect(bad?.status()).toBe(404);
    } finally {
      await deleteSite(otherSite);
    }
  });

  test("an applied run goes to /admin", async ({ page }) => {
    const runId = await seedRun("applied");
    // Not through /start: an applied run closes onboarding, so it would redirect too.
    await logInThenOpen(page, "/admin/settings");
    await page.goto(`/start/${runId}`);
    await page.waitForURL(/\/admin(\/posts)?$/);
  });

  test("a running run created seven minutes ago shows Couldn't build your site", async ({
    page,
  }) => {
    const runId = await seedRun("running", { ageSeconds: 7 * 60 });
    await logInThenOpen(page, `/start/${runId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Couldn't build your site");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

// Item 18b3, Step 7: journey 1 as far as it is built, from the emailed link to
// the draft, on the primary server's fake provider (one real run each).
// Item 18b4a, Step 3: Use this draft. Read back as the owner.
type DraftPage = {
  id: string;
  title: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  blocksFormat: string;
  status: string;
  blocks: unknown;
};

async function pagesOfSite(): Promise<DraftPage[]> {
  return withDatabase(
    (sql) => sql<DraftPage[]>`
      select id, title, slug, seo_title as "seoTitle", seo_description as "seoDescription",
        blocks_format as "blocksFormat", status, blocks
      from entries where site_id = ${siteId} and type = 'page' order by created_at, title desc
    `,
  );
}

async function settingsOfSite() {
  return withDatabase(async (sql) => {
    const [row] = await sql<
      {
        navigation: { label: string; pageId: string }[];
        homePageId: string | null;
        siteDescription: string;
        brandColor: string;
        runStatus: string;
      }[]
    >`
      select navigation, home_page_id as "homePageId", site_description as "siteDescription",
        brand_color as "brandColor",
        (select status from ai_runs where site_id = ${siteId} order by created_at desc limit 1) as "runStatus"
      from site_settings where site_id = ${siteId}
    `;
    return row;
  });
}

function applyForm(page: Page, runId: string) {
  return page.request.post(`/start/${runId}`, {
    form: { intent: "apply" },
    headers: { Origin: new URL(page.url()).origin },
    maxRedirects: 0,
  });
}

test.describe("use this draft", () => {
  test.describe.configure({ mode: "serial" });

  test("Use this draft creates the draft pages, menu, home page and settings, and publishes nothing", async ({
    page,
  }) => {
    const runId = await seedRun("succeeded", { result: validProposal() });
    await logInThenOpen(page, `/start/${runId}`);
    await page.getByRole("button", { name: "Use this draft" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/start"));
    expect(new URL(page.url()).pathname).toMatch(/^\/admin(\/posts)?$/);

    const pages = await pagesOfSite();
    expect(pages.map((row) => row.title).sort()).toEqual(["About", "Home"]);
    const home = pages.find((row) => row.title === "Home") as DraftPage;
    const about = pages.find((row) => row.title === "About") as DraftPage;
    expect(home).toMatchObject({
      slug: "home",
      seoTitle: "Home - Bakery",
      seoDescription: "Fresh bread.",
      blocksFormat: "v4",
      status: "draft",
    });
    expect(about).toMatchObject({
      slug: "about",
      seoTitle: "About",
      seoDescription: "About us.",
      blocksFormat: "v4",
      status: "draft",
    });
    expect(JSON.stringify(home.blocks)).toContain('"href":"/about"');

    const settings = await settingsOfSite();
    expect(settings.navigation).toEqual([
      { label: "Home", pageId: home.id },
      { label: "About", pageId: about.id },
    ]);
    expect(settings.homePageId).toBe(home.id);
    expect(settings.siteDescription).toBe("A bakery.");
    expect(settings.brandColor).toBe("#aa5500");
    expect(settings.runStatus).toBe("applied");
  });

  test("a colour already set is kept", async ({ page }) => {
    await withDatabase(async (sql) => {
      await sql`update site_settings set brand_color = '#336699' where site_id = ${siteId}`;
    });
    const runId = await seedRun("succeeded", { result: validProposal() });
    await logInThenOpen(page, `/start/${runId}`);
    await page.getByRole("button", { name: "Use this draft" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/start"));
    const settings = await settingsOfSite();
    expect(settings.brandColor).toBe("#336699");
    expect(settings.runStatus).toBe("applied");
  });

  test("a page already at /about makes the draft's About /about-2", async ({ page }) => {
    await withDatabase(async (sql) => {
      await sql`
        insert into entries (site_id, type, title, slug, blocks, blocks_format, status, author_id)
        select ${siteId}, 'page', 'Old about', 'about', ${sql.json(textDocument("Old.") as never)}, 'v4',
               'draft', id
        from users where email = ${admin.email}
      `;
    });
    const runId = await seedRun("succeeded", { result: validProposal() });
    await logInThenOpen(page, `/start/${runId}`);
    await page.getByRole("button", { name: "Use this draft" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/start"));
    const pages = await pagesOfSite();
    expect(pages.find((row) => row.title === "About")?.slug).toBe("about-2");
    expect(pages.find((row) => row.title === "Old about")?.slug).toBe("about");
    const home = pages.find((row) => row.title === "Home") as DraftPage;
    expect(JSON.stringify(home.blocks)).toContain('"href":"/about-2"');
  });

  test("two applies at once create one set of pages, and each answers in under 1 s", async ({
    page,
  }) => {
    const runId = await seedRun("succeeded", { result: validProposal() });
    await logInThenOpen(page, `/start/${runId}`);
    const started = Date.now();
    const answers = await Promise.all(
      [0, 1].map(async () => {
        const response = await applyForm(page, runId);
        return { status: response.status(), ms: Date.now() - started };
      }),
    );
    console.log(`apply POST (two at once) answered in ${answers.map((a) => a.ms).join(", ")} ms`);
    for (const answer of answers) {
      expect(answer.status).toBe(302);
      expect(answer.ms).toBeLessThan(1000);
    }
    expect(await pagesOfSite()).toHaveLength(2);
  });

  test("a single apply answers in under 1 s", async ({ page }) => {
    const runId = await seedRun("succeeded", { result: validProposal() });
    await logInThenOpen(page, `/start/${runId}`);
    const started = Date.now();
    const response = await applyForm(page, runId);
    const ms = Date.now() - started;
    console.log(`apply POST answered in ${ms} ms`);
    expect(response.status()).toBe(302);
    expect(ms).toBeLessThan(1000);
    expect(await pagesOfSite()).toHaveLength(2);
  });

  test("the public site still shows the placeholder, and a draft's address is Not Found", async ({
    page,
  }) => {
    const runId = await seedRun("succeeded", { result: validProposal() });
    await logInThenOpen(page, `/start/${runId}`);
    await page.getByRole("button", { name: "Use this draft" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/start"));
    const address = await withDatabase(async (sql) => {
      const [row] = await sql<{ subdomain: string }[]>`
        select subdomain from sites where id = ${siteId}
      `;
      return row.subdomain;
    });
    await page.goto(siteUrl("/", address));
    await expect(page.getByText("This site is being set up.")).toBeVisible();
    const response = await page.goto(siteUrl("/about", address));
    expect(response?.status()).toBe(404);
  });

  test("a draft that no longer parses shows an alert and creates nothing", async ({ page }) => {
    const runId = await seedRun("succeeded", { result: validProposal() });
    await logInThenOpen(page, `/start/${runId}`);
    await withDatabase(async (sql) => {
      await sql`update ai_runs set result = ${sql.json({} as never)} where id = ${runId}`;
    });
    const response = await applyForm(page, runId);
    expect(response.status()).toBe(400);
    expect(await pagesOfSite()).toHaveLength(0);
    expect((await settingsOfSite()).runStatus).toBe("succeeded");
  });

  test("once a draft is used, /start, its steps and the run's page go to /admin, and a retry starts no run", async ({
    page,
  }) => {
    const runId = await seedRun("succeeded", { result: validProposal() });
    const failedId = await seedRun("failed", { error: "timeout" });
    await logInThenOpen(page, `/start/${runId}`);
    await page.getByRole("button", { name: "Use this draft" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/start"));
    for (const path of ["/start", "/start/about?kind=blog", `/start/${runId}`]) {
      await page.goto(path);
      expect(new URL(page.url()).pathname, path).toMatch(/^\/admin(\/posts)?$/);
    }
    const before = (await runRows()).length;
    const response = await page.request.post(`/start/${failedId}`, {
      form: { intent: "retry" },
      headers: { Origin: new URL(page.url()).origin },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers().location).toMatch(/\/admin$/);
    expect(await runRows()).toHaveLength(before);
  });
});

test.describe("journey 1, from the emailed link to the draft", () => {
  test.describe.configure({ mode: "serial" });

  const made: { addresses: string[]; codes: string[] } = { addresses: [], codes: [] };

  test.afterEach(async () => {
    for (const address of made.addresses.splice(0)) {
      const ids = await withDatabase(
        (sql) => sql<{ id: string }[]>`select id from sites where subdomain = ${address}`,
      );
      for (const { id } of ids) await deleteSite(id);
    }
    await deleteInvites(made.codes.splice(0));
  });

  /** Signs up with an invite, opens the emailed link and presses Confirm. */
  async function signUpAndConfirm(page: Page): Promise<void> {
    const address = randomAddress();
    const code = await createInvite();
    made.addresses.push(address);
    made.codes.push(code);
    const email = `e2e-${randomInt(1e9)}-${Date.now()}@example.test`;
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Lena Novak");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a long enough password");
    await page.getByLabel("Your website’s address").fill(address);
    await page.getByLabel("Invite code").fill(code);
    await page.getByRole("button", { name: "Create my website" }).click();
    await expect(page).toHaveURL(/\/signup\/sent/);
    const [mail] = await waitForMail(email, 1);
    await page.goto(`/verify?token=${tokenFromMail(mail)}`);
    await page.getByRole("button", { name: "Confirm my email" }).click();
    await page.waitForURL("**/start");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("What do you want to create?");
  }

  async function expectDraft(page: Page): Promise<void> {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Building your site");
    await expect(page).toHaveURL(UUID_PATH);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your draft is ready", {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { level: 2, name: "Home" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "About" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Your draft is ready to review.");
    await expect(page).toHaveURL(UUID_PATH);
  }

  test("through the app's own links: Confirm, Business, Continue, a description, the draft", async ({
    page,
  }) => {
    await signUpAndConfirm(page);
    await page.getByRole("radio", { name: /Business/ }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tell us about it");
    await page.getByLabel("About your business").fill("Crumb, a bakery for the neighbourhood.");
    await page.getByRole("button", { name: "Build my site" }).click();
    await expectDraft(page);
  });

  test("as full page loads: each step opened by its address", async ({ page }) => {
    await signUpAndConfirm(page);
    await page.goto("/start?kind=business");
    await expect(page.getByRole("radio", { name: /Business/ })).toBeChecked();
    await page.goto("/start/about?kind=business");
    await page.getByLabel("About your business").fill("Crumb, a bakery for the neighbourhood.");
    await page.getByRole("button", { name: "Build my site" }).click();
    await page.waitForURL(UUID_PATH);
    const runUrl = page.url();
    await page.goto(runUrl);
    await expectDraft(page);
  });

  test("an unavailable provider ends on Couldn't build; Change the description then succeeds", async ({
    page,
  }) => {
    await signUpAndConfirm(page);
    await page.goto("/start/about?kind=business");
    await page.getByLabel("About your business").fill("Crumb, a bakery. [fake:unavailable]");
    await page.getByRole("button", { name: "Build my site" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Couldn't build your site", {
      timeout: 15_000,
    });
    await expect(page).toHaveURL(UUID_PATH);
    await page.getByRole("link", { name: "Change the description" }).click();
    const about = page.getByLabel("About your business");
    await expect(about).toHaveValue("Crumb, a bakery. [fake:unavailable]");
    await about.fill("Crumb, a bakery for the neighbourhood.");
    await page.getByRole("button", { name: "Build my site" }).click();
    await expectDraft(page);
  });
});
