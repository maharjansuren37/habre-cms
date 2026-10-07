import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
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

// Item 18a1, Step 5: Brand colour and Style in Settings.

const NO_COLOUR = "No colour (black and white)";

async function openSettings(page: Page, brandColor: string, stylePreset: string) {
  const site = await brandedSite(brandColor, stylePreset);
  const admin = await createSiteAdmin(site.id, "Brand Settings Admin");
  await logIn(page, admin);
  await page.goto("/admin/settings");
  return site;
}

async function savedBrand(siteId: string) {
  return withDatabase(async (sql) => {
    const [row] = await sql`
      select brand_color, style_preset from site_settings where site_id = ${siteId}
    `;
    return { brandColor: row.brand_color as string, stylePreset: row.style_preset as string };
  });
}

test("Other colour and Classic, saved in Settings, reach the public site", async ({ page }) => {
  const site = await openSettings(page, "", "modern");
  try {
    const picker = page.getByLabel("Pick other colour", { exact: true });
    await picker.click();
    await picker.fill(BRAND);
    await expect(page.getByRole("radio", { name: "Other colour", exact: true })).toBeChecked();
    await page.getByRole("radio", { name: "Classic" }).check();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Settings updated.")).toBeVisible();
    expect(await savedBrand(site.id)).toEqual({ brandColor: BRAND, stylePreset: "classic" });

    await page.goto(siteUrl("/brand-page", site.address));
    await expect(page.getByRole("link", { name: "Go" })).toHaveCSS(
      "background-color",
      "rgb(47, 107, 90)",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
      "font-family",
      /^"?Source Serif 4/,
    );

    // The saved colour now has a swatch of its own, checked.
    await page.goto("/admin/settings");
    await expect(page.getByRole("radio", { name: `Saved colour ${BRAND}` })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Classic" })).toBeChecked();
  } finally {
    await deleteSite(site.id);
  }
});

test("choosing No colour and saving returns the site to ink", async ({ page }) => {
  const site = await openSettings(page, BRAND, "classic");
  try {
    await page.getByRole("radio", { name: NO_COLOUR }).check();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Settings updated.")).toBeVisible();
    expect((await savedBrand(site.id)).brandColor).toBe("");
    await page.goto(siteUrl("/brand-page", site.address));
    await expect(style(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Go" })).not.toHaveCSS(
      "background-color",
      "rgb(47, 107, 90)",
    );
  } finally {
    await deleteSite(site.id);
  }
});

test("a crafted brand colour or style is refused with 400 and changes nothing", async ({
  page,
}) => {
  const site = await openSettings(page, BRAND, "classic");
  try {
    const origin = new URL(page.url()).origin;
    const base = {
      siteTitle: "Crafted",
      logoMediaId: "",
      homePageId: "",
      siteDescription: "",
      language: "en",
    };
    const badColour = await page.request.post(`${origin}/admin/settings`, {
      headers: { Origin: origin },
      form: { ...base, brandColor: "#2f6b5a;}", stylePreset: "modern" },
    });
    expect(badColour.status()).toBe(400);
    expect(await badColour.text()).toContain("Choose a colour");
    const badStyle = await page.request.post(`${origin}/admin/settings`, {
      headers: { Origin: origin },
      form: { ...base, brandColor: "", stylePreset: "ornate" },
    });
    expect(badStyle.status()).toBe(400);
    expect(await badStyle.text()).toContain("Choose one of the three styles");
    expect(await savedBrand(site.id)).toEqual({ brandColor: BRAND, stylePreset: "classic" });
  } finally {
    await deleteSite(site.id);
  }
});

test("arrow keys move between swatches and between style cards", async ({ page }) => {
  const site = await openSettings(page, BRAND, "classic");
  try {
    const none = page.getByRole("radio", { name: NO_COLOUR });
    await none.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: `Saved colour ${BRAND}` })).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Other colour", exact: true })).toBeChecked();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(none).toBeChecked();

    await page.getByRole("radio", { name: "Classic" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Modern" })).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Friendly" })).toBeChecked();
  } finally {
    await deleteSite(site.id);
  }
});

test("Settings does not scroll sideways at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const site = await openSettings(page, BRAND, "classic");
  try {
    await expect(page.getByRole("group", { name: "Brand colour" })).toBeVisible();
    const overflow = (await page.evaluate(`(() => {
      const root = document.documentElement;
      if (root.scrollWidth <= root.clientWidth) return [];
      return [...document.body.querySelectorAll("*")]
        .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 0.5)
        .map((el) => el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : ""));
    })()`)) as string[];
    expect(overflow).toEqual([]);
  } finally {
    await deleteSite(site.id);
  }
});
