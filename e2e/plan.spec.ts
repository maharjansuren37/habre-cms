import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { textDocument } from "./helpers/documents.ts";
import { HOST_SPLIT_PORT, PORT } from "./helpers/ports.ts";
import { createSiteAdmin, createSiteWithAddress, deleteSite, siteUrl } from "./helpers/sites.ts";
import { setRole, withDatabase } from "./helpers/users.ts";

// Item 21a, Step 6: the "Made with Habre" credit follows the plan. Each test
// makes a site of its own (F-103).

const PLATFORM = `http://127.0.0.1:${PORT}`;

let siteId: string;
let address: string;
let adminEmail: string;
let adminUser: Awaited<ReturnType<typeof createSiteAdmin>>;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  });
  const site = await createSiteWithAddress("plan");
  siteId = site.id;
  address = site.address;
  adminUser = await createSiteAdmin(siteId, "Plan Admin");
  adminEmail = adminUser.email;
  await withDatabase(async (sql) => {
    await sql`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
      select ${siteId}, 'page', 'Plan Page', 'plan-page',
             ${sql.json(textDocument("Hello.") as never)}, 'v4', 'published', now(), id
      from users where email = ${adminEmail}
    `;
  });
});

test.afterEach(async () => {
  await deleteSite(siteId);
});

async function makePaid() {
  await withDatabase((sql) => sql`update sites set plan = 'paid' where id = ${siteId}`);
}

test("a Free site's page has a Made with Habre link in its footer, to the platform", async ({
  page,
}) => {
  await page.goto(siteUrl("/plan-page", address));

  const link = page.getByRole("contentinfo").getByRole("link", { name: "Made with Habre" });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", PLATFORM);
});

test("a Launch site's page has no Made with Habre link", async ({ page }) => {
  await makePaid();

  await page.goto(siteUrl("/plan-page", address));

  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Made with Habre" })).toHaveCount(0);
});

test("the admin Preview shows the credit the way the public page does", async ({ page }) => {
  await logIn(page, adminUser);
  await page.goto("/admin/preview/plan-page");
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Made with Habre" }),
  ).toHaveAttribute("href", PLATFORM);

  await makePaid();
  await page.goto("/admin/preview/plan-page");
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Made with Habre" })).toHaveCount(0);
});

// Step 8: /admin/plan.

test("an admin sees the Free plan, its storage and AI meters, and what Launch adds", async ({
  page,
}) => {
  await logIn(page, adminUser);
  await page.getByRole("link", { name: "Plan", exact: true }).click();

  await expect(page).toHaveURL(/\/admin\/plan$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plan");
  await expect(page.getByText("Your site is on the Free plan.")).toBeVisible();
  await expect(page.getByText("0 MB of 500 MB used")).toBeVisible();
  await expect(page.getByRole("meter", { name: "Storage" })).toHaveAttribute("max", "524288000");
  await expect(page.getByRole("meter", { name: "AI allowance" })).toBeVisible();
  const adds = page.getByRole("region", { name: "What Launch adds" });
  await expect(adds.getByRole("listitem").filter({ hasText: "1000 MB of storage" })).toHaveCount(1);
  await expect(adds.getByRole("listitem").filter({ hasText: "Made with Habre" })).toHaveCount(1);
  // Billing is on for this server (21b): a way to pay, not "coming soon".
  await expect(page.getByText("Paid plans are coming soon.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start your 14-day free trial" })).toBeVisible();
});

test("a Launch site sees the Launch storage limit", async ({ page }) => {
  await makePaid();
  await logIn(page, adminUser);
  await page.goto("/admin/plan");

  await expect(page.getByText("Your site is on the Launch plan.")).toBeVisible();
  await expect(page.getByText("0 MB of 1000 MB used")).toBeVisible();
  await expect(page.getByRole("meter", { name: "Storage" })).toHaveAttribute("max", "1048576000");
});

test("an author or editor gets a 404 and no Plan link", async ({ page }) => {
  for (const role of ["author", "editor"] as const) {
    const user = await createSiteAdmin(siteId, `Plan ${role}`);
    await setRole(user.email, role);
    await page.context().clearCookies();
    await logIn(page, user);
    await expect(page.getByRole("link", { name: "Plan", exact: true })).toHaveCount(0);
    const response = await page.goto("/admin/plan");
    expect(response?.status()).toBe(404);
  }
});

// Item 21b, Step 7: paying for Launch. The buttons are asserted, not pressed:
// no test reaches Stripe (Checkout is a manual check, needs-you.md). Stripe's
// prices cannot be read here, so the choices carry no amounts.

async function setBilling(columns: Record<string, string | Date | null>) {
  await withDatabase(async (sql) => {
    await sql`update sites set ${sql(columns)} where id = ${siteId}`;
  });
}

test("a new Free site is offered monthly and yearly, and a trial", async ({ page }) => {
  await logIn(page, adminUser);
  await page.goto("/admin/plan");

  const choices = page.getByRole("group", { name: "Choose how to pay" });
  await expect(choices.getByRole("radio", { name: /^Monthly/ })).toBeChecked();
  await expect(choices.getByRole("radio", { name: /^Yearly/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start your 14-day free trial" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage billing" })).toHaveCount(0);
});

test("a site that has had a subscription is offered Upgrade with no trial, and Manage billing", async ({
  page,
}) => {
  await setBilling({
    billing_customer_id: "cus_plan_spec",
    billing_subscription_id: "sub_plan_spec",
    billing_status: "canceled",
  });
  await logIn(page, adminUser);
  await page.goto("/admin/plan");

  await expect(page.getByRole("button", { name: "Upgrade" })).toBeVisible();
  await expect(page.getByRole("button", { name: /free trial/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Manage billing" })).toBeVisible();
  await expect(page.getByText("Your Launch subscription has ended.")).toBeVisible();
});

test("a trialing site sees its trial end and no way to pay again", async ({ page }) => {
  await makePaid();
  await setBilling({
    billing_customer_id: "cus_plan_spec",
    billing_subscription_id: "sub_plan_spec",
    billing_status: "active",
    billing_interval: "year",
    trial_ends_at: new Date("2030-01-15T00:00:00Z"),
  });
  await logIn(page, adminUser);
  await page.goto("/admin/plan");

  await expect(page.getByText("Free trial until 15 January 2030.")).toBeVisible();
  await expect(page.getByText("Then billed yearly.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage billing" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Choose how to pay" })).toHaveCount(0);
});

test("a past_due site keeps Launch limits and is told to update its card", async ({ page }) => {
  await makePaid();
  await setBilling({
    billing_customer_id: "cus_plan_spec",
    billing_subscription_id: "sub_plan_spec",
    billing_status: "past_due",
  });
  await logIn(page, adminUser);
  await page.goto("/admin/plan");

  await expect(page.getByText("Your site is on the Launch plan.")).toBeVisible();
  await expect(page.getByText("Your last payment didn't go through.")).toBeVisible();
  await expect(page.getByText("0 MB of 1000 MB used")).toBeVisible();
});

test("after Checkout a still-Free site is told the payment is being processed", async ({
  page,
}) => {
  await logIn(page, adminUser);
  await page.goto("/admin/plan?checkout=done");
  await expect(page.getByText("Payment received.")).toBeVisible();
});

test("with billing off the page offers no way to pay", async ({ page }) => {
  const off = `http://127.0.0.1:${HOST_SPLIT_PORT}`;
  await page.goto(`${off}/admin/login`);
  await page.getByLabel("Email").fill(adminUser.email);
  await page.getByLabel("Password").fill(adminUser.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(`${off}/admin`);
  await page.goto(`${off}/admin/plan`);

  await expect(page.getByText("Paid plans are coming soon.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /upgrade|free trial|manage billing/i }),
  ).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Choose how to pay" })).toHaveCount(0);
});

test("Upgrade on a Launch site and Manage without a customer are both refused", async ({
  page,
}) => {
  await makePaid();
  await logIn(page, adminUser);
  await page.goto("/admin/plan");
  const headers = { Origin: `http://127.0.0.1:${PORT}` };

  const upgrade = await page.request.post("/admin/plan", { form: { intent: "upgrade" }, headers });
  const manage = await page.request.post("/admin/plan", { form: { intent: "manage" }, headers });
  const unknown = await page.request.post("/admin/plan", { form: { intent: "x" }, headers });

  expect([upgrade.status(), manage.status(), unknown.status()]).toEqual([400, 400, 400]);
});

test("a Free site Stripe still holds a subscription for is sent to Manage billing, not Upgrade (F-407)", async ({
  page,
}) => {
  await setBilling({
    billing_customer_id: "cus_plan_spec",
    billing_subscription_id: "sub_plan_spec",
    billing_status: "past_due",
  });
  await logIn(page, adminUser);
  await page.goto("/admin/plan");

  await expect(page.getByText("Your subscription ended after a failed payment.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage billing" })).toBeVisible();
  await expect(page.getByRole("button", { name: /upgrade|free trial/i })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Choose how to pay" })).toHaveCount(0);

  const response = await page.request.post("/admin/plan", {
    form: { intent: "upgrade", interval: "yearly" },
    headers: { Origin: `http://127.0.0.1:${PORT}` },
  });
  expect(response.status()).toBe(400);
});
