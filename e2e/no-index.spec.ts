import { expect, test } from "@playwright/test";
import { HOST_SPLIT_PORT } from "./helpers/ports.ts";
import { createSiteWithAddress, deleteSite, siteUrl } from "./helpers/sites.ts";

// SEARCH_INDEXING=off (the host-split server) blocks search engines on every
// host; the primary server leaves it on, the default.

const PLATFORM = `http://127.0.0.1:${HOST_SPLIT_PORT}`;
const DISALLOW_ALL = "User-agent: *\nDisallow: /\n";
const NOINDEX = "noindex, nofollow";

test("with indexing off, every host's robots.txt disallows all and names no sitemap", async ({
  request,
}) => {
  const site = await createSiteWithAddress("no-index-robots");
  try {
    const onSite = await request.get(
      `http://${site.address}.localhost:${HOST_SPLIT_PORT}/robots.txt`,
      { maxRedirects: 0 },
    );
    expect(onSite.status()).toBe(200);
    expect(await onSite.text()).toBe(DISALLOW_ALL);
    const onPlatform = await request.get(`${PLATFORM}/robots.txt`, { maxRedirects: 0 });
    expect(await onPlatform.text()).toBe(DISALLOW_ALL);
  } finally {
    await deleteSite(site.id);
  }
});

test("with indexing off, site pages, the sitemap, the admin and a redirect carry X-Robots-Tag", async ({
  request,
}) => {
  const site = await createSiteWithAddress("no-index-header");
  try {
    const base = `http://${site.address}.localhost:${HOST_SPLIT_PORT}`;
    for (const url of [`${base}/`, `${base}/sitemap.xml`, `${PLATFORM}/admin/login`]) {
      const response = await request.get(url, { maxRedirects: 0 });
      expect(response.headers()["x-robots-tag"], url).toBe(NOINDEX);
    }
    const redirect = await request.get(`${PLATFORM}/`, { maxRedirects: 0 });
    expect(redirect.status()).toBeGreaterThanOrEqual(300);
    expect(redirect.status()).toBeLessThan(400);
    expect(redirect.headers()["x-robots-tag"]).toBe(NOINDEX);
  } finally {
    await deleteSite(site.id);
  }
});

test("with indexing on (the default), a site's home page has no X-Robots-Tag", async ({
  request,
}) => {
  const site = await createSiteWithAddress("no-index-on");
  try {
    const response = await request.get(siteUrl("/", site.address), { maxRedirects: 0 });
    expect(response.headers()["x-robots-tag"]).toBeUndefined();
  } finally {
    await deleteSite(site.id);
  }
});
