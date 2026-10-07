import { expect, type Page, test } from "@playwright/test";
import { buttonBlock, inSection } from "./helpers/documents.ts";
import { PORT } from "./helpers/ports.ts";
import { createSiteAdmin, createSiteWithAddress, deleteSite, siteUrl } from "./helpers/sites.ts";
import { withDatabase } from "./helpers/users.ts";

// Item 18a1, Step 4: the brand on public pages. Each test makes a site of its
// own - site 1's settings row is shared with other specs (F-103).

const BRAND = "#2f6b5a";

async function brandedSite(brandColor: string, stylePreset: string) {
  const site = await createSiteWithAddress("brand");
  const admin = await createSiteAdmin(site.id);
  await withDatabase(async (sql) => {
    await sql`
      update site_settings set brand_color = ${brandColor}, style_preset = ${stylePreset}
      where site_id = ${site.id}
    `;
    await sql`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
      select ${site.id}, 'page', 'Brand Page', 'brand-page',
             ${sql.json(inSection(buttonBlock("Go", "/posts")) as never)}, 'v4', 'published', now(), id
      from users where email = ${admin.email}
    `;
  });
  return site;
}

function style(page: Page) {
  return page.locator("head style[nonce]");
}

test("the response's CSP nonce is the nonce on the site's brand style", async ({ request }) => {
  const site = await brandedSite(BRAND, "classic");
  try {
    const response = await request.get(siteUrl("/brand-page", site.address));
    const csp = response.headers()["content-security-policy"];
    const nonce = /style-src 'self' 'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    const html = await response.text();
    expect(html).toContain(`<style nonce="${nonce}">[data-surface="site"]{--color-primary:`);
    expect(html).toContain('data-style="classic"');
  } finally {
    await deleteSite(site.id);
  }
});

test("a branded site's button, heading and wordmark use its colour and preset", async ({
  page,
}) => {
  const site = await brandedSite(BRAND, "classic");
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const fontUrls: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") fontUrls.push(request.url());
  });
  try {
    await page.goto(siteUrl("/brand-page", site.address));
    await expect(style(page)).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Go" })).toHaveCSS(
      "background-color",
      "rgb(47, 107, 90)",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
      "font-family",
      /^"?Source Serif 4/,
    );
    await expect(page.locator("header a").first()).toHaveCSS("color", "rgb(47, 107, 90)");
    await page.waitForLoadState("networkidle");
    expect(fontUrls.length).toBeGreaterThan(0);
    for (const url of fontUrls) {
      expect(new URL(url).origin).toBe(`http://${site.address}.localhost:${PORT}`);
    }
    expect(errors).toEqual([]);
  } finally {
    await deleteSite(site.id);
  }
});

test("the public 404 carries the same brand style", async ({ page }) => {
  const site = await brandedSite(BRAND, "classic");
  try {
    const response = await page.goto(siteUrl("/no-such-page", site.address));
    expect(response?.status()).toBe(404);
    await expect(style(page)).toHaveCount(1);
    await expect(page.locator("html")).toHaveAttribute("data-style", "classic");
  } finally {
    await deleteSite(site.id);
  }
});

test("a site with no colour and Modern has no brand style", async ({ page }) => {
  const site = await brandedSite("", "modern");
  try {
    await page.goto(siteUrl("/brand-page", site.address));
    await expect(style(page)).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-style", "modern");
  } finally {
    await deleteSite(site.id);
  }
});

test("an admin response's style-src is still exactly 'self'", async ({ request }) => {
  const response = await request.get("/admin/login");
  const csp = response.headers()["content-security-policy"];
  expect(csp.split("; ")).toContain("style-src 'self'");
});
