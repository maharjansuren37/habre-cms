import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { imageBlock } from "./helpers/documents.ts";
import { deleteTestMedia, insertTestMediaRow } from "./helpers/media.ts";
import { siteUrl } from "./helpers/sites.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  setRole,
  type TestUser,
  withDatabase,
} from "./helpers/users.ts";

// Item 17b, step 4: public pages give the browser a `srcset` and `sizes`, so a
// phone does not download a size far wider than the image is shown (the quality
// bar's rule: never more than one size above the displayed width times the
// screen's scale). The media rows are seeded with no objects behind them -
// `currentSrc` is the candidate the browser chose even when the file 404s - so
// this runs in CI, which holds no storage credentials.

const WIDTHS = [480, 960, 1600, 2400];

let editor: TestUser;
let mediaIds: string[];

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.17`,
  });
  mediaIds = [];
  editor = createAdmin("Srcset Editor");
  await setRole(editor.email, "editor");
});

test.afterEach(async () => {
  await deleteEntriesBy(editor.email);
  for (const id of mediaIds) await deleteTestMedia(id);
  await deleteTestUser(editor.email);
});

async function seedImage(altText: string, variantWidths: number[] | null = WIDTHS) {
  const id = await insertTestMediaRow({
    uploadedBy: editor.email,
    altText,
    width: 2400,
    height: 1600,
    variantWidths,
  });
  mediaIds.push(id);
  return id;
}

const section = (...columns: unknown[][]) => ({
  type: "section",
  attrs: { align: "top", background: "none" },
  content: columns.map((content) => ({ type: "column", content })),
});

// The e2e project has no DOM types; this is the part of an `img` read here.
type ImageLike = { alt: string; currentSrc: string; getBoundingClientRect(): { width: number } };

type Shown = { alt: string; chosen: number; displayed: number };

/** Each image's chosen candidate (the width in its `/<width>.webp` URL) and its drawn width. */
async function shownImages(page: Page): Promise<Shown[]> {
  const images = page.getByRole("img");
  const total = await images.count();
  const shown: Shown[] = [];
  for (let index = 0; index < total; index++) {
    const image = images.nth(index);
    // A lazy image picks its candidate only once it is near the viewport.
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((img: ImageLike) => img.currentSrc)).not.toBe("");
    const { alt, currentSrc, displayed } = await image.evaluate((img: ImageLike) => ({
      alt: img.alt,
      currentSrc: img.currentSrc,
      displayed: img.getBoundingClientRect().width,
    }));
    shown.push({ alt, chosen: Number(/\/(\d+)\.webp$/.exec(currentSrc)?.[1]), displayed });
  }
  return shown;
}

/** The smallest stored width that covers `needed` pixels, or the widest there is. */
function nextSizeUp(needed: number) {
  return WIDTHS.find((width) => width >= needed) ?? WIDTHS[WIDTHS.length - 1];
}

const viewports = [
  { name: "a 390 px phone at 3x", width: 390, height: 844, scale: 3 },
  { name: "a 1280 px desktop at 1x", width: 1280, height: 800, scale: 1 },
];

for (const viewport of viewports) {
  for (const columns of [1, 3]) {
    test(`on ${viewport.name}, a ${columns}-column section's images are never more than one size too wide`, async ({
      browser,
    }) => {
      const alts = Array.from({ length: columns }, (_, index) => `Column ${index + 1} picture`);
      const ids = await Promise.all(alts.map((alt) => seedImage(alt)));
      await createDraftFor(
        editor.email,
        `Srcset ${columns} ${viewport.width}`,
        { type: "doc", content: [section(...ids.map((id) => [imageBlock(id)]))] },
        { type: "page", status: "published" },
      );
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.scale,
        extraHTTPHeaders: { "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.18` },
      });
      const page = await context.newPage();
      await page.goto(siteUrl(`/srcset-${columns}-${viewport.width}`));

      const shown = await shownImages(page);
      expect(shown.map((image) => image.alt)).toEqual(alts);
      for (const image of shown) {
        expect(
          image.chosen,
          `${image.alt}: drawn ${image.displayed}px wide at ${viewport.scale}x`,
        ).toBeLessThanOrEqual(nextSizeUp(image.displayed * viewport.scale));
      }
      await context.close();
    });
  }
}

test("an image keeps its role and alt text name with a srcset (public-site.6)", async ({
  page,
}) => {
  const id = await seedImage("A named picture");
  await createDraftFor(
    editor.email,
    "Named Srcset",
    { type: "doc", content: [section([imageBlock(id)])] },
    { type: "page", status: "published" },
  );
  await page.goto(siteUrl("/named-srcset"));
  const image = page.getByRole("img", { name: "A named picture", exact: true });
  await expect(image).toHaveCount(1);
  await expect(image).toHaveAttribute("srcset", /\/480\.webp 480w, .*\/2400\.webp 2400w$/);
  await expect(image).toHaveAttribute("sizes", /\S/);
});

test("a row not yet optimised renders as before, with no srcset", async ({ page }) => {
  const id = await seedImage("An old picture", null);
  await createDraftFor(
    editor.email,
    "Old Picture",
    { type: "doc", content: [section([imageBlock(id)])] },
    { type: "page", status: "published" },
  );
  await page.goto(siteUrl("/old-picture"));
  const image = page.getByRole("img", { name: "An old picture" });
  await expect(image).not.toHaveAttribute("srcset", /.*/);
  await expect(image).not.toHaveAttribute("sizes", /.*/);
});

test("the share image is the social JPEG for an optimised row, the one object for an old row", async ({
  page,
}) => {
  const resized = await seedImage("Share resized");
  const legacy = await seedImage("Share legacy", null);
  const body = { type: "doc", content: [section([imageBlock(resized)])] };
  const resizedPage = await createDraftFor(editor.email, "Share Resized", body, {
    type: "page",
    status: "published",
  });
  const legacyPage = await createDraftFor(editor.email, "Share Legacy", body, {
    type: "page",
    status: "published",
  });
  await withDatabase(async (sql) => {
    await sql`update entries set social_image_media_id = ${resized} where id = ${resizedPage}`;
    await sql`update entries set social_image_media_id = ${legacy} where id = ${legacyPage}`;
  });

  await page.goto(siteUrl("/share-resized"));
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/social\.jpg$/,
  );
  await page.goto(siteUrl("/share-legacy"));
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/e2e-test\/[0-9a-f-]+\.jpg$/,
  );
});
