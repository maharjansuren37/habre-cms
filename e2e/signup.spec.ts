import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { HOST_SPLIT_PORT } from "./helpers/ports.ts";

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

test("a valid submit says signup is not ready yet and keeps the input", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Lena Novak");
  await page.getByLabel("Email").fill("lena@example.test");
  await page.getByLabel("Password").fill("a long enough password");
  await page.getByLabel("Your website’s address").fill("lenanovak");
  await page.getByLabel("Invite code").fill("7K2Q-M9XD-HC4V");
  await page.getByRole("button", { name: "Create my website" }).click();

  await expect(page.getByRole("alert")).toContainText("Signup isn’t ready yet");
  await expect(page.getByLabel("Your website’s address")).toHaveValue("lenanovak");
  await expect(page.getByLabel("Password")).toHaveValue("");
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
