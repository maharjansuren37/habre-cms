import { expect, test } from "@playwright/test";
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from "../app/features/legal/legal-documents.ts";

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
});
