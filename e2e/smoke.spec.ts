import { expect, test } from "@playwright/test";
import { siteUrl } from "./helpers/sites.ts";

test("home page renders the site chrome", async ({ page }) => {
  // The page's own content (published posts, or the empty state) is covered
  // in detail by public-site.spec.ts; this only checks the page renders at
  // all. The heading this test used to check was home.tsx's placeholder,
  // replaced by real content in item 4b - "Habre CMS" is now the header's
  // brand link, not an <h1>.
  await page.goto(siteUrl("/"));
  await expect(page.getByRole("link", { name: "Habre CMS" })).toBeVisible();
});

test("health check reports the database is up", async ({ request }) => {
  const response = await request.get("/healthz");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "up" });
});
