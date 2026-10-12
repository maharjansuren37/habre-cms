import { expect, test } from "@playwright/test";
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from "../app/features/legal/legal-documents.ts";
import { HOST_SPLIT_PORT } from "./helpers/ports.ts";

// F-428 step 3: the terms and the privacy policy, on the platform host.
const KEYS: LegalDocumentKey[] = ["terms", "privacy"];

for (const key of KEYS) {
  const doc = LEGAL_DOCUMENTS[key];

  test(`/legal/${key} shows its title, date and every section`, async ({ page }) => {
    const response = await page.goto(`/legal/${key}`);
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(`${doc.title} - Habre`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: doc.title })).toBeVisible();
    await expect(page.locator("time")).toHaveAttribute("datetime", doc.updated);
    await expect(page.getByText("Last updated")).toBeVisible();

    for (const section of doc.sections) {
      await expect(
        page.getByRole("heading", { level: 2, name: section.heading, exact: true }),
      ).toBeVisible();
    }
  });

  test(`/legal/${key} has no horizontal scroll at 390px`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`/legal/${key}`);
    await expect(page.getByRole("heading", { level: 1, name: doc.title })).toBeVisible();
    expect(
      await page.evaluate(
        "document.documentElement.scrollWidth <= document.documentElement.clientWidth",
      ),
    ).toBe(true);
  });
}

test("each policy links to the other and to signup", async ({ page }) => {
  await page.goto("/legal/terms");
  await expect(page.getByRole("link", { name: "Privacy policy" })).toHaveAttribute(
    "href",
    "/legal/privacy",
  );
  await expect(page.getByRole("link", { name: "Create your website" })).toHaveAttribute(
    "href",
    "/signup",
  );
  await page.goto("/legal/privacy");
  await expect(page.getByRole("link", { name: "Terms of service" })).toHaveAttribute(
    "href",
    "/legal/terms",
  );
});

test("an unknown document is Not Found", async ({ page }) => {
  const response = await page.goto("/legal/other");
  expect(response?.status()).toBe(404);
  const proto = await page.goto("/legal/toString");
  expect(proto?.status()).toBe(404);
  // Nothing after /legal/ is not a document, and not a server error (F-437).
  const bare = await page.goto("/legal/");
  expect(bare?.status()).toBe(404);
});

// F-428 step 4: the links from signup and from login.
test("signup links the terms and the privacy policy above Create my website", async ({ page }) => {
  await page.goto("/signup");
  await expect(
    page.getByText("By creating an account you agree to the Terms of service and Privacy policy."),
  ).toBeVisible();
  const form = page.locator("form");
  await form.getByRole("link", { name: "Terms of service" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms of service" })).toBeVisible();
  await page.goto("/signup");
  await form.getByRole("link", { name: "Privacy policy" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
});

for (const [label, base] of [
  ["invite mode, email on", ""],
  ["signup off, email off", `http://127.0.0.1:${HOST_SPLIT_PORT}`],
] as const) {
  test(`login links the terms and the privacy policy (${label})`, async ({ page }) => {
    await page.goto(`${base}/admin/login`);
    await page.getByRole("link", { name: "Terms of service" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Terms of service" })).toBeVisible();
    await page.goBack();
    await page.getByRole("link", { name: "Privacy policy" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  });
}

test("with signup off the policies do not link to signup (F-441)", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${HOST_SPLIT_PORT}/legal/terms`);
  await expect(page.getByRole("heading", { level: 1, name: "Terms of service" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy policy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create your website" })).toHaveCount(0);
});
